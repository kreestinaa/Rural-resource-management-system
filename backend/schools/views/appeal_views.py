import logging
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import SchoolUser, RankingAppeal
from ..serializers import RankingAppealSerializer

logger = logging.getLogger('schools')


class RankingAppealViewSet(viewsets.GenericViewSet):
    serializer_class = RankingAppealSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = RankingAppeal.objects.select_related('school', 'submitted_by', 'reviewed_by')
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            try:
                school = self.request.user.school_profile.school
                return qs.filter(school=school)
            except SchoolUser.DoesNotExist:
                return qs.none()
        return qs

    def list(self, request):
        status_filter = request.query_params.get('status', '')
        qs = self.get_queryset()
        if status_filter:
            qs = qs.filter(status=status_filter)
        serializer = RankingAppealSerializer(qs, many=True)
        return Response({'count': qs.count(), 'results': serializer.data})

    def create(self, request):
        try:
            school = request.user.school_profile.school
        except SchoolUser.DoesNotExist:
            return Response({'error': 'No school linked to your account.'}, status=404)

        serializer = RankingAppealSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        obj = serializer.save(
            school=school,
            submitted_by=request.user,
            current_rank=school.priority_rank or 0,
            current_score=school.priority_score or 0.0,
        )
        return Response(RankingAppealSerializer(obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='mark_under_review')
    def mark_under_review(self, request, pk=None):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin required.'}, status=403)
        appeal = self.get_object()
        if appeal.status != 'pending':
            return Response({'error': 'Only pending appeals can be moved to under review.'}, status=400)
        appeal.status = 'under_review'
        appeal.save(update_fields=['status'])
        return Response(RankingAppealSerializer(appeal).data)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin required.'}, status=403)
        appeal = self.get_object()
        if appeal.status not in ('pending', 'under_review'):
            return Response({'error': f'Cannot accept a {appeal.status} appeal.'}, status=400)

        admin_response = request.data.get('admin_response', '').strip()
        appeal.status = 'accepted'
        appeal.admin_response = admin_response
        appeal.reviewed_at = timezone.now()
        appeal.reviewed_by = request.user
        appeal.save(update_fields=['status', 'admin_response', 'reviewed_at', 'reviewed_by'])

        try:
            from notifications.models import Notification
            from notifications.emails import email_many
            from django.contrib.auth.models import User as AuthUser
            recipients = AuthUser.objects.filter(school_profile__school=appeal.school, is_active=True)
            title = 'Your Ranking Appeal Was Accepted'
            message = f"Your ranking appeal for {appeal.school.name} has been accepted. {admin_response}"
            notifs = []
            for u in recipients:
                notifs.append(Notification(
                    recipient=u,
                    title=title,
                    message=message,
                    type='ranking_update',
                ))
            Notification.objects.bulk_create(notifs)
            email_many(recipients, title, message)
        except Exception:
            pass

        return Response(RankingAppealSerializer(appeal).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin required.'}, status=403)
        appeal = self.get_object()
        if appeal.status not in ('pending', 'under_review'):
            return Response({'error': f'Cannot reject a {appeal.status} appeal.'}, status=400)

        admin_response = request.data.get('admin_response', '').strip()
        if not admin_response:
            return Response({'error': 'admin_response is required.'}, status=400)

        appeal.status = 'rejected'
        appeal.admin_response = admin_response
        appeal.reviewed_at = timezone.now()
        appeal.reviewed_by = request.user
        appeal.save(update_fields=['status', 'admin_response', 'reviewed_at', 'reviewed_by'])

        try:
            from notifications.models import Notification
            from notifications.emails import email_many
            from django.contrib.auth.models import User as AuthUser
            recipients = AuthUser.objects.filter(school_profile__school=appeal.school, is_active=True)
            title = 'Your Ranking Appeal Was Reviewed'
            message = f"Your ranking appeal for {appeal.school.name} was not accepted. {admin_response}"
            notifs = []
            for u in recipients:
                notifs.append(Notification(recipient=u, title=title, message=message, type='ranking_update'))
            Notification.objects.bulk_create(notifs)
            email_many(recipients, title, message)
        except Exception:
            pass

        return Response(RankingAppealSerializer(appeal).data)
