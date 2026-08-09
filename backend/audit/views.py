from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(ListAPIView):
    """
    GET /api/audit/logs/
    Admin only. Returns paginated audit log.
    Filters: action, user, date_from, date_to
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['action', 'user', 'model_name']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']

    def get_queryset(self):
        if not self.request.user.is_staff:
            return AuditLog.objects.none()

        qs = AuditLog.objects.select_related('user').all()

        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        action = self.request.query_params.get('action')
        username = self.request.query_params.get('username')

        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)
        if action:
            qs = qs.filter(action__icontains=action)
        if username:
            qs = qs.filter(user__username__icontains=username)

        return qs
