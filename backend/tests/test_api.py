"""
Integration tests for key API endpoints.

Tests cover:
- Login flow (success, wrong password, lockout)
- School registration (missing fields, duplicate, school not found)
- /api/schools/stats/ (admin access, data shape)
- /api/schools/rankings/ (listing, ordering)
- School data isolation (school user can only see own data)
- MCDA compute endpoint (admin only)
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from schools.models import School, SchoolUser


def _make_school(emis='NP00001', name='Test School', province='bagmati',
                 district='Kathmandu'):
    return School.objects.create(
        name=name, emis=emis, province=province, district=district,
        students=200, teachers=8,
        student_teacher_ratio=50, infrastructure_deficit=60,
        material_shortage=55, geographic_difficulty=40, socioeconomic_index=45,
    )


def _token_for(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class LoginViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='np_test', password='SecurePass1'
        )

    def test_successful_login_returns_tokens(self):
        resp = self.client.post('/api/auth/login/', {
            'username': 'np_test', 'password': 'SecurePass1'
        })
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)

    def test_wrong_password_returns_401(self):
        resp = self.client.post('/api/auth/login/', {
            'username': 'np_test', 'password': 'WrongPass1'
        })
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data['code'], 'INVALID_CREDENTIALS')

    def test_missing_credentials_returns_400(self):
        resp = self.client.post('/api/auth/login/', {'username': 'np_test'})
        self.assertEqual(resp.status_code, 400)

    def test_account_lockout_after_max_attempts(self):
        from django.conf import settings
        max_attempts = getattr(settings, 'LOGIN_MAX_ATTEMPTS', 5)
        for _ in range(max_attempts):
            self.client.post('/api/auth/login/', {
                'username': 'np_test', 'password': 'WrongPass1'
            })
        # Next attempt should be locked
        resp = self.client.post('/api/auth/login/', {
            'username': 'np_test', 'password': 'WrongPass1'
        })
        self.assertEqual(resp.status_code, 423)
        self.assertEqual(resp.data['code'], 'ACCOUNT_LOCKED')

    def test_correct_login_after_failed_attempts_clears_lockout(self):
        from django.core.cache import cache
        from schools.auth_views import _lockout_key
        # Pre-seed 3 failed attempts
        cache.set(_lockout_key('np_test'), 3, 900)
        resp = self.client.post('/api/auth/login/', {
            'username': 'np_test', 'password': 'SecurePass1'
        })
        self.assertEqual(resp.status_code, 200)
        # Lockout counter should be cleared
        self.assertIsNone(cache.get(_lockout_key('np_test')))


class RegisterViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.school = _make_school()

    def test_successful_registration(self):
        resp = self.client.post('/api/auth/register/', {
            'username': 'principal1',
            'password': 'Secure1234',
            'email': 'p@school.edu.np',
            'emis': 'NP00001',
            'role': 'principal',
        })
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data['success'])

    def test_missing_username_returns_400(self):
        resp = self.client.post('/api/auth/register/', {
            'password': 'Secure1234', 'emis': 'NP00001'
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['code'], 'MISSING_FIELD')

    def test_invalid_emis_format(self):
        resp = self.client.post('/api/auth/register/', {
            'username': 'user1', 'password': 'Secure1234', 'emis': 'BADCODE'
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['code'], 'INVALID_EMIS')

    def test_weak_password_rejected(self):
        resp = self.client.post('/api/auth/register/', {
            'username': 'user1', 'password': 'short', 'emis': 'NP00001'
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['code'], 'WEAK_PASSWORD')

    def test_school_not_found_returns_404(self):
        resp = self.client.post('/api/auth/register/', {
            'username': 'user1', 'password': 'Secure1234', 'emis': 'NP99999'
        })
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.data['code'], 'SCHOOL_NOT_FOUND')

    def test_duplicate_school_account_rejected(self):
        existing_user = User.objects.create_user(username='existing', password='Pass1234')
        SchoolUser.objects.create(user=existing_user, school=self.school)
        resp = self.client.post('/api/auth/register/', {
            'username': 'newuser', 'password': 'Secure1234', 'emis': 'NP00001'
        })
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['code'], 'SCHOOL_ACCOUNT_EXISTS')


class SchoolStatsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin', password='Admin1234', is_staff=True
        )
        for i in range(1, 6):
            _make_school(emis=f'NP0000{i}', name=f'School {i}',
                         district=f'District {i}')

    def test_stats_requires_authentication(self):
        resp = self.client.get('/api/schools/stats/')
        self.assertEqual(resp.status_code, 401)

    def test_stats_returns_required_fields(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(self.admin)}')
        resp = self.client.get('/api/schools/stats/')
        self.assertEqual(resp.status_code, 200)
        for key in ('total_schools', 'total_students', 'total_teachers',
                    'province_breakdown', 'budget_allocated_ytd'):
            self.assertIn(key, resp.data)

    def test_stats_total_schools_correct(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(self.admin)}')
        resp = self.client.get('/api/schools/stats/')
        self.assertEqual(resp.data['total_schools'], 5)


class SchoolRankingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin2', password='Admin1234', is_staff=True
        )
        for i in range(1, 4):
            s = _make_school(emis=f'NP1000{i}', name=f'Ranked School {i}')
            s.priority_rank = i
            s.priority_score = round(1.0 - i * 0.1, 2)
            s.save()

    def test_rankings_returns_only_ranked_schools(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(self.admin)}')
        resp = self.client.get('/api/schools/rankings/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 3)

    def test_rankings_ordered_by_rank(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(self.admin)}')
        resp = self.client.get('/api/schools/rankings/')
        ranks = [s['priority_rank'] for s in resp.data['results']]
        self.assertEqual(ranks, sorted(ranks))

    def test_rankings_limit_param(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(self.admin)}')
        resp = self.client.get('/api/schools/rankings/?limit=2')
        self.assertEqual(resp.status_code, 200)
        self.assertLessEqual(len(resp.data['results']), 2)


class SchoolDataIsolationTests(TestCase):
    """School users should only see their own school's detail data."""

    def setUp(self):
        self.client = APIClient()
        self.school_a = _make_school(emis='NP20001', name='School A')
        self.school_b = _make_school(emis='NP20002', name='School B')

        self.user_a = User.objects.create_user(username='user_a', password='Pass1234')
        SchoolUser.objects.create(user=self.user_a, school=self.school_a)

    def test_school_user_can_access_own_profile(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(self.user_a)}')
        resp = self.client.get('/api/schools/my-profile/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['emis'], 'NP20001')

    def test_me_endpoint_returns_school_info(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(self.user_a)}')
        resp = self.client.get('/api/auth/me/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['role'], 'school')
        self.assertEqual(resp.data['school']['emis'], 'NP20001')


class MCDAComputeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin3', password='Admin1234', is_staff=True
        )
        self.school_user = User.objects.create_user(
            username='school3', password='Pass1234'
        )
        for i in range(1, 6):
            _make_school(emis=f'NP3000{i}', name=f'MCDA School {i}')

    def test_compute_rankings_requires_auth(self):
        resp = self.client.post('/api/schools/rankings/compute', {})
        self.assertIn(resp.status_code, [401, 403])

    def test_admin_can_compute_rankings(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(self.admin)}')
        resp = self.client.post('/api/schools/rankings/compute', {}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data.get('success'))

    def test_invalid_weights_return_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {_token_for(self.admin)}')
        resp = self.client.post('/api/schools/rankings/compute', {
            'weight_student_teacher': 0.1,
            'weight_infrastructure': 0.1,
            'weight_materials': 0.1,
            'weight_geographic': 0.1,
            'weight_socioeconomic': 0.1,  # sum = 0.5, not 1.0
        }, format='json')
        self.assertEqual(resp.status_code, 400)
