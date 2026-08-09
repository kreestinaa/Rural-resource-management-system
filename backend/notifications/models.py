from django.db import models
from django.contrib.auth.models import User

NOTIFICATION_TYPES = [
    ('allocation_result', 'Allocation Result'),
    ('ranking_update', 'Ranking Update'),
    ('system_alert', 'System Alert'),
    ('announcement', 'Announcement'),
]


class Notification(models.Model):
    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(
        max_length=30, choices=NOTIFICATION_TYPES, default='announcement'
    )
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
        ]

    def __str__(self):
        return f"{self.recipient.username}: {self.title}"
