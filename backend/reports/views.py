import csv
from django.http import HttpResponse, JsonResponse
from django.db.models import Avg, Sum, Count
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from allocation.models import BudgetCycle, AllocationResult
from schools.models import School


class AllocationCSVView(APIView):
    """GET /api/reports/allocation/{cycle_id}/csv/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, cycle_id):
        try:
            cycle = BudgetCycle.objects.get(pk=cycle_id)
        except BudgetCycle.DoesNotExist:
            return Response({'error': 'Cycle not found.'}, status=404)

        results = (
            AllocationResult.objects
            .filter(budget_cycle=cycle)
            .select_related('school')
            .order_by('priority_rank')
        )

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="allocation_{cycle.fiscal_year}_{cycle.id}.csv"'
        )

        writer = csv.writer(response)
        writer.writerow([
            'Rank', 'School Name', 'EMIS', 'Province', 'District',
            'Students', 'Priority Score', 'Allocated Amount (NPR)',
            'Allocation %', 'Tier', 'Strategy',
        ])
        for r in results:
            writer.writerow([
                r.priority_rank,
                r.school.name,
                r.school.emis,
                r.school.province,
                r.school.district,
                r.school.students,
                round(r.priority_score, 4),
                float(r.allocated_amount),
                round(r.allocation_pct, 2),
                r.allocation_tier,
                r.allocation_strategy,
            ])
        return response


class SchoolsCSVView(APIView):
    """GET /api/reports/schools/csv/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        schools = School.objects.all().order_by('priority_rank', 'name')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="schools_rankings.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Name', 'EMIS', 'Province', 'District', 'School Type',
            'Rural', 'Students', 'Teachers', 'Classrooms',
            'Female Students', 'Female Teachers',
            'S:T Ratio', 'Infrastructure Deficit', 'Material Shortage',
            'Geographic Difficulty', 'Socioeconomic Index',
            'Priority Score', 'Priority Rank', 'Last Ranked',
        ])
        for s in schools:
            writer.writerow([
                s.id, s.name, s.emis, s.province, s.district,
                s.school_type, s.is_rural, s.students, s.teachers,
                s.classrooms, s.female_students, s.female_teachers,
                s.student_teacher_ratio, s.infrastructure_deficit,
                s.material_shortage, s.geographic_difficulty,
                s.socioeconomic_index,
                round(s.priority_score, 4), s.priority_rank,
                s.last_ranking_date.isoformat() if s.last_ranking_date else '',
            ])
        return response


class AllocationSummaryView(APIView):
    """GET /api/reports/summary/{cycle_id}/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, cycle_id):
        try:
            cycle = BudgetCycle.objects.get(pk=cycle_id)
        except BudgetCycle.DoesNotExist:
            return Response({'error': 'Cycle not found.'}, status=404)

        results = AllocationResult.objects.filter(budget_cycle=cycle).select_related('school')

        tier_dist = {}
        for r in results:
            tier_dist[r.allocation_tier] = tier_dist.get(r.allocation_tier, 0) + 1

        province_dist = (
            results.values('school__province')
                   .annotate(
                       count=Count('id'),
                       total_allocated=Sum('allocated_amount'),
                       avg_allocated=Avg('allocated_amount'),
                   )
                   .order_by('school__province')
        )

        top5 = results.order_by('priority_rank')[:5]
        top5_data = []
        for r in top5:
            top5_data.append({
                'rank': r.priority_rank,
                'school': r.school.name,
                'emis': r.school.emis,
                'district': r.school.district,
                'allocated': float(r.allocated_amount),
                'score': r.priority_score,
            })

        return Response({
            'cycle': {
                'id': cycle.id,
                'name': cycle.name,
                'fiscal_year': cycle.fiscal_year,
                'status': cycle.status,
                'total_budget': float(cycle.total_budget),
                'total_allocated': float(cycle.total_allocated),
                'schools_covered': cycle.schools_covered,
                'utilization_rate': cycle.utilization_rate,
                'gini_coefficient': cycle.gini_coefficient,
                'strategy': cycle.allocation_strategy,
                'computed_at': cycle.computed_at.isoformat() if cycle.computed_at else None,
            },
            'tier_distribution': tier_dist,
            'province_distribution': list(province_dist),
            'top_5_schools': top5_data,
        })
