from django.urls import path
from .views import NotificationListView, MarkReadView, BroadcastView, SentNotificationsView

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('mark-read/', MarkReadView.as_view(), name='notification-mark-read'),
    path('broadcast/', BroadcastView.as_view(), name='notification-broadcast'),
    path('sent/', SentNotificationsView.as_view(), name='notification-sent'),
]
