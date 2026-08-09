import logging
from decimal import Decimal, InvalidOperation
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from ..models import SchoolUser, ResourceRequest
from ..serializers import ResourceRequestSerializer
from allocation.models import FiscalYearBudget, DiscretionaryGrant

logger = logging.getLogger('schools')


def _notify_school(rr, title, message, ntype='allocation_result'):
    """Send in-app + email notification to the school's users. Best-effort."""
    try:
        from notifications.models import Notification
        from notifications.emails import email_many
        from django.contrib.auth.models import User as AuthUser
        recipients = AuthUser.objects.filter(school_profile__school=rr.school, is_active=True)
        notifs = []
        for u in recipients:
            notifs.append(Notification(recipient=u, title=title, message=message, type=ntype))
        Notification.objects.bulk_create(notifs)
        email_many(recipients, title, message)
    except Exception:
        logger.exception("Failed to send resource-request notification")


class ResourceRequestViewSet(viewsets.GenericViewSet):
    serializer_class = ResourceRequestSerializer
    permission_classes = [IsAuthenticated]
    # create() receives a file (multipart/form-data)
    # approve()/reject() send a plain body (application/json)
    # Both parsers must be allowed, or the JSON actions fail with
    # "Unsupported media type 'application/json' in request."
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = ResourceRequest.objects.select_related(
            'school', 'submitted_by', 'reviewed_by', 'grant',
        )
        # Highest priority school first, then oldest request first.
        qs = qs.order_by('school__priority_rank', 'created_at')
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            try:
                school = self.request.user.school_profile.school
                return qs.filter(school=school)
            except SchoolUser.DoesNotExist:
                return qs.none()
        return qs

    def list(self, request):
        qs = self.get_queryset()
        serializer = ResourceRequestSerializer(qs, many=True, context={'request': request})
        return Response({'count': qs.count(), 'results': serializer.data})

    def retrieve(self, request, pk=None):
        obj = self.get_object()
        return Response(ResourceRequestSerializer(obj, context={'request': request}).data)

    def create(self, request):
        try:
            school = request.user.school_profile.school
        except SchoolUser.DoesNotExist:
            return Response({'error': 'No school linked to your account.'}, status=404)

        serializer = ResourceRequestSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        obj = serializer.save(school=school, submitted_by=request.user)
        logger.info("ResourceRequest %s created for %s", obj.id, school.name)
        return Response(
            ResourceRequestSerializer(obj, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """
        Approve a resource request AND grant money from the annual pool.

        POST body: { "amount": 300000, "admin_response": "Approved for repairs" }

        The amount is decided by the administrator after reading the school's
        official letter (the system cannot read a PDF). The grant is checked
        against the annual FiscalYearBudget balance and recorded atomically,
        so total government spending can never exceed the annual budget.
        """
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin required.'}, status=403)

        rr = self.get_object()
        if rr.status not in ('pending', 'under_review'):
            return Response({'error': f'Cannot approve a {rr.status} request.'}, status=400)

        # Amount
        raw_amount = request.data.get('amount')
        if raw_amount in (None, ''):
            return Response({'error': 'An amount is required to approve this request.'}, status=400)
        try:
            amount = Decimal(str(raw_amount))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'error': 'Amount must be a number.'}, status=400)
        if amount <= 0:
            return Response({'error': 'Amount must be greater than zero.'}, status=400)

        # Annual pool
        fb = FiscalYearBudget.objects.filter(is_active=True).order_by('-fiscal_year').first()
        if not fb:
            return Response(
                {'error': 'No active annual budget. Create a Fiscal Year Budget first.'},
                status=400,
            )
        if not fb.can_afford(amount):
            return Response(
                {
                    'error': (
                        f"Insufficient annual budget. Requested NPR {float(amount):,.0f} "
                        f"but only NPR {float(fb.available):,.0f} remains in {fb.fiscal_year}."
                    ),
                    'available': float(fb.available),
                    'requested': float(amount),
                },
                status=400,
            )

        # Approve + grant atomically
        with transaction.atomic():
            rr.status = 'approved'
            rr.reviewed_at = timezone.now()
            rr.reviewed_by = request.user
            rr.admin_response = request.data.get('admin_response', '')
            rr.amount_granted = amount
            rr.save(update_fields=[
                'status', 'reviewed_at', 'reviewed_by', 'admin_response', 'amount_granted',
            ])

            DiscretionaryGrant.objects.create(
                fiscal_budget=fb,
                school=rr.school,
                resource_request=rr,
                amount=amount,
                granted_by=request.user,
            )

        logger.info(
            "Discretionary grant NPR %s to %s (request %s) — pool %s remaining",
            amount, rr.school.name, rr.id, fb.available,
        )

        _notify_school(
            rr,
            'Resource Request Approved',
            f"Your resource request \"{rr.subject}\" has been approved. "
            f"NPR {float(amount):,.0f} has been granted to {rr.school.name}. "
            f"{rr.admin_response or ''}".strip(),
        )

        data = ResourceRequestSerializer(rr, context={'request': request}).data
        data['pool_available_after'] = float(fb.available)
        return Response(data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin required.'}, status=403)

        rr = self.get_object()
        if rr.status not in ('pending', 'under_review'):
            return Response({'error': f'Cannot reject a {rr.status} request.'}, status=400)

        admin_response = request.data.get('admin_response', '').strip()
        if not admin_response:
            return Response({'error': 'admin_response is required for rejection.'}, status=400)

        rr.status = 'rejected'
        rr.reviewed_at = timezone.now()
        rr.reviewed_by = request.user
        rr.admin_response = admin_response
        rr.save(update_fields=['status', 'reviewed_at', 'reviewed_by', 'admin_response'])

        _notify_school(
            rr,
            'Resource Request Rejected',
            f"Your resource request \"{rr.subject}\" for {rr.school.name} was not approved. "
            f"Reason: {admin_response}",
            ntype='system_alert',   # no money granted -> not an allocation result
        )
        return Response(ResourceRequestSerializer(rr, context={'request': request}).data)
