from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    recipient_username = serializers.ReadOnlyField(source='recipient.username')

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_username', 'title', 'message',
            'type', 'is_read', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'recipient']


class BroadcastSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    message = serializers.CharField()
    type = serializers.ChoiceField(
        choices=['allocation_result', 'ranking_update',
                 'system_alert', 'announcement'],
        default='announcement'
    )


class MarkReadSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="List of notification IDs to mark read. Empty = mark ALL."
    )
