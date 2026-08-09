"""
Email helpers for the notification system.

Uses Django's configured EMAIL_BACKEND. In development this defaults to the
console backend (emails print to the terminal), so nothing breaks if SMTP
credentials aren't set. In production, set the EMAIL_* env vars to use SMTP.
"""
import logging
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def _recipient_email(user):
    """Return a usable email for a user, or None."""
    email = (getattr(user, "email", "") or "").strip()
    return email or None


def send_notification_email(user, subject, message):
    """
    Send a single notification email. Never raises — email failure must not
    break the request flow (notification is still saved in the DB).
    """
    to = _recipient_email(user)
    if not to:
        return False
    try:
        send_mail(
            subject=f"[RuralEd Nepal] {subject}",
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@rurated.np"),
            recipient_list=[to],
            fail_silently=True,
        )
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning("Notification email failed for %s: %s", to, exc)
        return False


def email_many(users, subject, message):
    """Send the same email to multiple users. Returns count sent."""
    sent = 0
    for user in users:
        if send_notification_email(user, subject, message):
            sent += 1
    return sent
