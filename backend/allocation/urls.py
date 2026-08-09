from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BudgetCycleViewSet, AllocationResultViewSet, FiscalYearBudgetViewSet

router = DefaultRouter()
router.register(r'fiscal-budgets', FiscalYearBudgetViewSet, basename='fiscal-budget')
router.register(r'cycles', BudgetCycleViewSet, basename='budget-cycle')
router.register(r'results', AllocationResultViewSet, basename='allocation-result')

urlpatterns = [
    path('', include(router.urls)),
]
