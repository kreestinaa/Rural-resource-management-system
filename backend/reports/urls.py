from django.urls import path
from .views import AllocationCSVView, SchoolsCSVView, AllocationSummaryView

urlpatterns = [
    path('allocation/<int:cycle_id>/csv/', AllocationCSVView.as_view(), name='report-allocation-csv'),
    path('schools/csv/', SchoolsCSVView.as_view(), name='report-schools-csv'),
    path('summary/<int:cycle_id>/', AllocationSummaryView.as_view(), name='report-summary'),
]
