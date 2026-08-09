import logging
from django.utils import timezone
from django.core.cache import cache
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import School, SchoolUser, DataVerificationRequest
from ..serializers import DataVerificationRequestSerializer
from ..algorithms.mcda import MCDAEngine

logger = logging.getLogger('schools')


class DataVerificationRequestViewSet(viewsets.GenericViewSet):
    serializer_class = DataVerificationRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = DataVerificationRequest.objects.select_related('school', 'submitted_by', 'reviewed_by')
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            try:
                school = self.request.user.school_profile.school
                return qs.filter(school=school)
            except SchoolUser.DoesNotExist:
                return qs.none()
        return qs

    def list(self, request):
        qs = self.get_queryset()
        serializer = DataVerificationRequestSerializer(qs, many=True)
        return Response({'count': qs.count(), 'results': serializer.data})

    def create(self, request):
        try:
            school = request.user.school_profile.school
        except SchoolUser.DoesNotExist:
            return Response({'error': 'No school linked to your account.'}, status=404)

        serializer = DataVerificationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        obj = serializer.save(school=school, submitted_by=request.user)
        return Response(DataVerificationRequestSerializer(obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin required.'}, status=403)

        vr = self.get_object()
        if vr.status != 'pending':
            return Response({'error': f'Cannot approve a {vr.status} request.'}, status=400)

        school = vr.school
        # Snapshot the school's CURRENT values before overwriting — so the
        # approved card can show what actually changed.
        vr.prev_student_teacher_ratio = school.student_teacher_ratio
        vr.prev_infrastructure_deficit = school.infrastructure_deficit
        vr.prev_material_shortage = school.material_shortage
        vr.prev_geographic_difficulty = school.geographic_difficulty
        vr.prev_socioeconomic_index = school.socioeconomic_index

        school.student_teacher_ratio = vr.student_teacher_ratio
        school.infrastructure_deficit = vr.infrastructure_deficit
        school.material_shortage = vr.material_shortage
        school.geographic_difficulty = vr.geographic_difficulty
        school.socioeconomic_index = vr.socioeconomic_index
        school.save(update_fields=[
            'student_teacher_ratio', 'infrastructure_deficit',
            'material_shortage', 'geographic_difficulty', 'socioeconomic_index',
        ])

        try:
            engine = MCDAEngine()
            engine.update_school_priorities(School.objects.all())
            # Invalidate cached ranking responses so the new ranks show immediately
            cache.set('rankings_version', cache.get('rankings_version', 1) + 1, None)
        except Exception:
            logger.exception("Ranking recompute after verification approval failed")

        vr.status = 'approved'
        vr.reviewed_at = timezone.now()
        vr.reviewed_by = request.user
        vr.admin_note = request.data.get('admin_note', '')
        vr.save(update_fields=[
            'status', 'reviewed_at', 'reviewed_by', 'admin_note',
            'prev_student_teacher_ratio', 'prev_infrastructure_deficit',
            'prev_material_shortage', 'prev_geographic_difficulty',
            'prev_socioeconomic_index',
        ])

        try:
            from notifications.models import Notification
            from notifications.emails import email_many
            from django.contrib.auth.models import User as AuthUser
            recipients = AuthUser.objects.filter(school_profile__school=vr.school, is_active=True)
            title = 'Data Verification Approved'
            message = (
                f"Your data verification request for {vr.school.name} has been approved "
                f"and your indicators have been updated. Rankings have been recomputed. "
                f"{vr.admin_note or ''}"
            )
            notifs = []
            for u in recipients:
                notifs.append(Notification(recipient=u, title=title, message=message, type='ranking_update'))
            Notification.objects.bulk_create(notifs)
            email_many(recipients, title, message)
        except Exception:
            pass

        return Response(DataVerificationRequestSerializer(vr).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin required.'}, status=403)

        vr = self.get_object()
        if vr.status != 'pending':
            return Response({'error': f'Cannot reject a {vr.status} request.'}, status=400)

        admin_note = request.data.get('admin_note', '').strip()
        if not admin_note:
            return Response({'error': 'admin_note is required for rejection.'}, status=400)

        vr.status = 'rejected'
        vr.reviewed_at = timezone.now()
        vr.reviewed_by = request.user
        vr.admin_note = admin_note
        vr.save(update_fields=['status', 'reviewed_at', 'reviewed_by', 'admin_note'])

        try:
            from notifications.models import Notification
            from notifications.emails import email_many
            from django.contrib.auth.models import User as AuthUser
            recipients = AuthUser.objects.filter(school_profile__school=vr.school, is_active=True)
            title = 'Data Verification Rejected'
            message = (
                f"Your data verification request for {vr.school.name} was not approved. "
                f"Reason: {admin_note}"
            )
            notifs = []
            for u in recipients:
                notifs.append(Notification(recipient=u, title=title, message=message, type='system_alert'))
            Notification.objects.bulk_create(notifs)
            email_many(recipients, title, message)
        except Exception:
            pass

        return Response(DataVerificationRequestSerializer(vr).data)
