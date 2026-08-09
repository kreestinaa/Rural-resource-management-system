"""
Custom DRF exception handler providing consistent error response structure.

All API errors return:
    {
        "success": false,
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Human readable summary",
            "details": { ... }        # field-level errors or extra info
        },
        "timestamp": "2024-01-01T00:00:00Z"
    }
"""
import logging
from datetime import datetime, timezone

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.db import DatabaseError, IntegrityError
from django.http import Http404

from rest_framework import status
from rest_framework.exceptions import (
    ValidationError,
    PermissionDenied,
    NotAuthenticated,
    AuthenticationFailed,
    NotFound,
    MethodNotAllowed,
    Throttled,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_default_handler

logger = logging.getLogger('django.request')


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _payload(code: str, message: str, details=None) -> dict:
    err = {'code': code, 'message': message}
    if details:
        err['details'] = details
    return {'success': False, 'error': err, 'timestamp': _now_iso()}


def custom_exception_handler(exc, context):
    """
    Replace DRF's default exception handler with a uniform error envelope.

    Falls back to the DRF default for unrecognised exceptions so that
    unexpected errors still surface rather than silently swallowing them.
    """
    # Let DRF convert Django exceptions first (Http404, PermissionDenied, ...)
    response = drf_default_handler(exc, context)

    # DRF typed exceptions
    if isinstance(exc, ValidationError):
        details = exc.detail if isinstance(exc.detail, dict) else {'non_field_errors': exc.detail}
        # Flatten to simple strings for readability
        flat = {}
        for field, errors in details.items():
            if isinstance(errors, list):
                flat[field] = ' '.join(
                    str(e) if not hasattr(e, 'detail') else str(e.detail)
                    for e in errors
                )
            else:
                flat[field] = str(errors)
        first_msg = next(iter(flat.values()), 'Validation failed.')
        return Response(
            _payload('VALIDATION_ERROR', first_msg, flat),
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return Response(
            _payload('AUTHENTICATION_REQUIRED', 'Authentication credentials were not provided or are invalid.'),
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if isinstance(exc, (PermissionDenied, DjangoPermissionDenied)):
        return Response(
            _payload('PERMISSION_DENIED', 'You do not have permission to perform this action.'),
            status=status.HTTP_403_FORBIDDEN,
        )

    if isinstance(exc, (NotFound, Http404)):
        return Response(
            _payload('NOT_FOUND', 'The requested resource was not found.'),
            status=status.HTTP_404_NOT_FOUND,
        )

    if isinstance(exc, MethodNotAllowed):
        return Response(
            _payload('METHOD_NOT_ALLOWED', f'Method "{exc.args[0]}" not allowed.'),
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    if isinstance(exc, Throttled):
        wait = int(exc.wait) if exc.wait else 60
        return Response(
            _payload('RATE_LIMITED', f'Request was throttled. Try again in {wait} seconds.', {'wait_seconds': wait}),
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    # Django DB exceptions
    if isinstance(exc, IntegrityError):
        msg = str(exc)
        logger.error('IntegrityError in %s: %s', context.get('view'), msg)
        return Response(
            _payload('INTEGRITY_ERROR', 'A database constraint was violated.', {'detail': msg[:200]}),
            status=status.HTTP_409_CONFLICT,
        )

    if isinstance(exc, DatabaseError):
        logger.exception('DatabaseError in %s', context.get('view'))
        return Response(
            _payload('DATABASE_ERROR', 'A database error occurred. Please try again later.'),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Unhandled — use DRF default or 500
    if response is not None:
        # DRF handled it but we didn't match above — wrap the existing payload
        original = response.data
        message = (
            original.get('detail', str(original))
            if isinstance(original, dict)
            else str(original)
        )
        response.data = _payload('API_ERROR', str(message))
        return response

    # Completely unknown — log and return 500
    logger.exception('Unhandled exception in %s', context.get('view'))
    return Response(
        _payload('SERVER_ERROR', 'An unexpected error occurred. Please try again later.'),
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
