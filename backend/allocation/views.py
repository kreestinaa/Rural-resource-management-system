import logging
from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import BudgetCycle, AllocationResult, FiscalYearBudget, DiscretionaryGrant
from .serializers import (
    BudgetCycleListSerializer, BudgetCycleDetailSerializer,
    AllocationResultSerializer, AllocationRunSerializer,
    FiscalYearBudgetSerializer, DiscretionaryGrantSerializer,
)
from .algorithms.greedy import GreedyAllocator
from schools.models import School
from schools.algorithms.mcda import MCDAEngine

logger = logging.getLogger('allocation')


class AllocationResultViewSet(viewsets.GenericViewSet):
    """
    ViewSet for AllocationResult actions (disburse, disbursement_summary).
    """
    queryset = AllocationResult.objects.select_related(
        'school', 'budget_cycle')
    serializer_class = AllocationResultSerializer
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=['post'], url_path='disburse')
    def disburse(self, request, pk=None):
        """POST /api/allocation/results/{id}/disburse/"""
        err = self._require_admin(request)
        if err:
            return err
        result = self.get_object()
        if result.disbursement_status == 'disbursed':
            return Response({'error': 'Already disbursed.'}, status=status.HTTP_400_BAD_REQUEST)
        result.disbursement_status = 'disbursed'
        result.disbursed_at = timezone.now()
        result.save(update_fields=['disbursement_status', 'disbursed_at'])
        return Response(AllocationResultSerializer(result).data)

    @action(detail=False, methods=['get'], url_path='disbursement_summary')
    def disbursement_summary(self, request):
        """
        GET /api/allocation/results/disbursement_summary/
        GET /api/allocation/results/disbursement_summary/?cycle=<id>

        Without ?cycle= it reports on the most recent cycle (backwards
        compatible). With ?cycle= it reports on ANY cycle, so an admin who ran
        several cycles (e.g. one per allocation strategy) can disburse each of
        them, not only the latest.
        """
        from .models import BudgetCycle

        cycle_id = request.query_params.get('cycle')
        if cycle_id:
            cycle = BudgetCycle.objects.filter(pk=cycle_id).first()
            if not cycle:
                return Response({'error': 'Budget cycle not found.'}, status=404)
        else:
            cycle = BudgetCycle.objects.order_by('-created_at').first()

        if not cycle:
            return Response({'total': 0, 'disbursed': 0, 'pending': 0, 'cycle_id': None})

        qs = AllocationResult.objects.filter(budget_cycle=cycle)
        total = qs.count()
        disbursed = qs.filter(disbursement_status='disbursed').count()
        percentage = round(disbursed / total * 100, 1) if total else 0.0
        return Response({
            'cycle_id': cycle.id,
            'cycle_name': cycle.name,
            'cycle_strategy': cycle.allocation_strategy,
            'cycle_budget': float(cycle.total_budget),
            'total': total,
            'disbursed': disbursed,
            'pending': total - disbursed,
            'percentage': percentage,
        })


class BudgetCycleViewSet(viewsets.ModelViewSet):
    queryset = BudgetCycle.objects.all()
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        """
        Block deletion of a cycle that has actually been run.

        Deleting one would CASCADE-delete its 150 AllocationResult records and
        silently return its budget to the annual pool — destroying the financial
        audit trail. Draft cycles (never run, never spent) may still be removed.
        """
        cycle = self.get_object()
        if cycle.status != 'draft':
            return Response(
                {
                    'error': (
                        f"Cannot delete '{cycle.name}' — it has been run and its "
                        f"allocations are part of the financial record. Only draft "
                        f"cycles can be deleted."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    def get_serializer_class(self):
        if self.action == 'list':
            return BudgetCycleListSerializer
        return BudgetCycleDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='run')
    def run_allocation(self, request):
        """
        POST /api/allocation/run/
        Execute MCDA + Greedy allocation pipeline.
        """
        serializer = AllocationRunSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Annual pool (REQUIRED)
        # Every allocation cycle must draw from a fiscal-year budget. This
        # guarantees that total government spending (cycles + discretionary
        # grants) can never exceed the annual budget.
        fb_id = request.data.get('fiscal_budget')
        if fb_id:
            try:
                fiscal_budget = FiscalYearBudget.objects.get(pk=fb_id)
            except FiscalYearBudget.DoesNotExist:
                return Response(
                    {'error': 'Fiscal year budget not found.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Fall back to the active pool
            fiscal_budget = (
                FiscalYearBudget.objects
                .filter(is_active=True)
                .order_by('-fiscal_year')
                .first()
            )

        if not fiscal_budget:
            return Response(
                {
                    'error': (
                        'No annual budget found. Create a Fiscal Year Budget on the '
                        'Annual Budget page before running an allocation cycle.'
                    ),
                    'code': 'no_fiscal_budget',
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not fiscal_budget.can_afford(data['total_budget']):
            return Response(
                {
                    'error': (
                        f"Insufficient annual budget. This cycle requests NPR "
                        f"{float(data['total_budget']):,.0f} but only NPR "
                        f"{float(fiscal_budget.available):,.0f} remains in "
                        f"fiscal year {fiscal_budget.fiscal_year}."
                    ),
                    'available': float(fiscal_budget.available),
                    'requested': float(data['total_budget']),
                    'code': 'insufficient_budget',
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        weights = {
            'student_teacher_ratio': data['weight_student_teacher'],
            'infrastructure_deficit': data['weight_infrastructure'],
            'material_shortage': data['weight_materials'],
            'geographic_difficulty': data['weight_geographic'],
            'socioeconomic_index': data['weight_socioeconomic'],
        }

        try:
            # Step 1: Get schools
            schools_qs = School.objects.all()
            if data.get('province_filter'):
                schools_qs = schools_qs.filter(
                    province__in=data['province_filter'])

            if not schools_qs.exists():
                return Response(
                    {'error': 'No schools found matching criteria.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Step 2: Run MCDA
            engine = MCDAEngine(weights=weights)
            engine.update_school_priorities(schools_qs)

            ranked_schools = list(
                schools_qs.filter(priority_rank__isnull=False)
                          .order_by('priority_rank')
                          .values('id', 'priority_rank', 'priority_score', 'students', 'name')
            )

            # Step 3: Run Greedy Allocation
            allocator = GreedyAllocator(
                budget=float(data['total_budget']),
                min_alloc=float(data['min_allocation']),
                max_per_school=float(data['max_per_school']),
                strategy=data['allocation_strategy'],
            )
            allocations = allocator.allocate_resources(ranked_schools)
            summary = allocator.compute_allocation_summary(
                ranked_schools, allocations)

            # Step 4: Create BudgetCycle
            cycle = BudgetCycle.objects.create(
                name=data['name'],
                fiscal_year=data['fiscal_year'],
                fiscal_budget=fiscal_budget,
                total_budget=data['total_budget'],
                min_allocation=data['min_allocation'],
                max_per_school=data['max_per_school'],
                allocation_strategy=data['allocation_strategy'],
                weight_student_teacher=data['weight_student_teacher'],
                weight_infrastructure=data['weight_infrastructure'],
                weight_materials=data['weight_materials'],
                weight_geographic=data['weight_geographic'],
                weight_socioeconomic=data['weight_socioeconomic'],
                target_provinces=data.get('province_filter', []),
                total_allocated=Decimal(str(summary['total_allocated'])),
                schools_covered=summary['schools_covered'],
                utilization_rate=summary['utilization_rate'],
                gini_coefficient=summary['gini_coefficient'],
                status='computed',
                computed_at=timezone.now(),
                created_by=request.user,
            )

            # Step 5: Create AllocationResults
            school_map = {}
            for s in ranked_schools:
                school_map[s['id']] = s
            total_alloc = sum(float(v) for v in allocations.values())
            results_to_create = []

            for school_id, amount in allocations.items():
                school_data = school_map.get(school_id, {})
                pct = (float(amount) / total_alloc * 100) if total_alloc else 0
                amount_d = Decimal(str(amount))

                if amount_d <= data['min_allocation'] * Decimal('1.1'):
                    tier = 'minimum'
                elif amount_d >= data['max_per_school'] * Decimal('0.9'):
                    tier = 'maximum'
                elif amount_d >= data['max_per_school'] * Decimal('0.5'):
                    tier = 'priority'
                else:
                    tier = 'standard'

                results_to_create.append(AllocationResult(
                    budget_cycle=cycle,
                    school_id=school_id,
                    priority_rank=school_data.get('priority_rank', 0),
                    priority_score=school_data.get('priority_score', 0),
                    allocated_amount=amount_d,
                    allocation_pct=round(pct, 4),
                    allocation_strategy=data['allocation_strategy'],
                    fairness_score=round(1 - summary['gini_coefficient'], 4),
                    allocation_tier=tier,
                ))

            AllocationResult.objects.bulk_create(
                results_to_create, batch_size=100)

            # Step 6: Audit log
            try:
                from audit.models import AuditLog
                AuditLog.log(
                    user=request.user,
                    action='allocation_cycle_created',
                    model_name='BudgetCycle',
                    object_id=cycle.id,
                    details={
                        'name': cycle.name,
                        'fiscal_year': cycle.fiscal_year,
                        'schools_covered': summary['schools_covered'],
                        'total_allocated': str(summary['total_allocated']),
                    },
                    request=request,
                )
            except Exception:
                pass

            # Step 7: Broadcast notification to all school users
            try:
                from notifications.models import Notification
                from schools.models import SchoolUser
                from django.contrib.auth.models import User as AuthUser

                school_user_ids = SchoolUser.objects.values_list(
                    'user_id', flat=True)
                recipients = AuthUser.objects.filter(id__in=school_user_ids)
                notifs = []
                for u in recipients:
                    notifs.append(Notification(
                        recipient=u,
                        title=f"Allocation Results: {cycle.name}",
                        message=(
                            f"Budget cycle '{cycle.name}' (FY {cycle.fiscal_year}) "
                            f"has been computed. NPR {float(cycle.total_allocated):,.0f} "
                            f"allocated to {cycle.schools_covered} schools."
                        ),
                        type='allocation_result',
                    ))
                Notification.objects.bulk_create(notifs, batch_size=200)
            except Exception:
                pass

            logger.info(
                f"Allocation '{cycle.name}' complete. "
                f"{summary['schools_covered']} schools, "
                f"NPR {summary['total_allocated']:,.0f} allocated."
            )

            return Response({
                'success': True,
                'cycle_id': cycle.id,
                'summary': summary,
                'message': (
                    f"Allocation completed for {summary['schools_covered']} schools. "
                    f"Utilization: {summary['utilization_rate']}%"
                ),
            }, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Allocation failed: {e}", exc_info=True)
            return Response(
                {'error': 'Allocation failed. Check server logs.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'], url_path='results')
    def cycle_results(self, request, pk=None):
        """GET /api/allocation/cycles/{id}/results/"""
        cycle = self.get_object()
        results = AllocationResult.objects.filter(
            budget_cycle=cycle
        ).select_related('school').order_by('priority_rank')

        province = request.query_params.get('province')
        if province:
            results = results.filter(school__province=province)

        page = self.paginate_queryset(results)
        if page is not None:
            serializer = AllocationResultSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = AllocationResultSerializer(results, many=True)
        return Response({'results': serializer.data})

    @action(detail=False, methods=['get'], url_path='compare')
    def compare_cycles(self, request):
        """GET /api/allocation/compare/?ids=1,2,3"""
        ids_param = request.query_params.get('ids', '')
        cycle_ids = []
        try:
            for x in ids_param.split(','):
                if x:
                    cycle_ids.append(int(x))
        except ValueError:
            return Response({'error': 'Invalid cycle IDs.'}, status=400)

        cycles = BudgetCycle.objects.filter(id__in=cycle_ids)
        serializer = BudgetCycleListSerializer(cycles, many=True)
        return Response({'cycles': serializer.data})


class FiscalYearBudgetViewSet(viewsets.ModelViewSet):
    """
    The annual budget pool. Budget cycles and discretionary grants both draw
    from it, and the API exposes a live balance so the admin can always see
    what remains.
    """
    queryset = FiscalYearBudget.objects.all()
    serializer_class = FiscalYearBudgetSerializer
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin required.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def create(self, request, *args, **kwargs):
        err = self._require_admin(request)
        if err:
            return err
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        err = self._require_admin(request)
        if err:
            return err
        # Cannot shrink the pool below what has already been committed
        instance = self.get_object()
        new_total = request.data.get('total_amount')
        if new_total is not None and Decimal(str(new_total)) < instance.spent:
            return Response(
                {'error': f'Cannot reduce below committed spend of NPR {float(instance.spent):,.0f}.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Block deletion of an annual budget that has already been spent against.

        Deleting one would CASCADE-delete every DiscretionaryGrant made from it
        and detach its cycles — destroying the financial record. Only an untouched
        pool (nothing allocated, nothing granted) can be removed.
        """
        err = self._require_admin(request)
        if err:
            return err

        fb = self.get_object()
        if fb.spent > 0:
            return Response(
                {
                    'error': (
                        f"Cannot delete fiscal year {fb.fiscal_year} — NPR "
                        f"{float(fb.spent):,.0f} has already been committed from it "
                        f"({fb.cycles.exclude(status='draft').count()} cycles, "
                        f"{fb.discretionary_grants.count()} grants). Deleting it would "
                        f"destroy the financial record."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='grants/(?P<grant_id>[^/.]+)/disburse')
    def disburse_grant(self, request, grant_id=None):
        """
        POST /api/allocation/fiscal-budgets/grants/<id>/disburse/

        Mark a discretionary grant as disbursed. Mirrors the two-stage flow used
        for algorithmic allocations: granting the money and actually releasing
        it are separate, auditable steps.
        """
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({'error': 'Admin required.'}, status=status.HTTP_403_FORBIDDEN)

        grant = DiscretionaryGrant.objects.filter(pk=grant_id).first()
        if not grant:
            return Response({'error': 'Grant not found.'}, status=status.HTTP_404_NOT_FOUND)
        if grant.disbursement_status == 'disbursed':
            return Response({'error': 'Already disbursed.'}, status=status.HTTP_400_BAD_REQUEST)

        grant.disbursement_status = 'disbursed'
        grant.disbursed_at = timezone.now()
        grant.save(update_fields=['disbursement_status', 'disbursed_at'])

        return Response(DiscretionaryGrantSerializer(grant).data)

    @action(detail=False, methods=['get'], url_path='my-grants')
    def my_grants(self, request):
        """
        GET /api/allocation/fiscal-budgets/my-grants/

        Discretionary grants awarded to the logged-in user's school (from
        approved resource-request letters). Admins get every grant.
        Without this, a school was notified that money had been granted but
        could not see it anywhere in the app.
        """
        qs = DiscretionaryGrant.objects.select_related(
            'school', 'resource_request', 'fiscal_budget'
        )
        if not (request.user.is_staff or request.user.is_superuser):
            try:
                school = request.user.school_profile.school
            except Exception:
                return Response({'count': 0, 'results': []})
            qs = qs.filter(school=school)

        return Response({
            'count': qs.count(),
            'total_granted': float(sum(g.amount for g in qs)) if qs.exists() else 0.0,
            'results': DiscretionaryGrantSerializer(qs, many=True).data,
        })

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        """GET /api/allocation/fiscal-budgets/active/ — the current pool + balance."""
        fb = FiscalYearBudget.objects.filter(
            is_active=True).order_by('-fiscal_year').first()
        if not fb:
            return Response({'error': 'No active fiscal year budget.'}, status=404)
        return Response(FiscalYearBudgetSerializer(fb).data)

    @action(detail=True, methods=['get'], url_path='breakdown')
    def breakdown(self, request, pk=None):
        """Full ledger: every cycle and every discretionary grant."""
        fb = self.get_object()
        cycles = fb.cycles.exclude(status='draft').order_by('-created_at')
        grants = fb.discretionary_grants.select_related(
            'school', 'resource_request')

        cycle_list = []
        for c in cycles:
            cycle_list.append({
                'id': c.id, 'name': c.name, 'status': c.status,
                'amount': float(c.total_budget),
                'schools_covered': c.schools_covered,
                'created_at': c.created_at,
            })

        return Response({
            'fiscal_year': fb.fiscal_year,
            'total_amount': float(fb.total_amount),
            'allocated_by_cycles': float(fb.allocated_by_cycles),
            'granted_by_requests': float(fb.granted_by_requests),
            'spent': float(fb.spent),
            'available': float(fb.available),
            'cycles': cycle_list,
            'grants': DiscretionaryGrantSerializer(grants, many=True).data,
        })
