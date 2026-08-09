from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SchoolViewSet, DataVerificationRequestViewSet, RankingAppealViewSet, ResourceRequestViewSet

router = DefaultRouter()
# IMPORTANT: register specific prefixes BEFORE the empty prefix.
# DRF matches URL patterns in registration order — if the empty-prefix
# SchoolViewSet comes first, its detail route ^(?P<pk>[^/.]+)/$ swallows
# 'appeals/' and 'verification-requests/' (list + create requests would
# 404 as SchoolViewSet.retrieve(pk='appeals')).
router.register(r'verification-requests', DataVerificationRequestViewSet, basename='verification-request')
router.register(r'appeals', RankingAppealViewSet, basename='ranking-appeal')
router.register(r'resource-requests', ResourceRequestViewSet, basename='resource-request')
router.register(r'', SchoolViewSet, basename='school')

urlpatterns = [
    path('', include(router.urls)),
]
