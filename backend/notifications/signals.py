from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='allocation.BudgetCycle')
def notify_on_allocation_complete(sender, instance, created, **kwargs):
    """
    When a BudgetCycle moves to 'computed' status, notify all school users
    that have an AllocationResult in this cycle — both in-app and by email.
    """
    if not created and instance.status == 'computed':
        from django.contrib.auth.models import User
        from schools.models import SchoolUser
        from .models import Notification
        from .emails import email_many

        school_user_ids = SchoolUser.objects.values_list('user_id', flat=True)
        recipients = User.objects.filter(id__in=school_user_ids)

        title = f"Allocation Results: {instance.name}"
        message = (
            f"Budget cycle '{instance.name}' (FY {instance.fiscal_year}) "
            f"has been computed. NPR {float(instance.total_allocated):,.0f} "
            f"allocated to {instance.schools_covered} schools. "
            f"Log in to view your allocation."
        )

        notifications = []
        for user in recipients:
            notifications.append(Notification(recipient=user, title=title, message=message, type='allocation_result'))
        Notification.objects.bulk_create(notifications, batch_size=200)

        # Send emails (console backend in dev, SMTP in prod)
        email_many(recipients, title, message)
