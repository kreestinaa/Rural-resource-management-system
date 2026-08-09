"""
Authentication views for school user registration and profile.

Includes:
- Input validation (password strength, EMIS format, email)
- Account lockout after repeated failed login attempts
- Consistent error response format
"""
import re
import string
import logging
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.cache import cache
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from schools.models import School, SchoolUser

logger = logging.getLogger('schools')

_EMIS_RE = re.compile(r'^NP\d{5}$', re.IGNORECASE)
_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
_PASSWORD_MIN_LEN = 8

_MAX_ATTEMPTS = getattr(settings, 'LOGIN_MAX_ATTEMPTS', 5)
_LOCKOUT_SECONDS = getattr(settings, 'LOGIN_LOCKOUT_MINUTES', 15) * 60


def _lockout_key(identifier):
    """Cache key for login attempt tracking."""
    return f'login_attempts:{identifier}'


def _err(message, code, field=None):
    """Return a consistent error response dict."""
    payload = {'error': message, 'code': code}
    if field:
        payload['field'] = field
    return payload


def _validate_password(password):
    """
    Validate password strength for school user registration.

    Requirements:
      - at least 8 characters
      - at least one UPPERCASE letter
      - at least one lowercase letter
      - at least one digit
      - at least one symbol (e.g. ! @ # $ % & *)

    Returns an error message if invalid, otherwise None.
    """
    if len(password) < _PASSWORD_MIN_LEN:
        return f'Password must be at least {_PASSWORD_MIN_LEN} characters.'
    if not any(c.isupper() for c in password):
        return 'Password must contain at least one uppercase letter (A–Z).'
    if not any(c.islower() for c in password):
        return 'Password must contain at least one lowercase letter (a–z).'
    if not any(c.isdigit() for c in password):
        return 'Password must contain at least one digit (0–9).'
    if not any(c in string.punctuation for c in password):
        return 'Password must contain at least one symbol (e.g. ! @ # $ % & *).'
    return None


def _validate_emis(emis):
    """Validate EMIS code format (NP + 5 digits). Returns error message or None."""
    if not _EMIS_RE.match(emis):
        return 'EMIS must match the pattern NP followed by 5 digits (e.g. NP12345).'
    return None


def _validate_email(email):
    """Basic email format validation. Returns error message or None."""
    if email and not _EMAIL_RE.match(email):
        return 'Enter a valid email address.'
    return None


class LoginView(APIView):
    """
    POST /api/auth/login/

    Custom login endpoint that enforces account lockout after repeated
    failed attempts (configurable via LOGIN_MAX_ATTEMPTS / LOGIN_LOCKOUT_MINUTES).

    Returns JWT access + refresh tokens on success.

    Responses:
        200: Tokens + user info.
        400: Missing credentials.
        401: Invalid credentials.
        423: Account locked out.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()

        if not username or not password:
            return Response(
                _err('Username and password are required.', 'MISSING_FIELD'),
                status=status.HTTP_400_BAD_REQUEST,
            )

        key = _lockout_key(username)
        attempts = cache.get(key, 0)

        if attempts >= _MAX_ATTEMPTS:
            remaining = _LOCKOUT_SECONDS // 60
            logger.warning('Login blocked (lockout) for username=%s', username)
            return Response(
                _err(
                    f'Account locked due to too many failed attempts. '
                    f'Try again in {remaining} minutes.',
                    'ACCOUNT_LOCKED',
                ),
                status=status.HTTP_423_LOCKED,
            )

        user = authenticate(request, username=username, password=password)

        if user is None:
            new_attempts = attempts + 1
            cache.set(key, new_attempts, timeout=_LOCKOUT_SECONDS)
            remaining_attempts = _MAX_ATTEMPTS - new_attempts
            logger.warning(
                'Failed login attempt %d/%d for username=%s',
                new_attempts, _MAX_ATTEMPTS, username,
            )
            if remaining_attempts <= 0:
                return Response(
                    _err(
                        f'Account locked due to too many failed attempts. '
                        f'Try again in {_LOCKOUT_SECONDS // 60} minutes.',
                        'ACCOUNT_LOCKED',
                    ),
                    status=status.HTTP_423_LOCKED,
                )
            return Response(
                _err(
                    f'Invalid credentials. {remaining_attempts} attempt(s) remaining.',
                    'INVALID_CREDENTIALS',
                ),
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Successful login — clear lockout counter
        cache.delete(key)
        refresh = RefreshToken.for_user(user)
        logger.info('Successful login for username=%s', username)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_staff': user.is_staff,
            },
        })


class RegisterSchoolUserView(APIView):
    """
    POST /api/auth/register/

    Register a new school user account, linking it to a School via EMIS code.

    Request body::

        {
            "username": "np12345",
            "password": "Secure1234",
            "email": "principal@school.edu.np",
            "emis": "NP12345",
            "role": "principal"
        }

    Responses:
        201: Account created successfully.
        400: Validation error (username taken, weak password, etc.).
        404: No school found with given EMIS.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        """Handle school user registration with full input validation."""
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()
        email = request.data.get('email', '').strip()
        emis = request.data.get('emis', '').strip().upper()
        role = request.data.get('role', 'principal')

        # Required fields
        if not username:
            return Response(
                _err('Username is required.', 'MISSING_FIELD', 'username'),
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not password:
            return Response(
                _err('Password is required.', 'MISSING_FIELD', 'password'),
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not emis:
            return Response(
                _err('EMIS code is required.', 'MISSING_FIELD', 'emis'),
                status=status.HTTP_400_BAD_REQUEST,
            )

        # EMIS format
        emis_err = _validate_emis(emis)
        if emis_err:
            return Response(
                _err(emis_err, 'INVALID_EMIS', 'emis'),
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Password strength
        pw_err = _validate_password(password)
        if pw_err:
            return Response(
                _err(pw_err, 'WEAK_PASSWORD', 'password'),
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Email format
        email_err = _validate_email(email)
        if email_err:
            return Response(
                _err(email_err, 'INVALID_EMAIL', 'email'),
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Username uniqueness
        if User.objects.filter(username=username).exists():
            return Response(
                _err('Username is already taken.', 'USERNAME_TAKEN', 'username'),
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Locate school
        try:
            school = School.objects.get(emis=emis)
        except School.DoesNotExist:
            return Response(
                _err(f'No school found with EMIS code: {emis}', 'SCHOOL_NOT_FOUND', 'emis'),
                status=status.HTTP_404_NOT_FOUND,
            )

        # One account per school
        if SchoolUser.objects.filter(school=school).exists():
            return Response(
                _err('This school already has a registered account.', 'SCHOOL_ACCOUNT_EXISTS', 'emis'),
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create
        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=school.name[:30],
        )
        SchoolUser.objects.create(user=user, school=school, role=role)

        logger.info('New school account created: username=%s school=%s', username, school.emis)

        return Response(
            {
                'success': True,
                'message': f'Account created for {school.name}.',
                'username': username,
                'school': school.name,
                'emis': school.emis,
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    """
    GET /api/auth/me/

    Returns current user info and role (admin or school).
    Used by the frontend to decide which dashboard to render.

    Responses:
        200: User profile JSON.
        401: Not authenticated.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return profile of the currently authenticated user."""
        user = request.user

        if user.is_staff or user.is_superuser:
            return Response({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': 'admin',
                'school': None,
            })

        try:
            school_profile = user.school_profile
            school = school_profile.school
            return Response({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': 'school',
                'school_role': school_profile.role,
                'school': {
                    'id': school.id,
                    'name': school.name,
                    'emis': school.emis,
                    'province': school.province,
                    'district': school.district,
                    'priority_rank': school.priority_rank,
                    'priority_score': school.priority_score,
                    'students': school.students,
                    'teachers': school.teachers,
                    'classrooms': school.classrooms,
                    'female_students': school.female_students,
                    'female_teachers': school.female_teachers,
                    'male_students': school.male_students,
                    'male_teachers': school.male_teachers,
                    'student_teacher_ratio': school.student_teacher_ratio,
                    'infrastructure_deficit': school.infrastructure_deficit,
                    'material_shortage': school.material_shortage,
                    'geographic_difficulty': school.geographic_difficulty,
                    'socioeconomic_index': school.socioeconomic_index,
                    'improvement_score': school.improvement_score,
                    'ranking_history': school.ranking_history,
                    'last_ranking_date': school.last_ranking_date,
                    'teacher_demand': school.teacher_demand,
                },
            })
        except Exception:
            return Response({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': 'unknown',
                'school': None,
            })
