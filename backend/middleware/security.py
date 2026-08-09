"""
Security and observability middleware for the Rural Resource Allocation API.

Provides:
- Per-request structured logging (user, IP, method, path, status, duration)
- Suspicious request detection (path traversal, SQL injection patterns)
"""
import logging
import time
import re

logger = logging.getLogger('middleware')

# Patterns that indicate potential injection or path traversal attempts
_SUSPICIOUS_PATTERNS = re.compile(
    r'(\.\./|\.\.\\|<script|javascript:|union\s+select|drop\s+table)',
    re.IGNORECASE,
)


def _get_client_ip(request):
    """Extract real client IP, honouring X-Forwarded-For in proxy environments."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


class RequestLoggingMiddleware:
    """
    Logs every API request with structured fields useful for monitoring.

    Log format (INFO):
        [METHOD] /path | user=<username> | ip=<ip> | status=<code> | <ms>ms

    Suspicious requests are logged at WARNING level and a 400 is returned
    without touching application code.
    """

    def __init__(self, get_response):
        """Standard Django WSGI middleware initialisation."""
        self.get_response = get_response

    def __call__(self, request):
        """Process each request: time it, log it, flag suspicious paths."""
        start = time.monotonic()

        # Check for suspicious patterns in URL path and query string
        full_path = request.get_full_path()
        if _SUSPICIOUS_PATTERNS.search(full_path):
            ip = _get_client_ip(request)
            logger.warning(
                'Suspicious request blocked | ip=%s | path=%s | user=%s',
                ip,
                full_path,
                getattr(request.user, 'username', 'anonymous'),
            )
            from django.http import HttpResponseBadRequest
            return HttpResponseBadRequest('Bad Request')

        response = self.get_response(request)

        duration_ms = round((time.monotonic() - start) * 1000, 1)
        ip = _get_client_ip(request)
        username = (
            request.user.username
            if hasattr(request, 'user') and request.user.is_authenticated
            else 'anonymous'
        )

        logger.info(
            '[%s] %s | user=%s | ip=%s | status=%s | %sms',
            request.method,
            full_path,
            username,
            ip,
            response.status_code,
            duration_ms,
        )

        # Add security headers to every response
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        return response
