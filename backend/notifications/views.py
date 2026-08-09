from django.contrib.auth.models import User
from django.db.models import Count, Max
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Notification
from .serializers import NotificationSerializer, BroadcastSerializer, MarkReadSerializer


class NotificationListView(APIView):
    """
    GET /api/notifications/
    Returns all notifications for the authenticated user, with unread count.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user)
        unread_only = request.query_params.get('unread') == 'true'
        if unread_only:
            qs = qs.filter(is_read=False)
        serializer = NotificationSerializer(qs[:50], many=True)
        return Response({
            'count': qs.count(),
            'unread_count': Notification.objects.filter(
                recipient=request.user, is_read=False
            ).count(),
            'results': serializer.data,
        })


class MarkReadView(APIView):
    """
    POST /api/notifications/mark-read/
    Body: {"ids": [1,2,3]} — mark specific IDs read.
    Body: {} or {"ids": []} — mark ALL as read.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MarkReadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ids = serializer.validated_data.get('ids', [])
        qs = Notification.objects.filter(recipient=request.user)
        if ids:
            qs = qs.filter(id__in=ids)
        updated = qs.update(is_read=True)
        return Response({'marked_read': updated})


class BroadcastView(APIView):
    """
    POST /api/notifications/broadcast/
    Admin only. Sends a notification to ALL school users.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = BroadcastSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        # Target all active non-staff users (covers SchoolUser accounts and
        # any user created without an explicit SchoolUser record)
        recipients = User.objects.filter(
            is_staff=False, is_superuser=False, is_active=True)

        notifications = []
        for user in recipients:
            notifications.append(Notification(
                recipient=user,
                title=data['title'],
                message=data['message'],
                type=data['type'],
            ))
        Notification.objects.bulk_create(notifications, batch_size=200)

        return Response({
            'success': True,
            'sent_to': len(notifications),
            'message': f"Broadcast sent to {len(notifications)} school users.",
        }, status=status.HTTP_201_CREATED)


class SentNotificationsView(APIView):
    """
    GET /api/notifications/sent/
    Admin only. Returns broadcast notifications, grouped so one broadcast
    appears as ONE row with its true recipient count.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin access required.'}, status=403)

        notifications = (
            Notification.objects
            .values('title', 'message', 'type')
            .annotate(
                recipient_count=Count('id'),
                created_at=Max('created_at'),
            )
            .order_by('-created_at')[:50]
        )
        return Response({'results': list(notifications)})
