import csv
import io
import logging
from django.core.cache import cache
from django.db.models import Avg, Count, Sum, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from ..models import School, SchoolUser, ReviewRequest, DistrictAdmin
from ..serializers import (
    SchoolListSerializer, SchoolDetailSerializer,
    SchoolRankingSerializer, MCDAWeightSerializer,
    ReviewRequestSerializer, SchoolProfileUpdateSerializer,
)
from ..algorithms.mcda import MCDAEngine

logger = logging.getLogger('schools')

CSV_FIELDS = [
    'name', 'emis', 'province', 'district', 'students', 'teachers',
    'student_teacher_ratio', 'infrastructure_deficit', 'material_shortage',
    'geographic_difficulty', 'socioeconomic_index',
]


def get_school_queryset_for_user(request):
    qs = School.objects.select_related('user_account__user')
    if request.user.is_staff or request.user.is_superuser:
        return qs
    try:
        da = DistrictAdmin.objects.get(user=request.user)
        if da.provinces:
            qs = qs.filter(province__in=da.provinces)
        if da.districts:
            qs = qs.filter(district__in=da.districts)
        return qs
    except DistrictAdmin.DoesNotExist:
        pass
    return qs


class SchoolViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['province', 'district', 'school_type', 'is_rural']
    search_fields = ['name', 'emis', 'district', 'municipality']
    ordering_fields = ['priority_rank', 'priority_score', 'students', 'name', 'created_at']
    ordering = ['priority_rank']

    def get_queryset(self):
        return get_school_queryset_for_user(self.request)

    def get_serializer_class(self):
        if self.action == 'list':
            return SchoolListSerializer
        if self.action in ['rankings', 'compute_rankings']:
            return SchoolRankingSerializer
        return SchoolDetailSerializer

    @action(detail=False, methods=['get'], url_path='rankings')
    def rankings(self, request):
        limit_raw = request.query_params.get('limit', '')
        province = request.query_params.get('province', '')
        district = request.query_params.get('district', '')
        search = request.query_params.get('search', '')
        # Version-stamped cache key: bumping 'rankings_version' on recompute
        # instantly invalidates EVERY cached filter combination. (The old code
        # tried to delete a fixed list of keys that never matched the real key
        # format, so stale "0 schools" results were served after computing.)
        version = cache.get('rankings_version', 1)
        cache_key = f'school_rankings:v{version}:{limit_raw}:{province}:{district}:{search}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        queryset = self.filter_queryset(
            self.get_queryset().filter(priority_rank__isnull=False).order_by('priority_rank')
        )
        # Apply explicit filters (the params were read but never applied — bug fix)
        if province:
            queryset = queryset.filter(province=province)
        if district:
            queryset = queryset.filter(district__iexact=district)
        if search:
            queryset = queryset.filter(name__icontains=search)
        if limit_raw:
            try:
                queryset = queryset[:int(limit_raw)]
            except ValueError:
                pass
        serializer = SchoolRankingSerializer(queryset, many=True)
        result = {'count': len(serializer.data), 'results': serializer.data}
        cache.set(cache_key, result, timeout=120)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='rankings/compute')
    def compute_rankings(self, request):
        weights = None
        if request.data:
            weight_serializer = MCDAWeightSerializer(data=request.data)
            if not weight_serializer.is_valid():
                return Response(weight_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            d = weight_serializer.validated_data
            weights = {
                'student_teacher_ratio': d['weight_student_teacher'],
                'infrastructure_deficit': d['weight_infrastructure'],
                'material_shortage': d['weight_materials'],
                'geographic_difficulty': d['weight_geographic'],
                'socioeconomic_index': d['weight_socioeconomic'],
            }
        try:
            engine = MCDAEngine(weights=weights)
            schools_qs = School.objects.all()
            updated = engine.update_school_priorities(schools_qs)

            # Invalidate every cached ranking response AFTER the new ranks are
            # saved, by bumping the version stamp used in the cache key.
            cache.set('rankings_version', cache.get('rankings_version', 1) + 1, None)

            return Response({
                'success': True,
                'message': f'MCDA ranking computed for {len(updated)} schools.',
                'weights_used': engine.weights,
                'top_10': updated[:10],
            }, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"MCDA computation failed: {e}", exc_info=True)
            return Response({'error': 'MCDA computation failed.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='districts')
    def districts(self, request):
        province_filter = request.query_params.get('province', '')
        cache_key = f'school_districts:{province_filter}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        qs = self.get_queryset()
        if province_filter:
            qs = qs.filter(province=province_filter)
        districts = list(
            qs.values('district', 'province')
              .annotate(
                  school_count=Count('id'),
                  avg_priority_score=Avg('priority_score'),
                  avg_students=Avg('students'),
                  rural_count=Count('id', filter=Q(is_rural=True)),
              )
              .order_by('province', 'district')
        )
        result = {'count': len(districts), 'results': districts}
        cache.set(cache_key, result, timeout=600)
        return Response(result)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        cache_key = 'school_stats'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        qs = get_school_queryset_for_user(request)
        total = qs.count()
        ranked = qs.filter(priority_rank__isnull=False).count()

        agg = qs.aggregate(total_students=Sum('students'), total_teachers=Sum('teachers'))
        total_students = agg['total_students'] or 0
        total_teachers = agg['total_teachers'] or 0
        avg_str = round(total_students / total_teachers, 1) if total_teachers else 0

        province_stats = list(
            qs.values('province').annotate(count=Count('id'), avg_score=Avg('priority_score')).order_by('province')
        )
        rural_count = qs.filter(is_rural=True).count()
        urban_count = qs.filter(is_rural=False).count()
        schools_no_rank = qs.filter(priority_rank__isnull=True).count()

        province_tier_dist = {}
        for prov in qs.values_list('province', flat=True).distinct():
            prov_qs = qs.filter(province=prov, priority_rank__isnull=False)
            province_tier_dist[prov] = {
                'critical': prov_qs.filter(priority_rank__lte=10).count(),
                'high':     prov_qs.filter(priority_rank__gt=10, priority_rank__lte=50).count(),
                'medium':   prov_qs.filter(priority_rank__gt=50, priority_rank__lte=100).count(),
                'low':      prov_qs.filter(priority_rank__gt=100).count(),
            }

        schools_improved = qs.filter(improvement_score__gt=0).count()

        from allocation.models import BudgetCycle
        cycles = BudgetCycle.objects.order_by('-created_at')[:5].values(
            'id', 'name', 'fiscal_year', 'total_allocated', 'schools_covered', 'gini_coefficient', 'status', 'created_at'
        )
        allocation_history = list(cycles)

        top_priority = SchoolRankingSerializer(
            qs.filter(priority_rank__isnull=False).order_by('priority_rank')[:5], many=True
        ).data

        budget_ytd = BudgetCycle.objects.filter(status__in=['computed', 'approved', 'disbursed'])\
            .aggregate(total=Sum('total_allocated'))['total'] or 0
        avg_gini = BudgetCycle.objects.filter(status__in=['computed', 'approved', 'disbursed'])\
            .aggregate(avg=Avg('gini_coefficient'))['avg'] or 0

        payload = {
            'total_schools': total,
            'ranked_schools': ranked,
            'total_students': total_students,
            'total_teachers': total_teachers,
            'avg_student_teacher_ratio': avg_str,
            'rural_count': rural_count,
            'urban_count': urban_count,
            'schools_with_no_ranking': schools_no_rank,
            'schools_improved_this_cycle': schools_improved,
            'province_breakdown': province_stats,
            'province_ranking_distribution': province_tier_dist,
            'allocation_history': allocation_history,
            'top_priority_schools': top_priority,
            'budget_allocated_ytd': float(budget_ytd),
            'avg_gini_coefficient': round(float(avg_gini), 4),
        }
        cache.set(cache_key, payload, timeout=300)
        return Response(payload)

    @action(detail=True, methods=['get'], url_path='history')
    def ranking_history(self, request, pk=None):
        school = self.get_object()
        return Response({
            'school_id': school.id,
            'name': school.name,
            'current_rank': school.priority_rank,
            'current_score': school.priority_score,
            'history': school.ranking_history,
        })

    @action(detail=False, methods=['get', 'put'], url_path='my-profile')
    def my_profile(self, request):
        try:
            school_user = request.user.school_profile
        except SchoolUser.DoesNotExist:
            return Response({'error': 'No school linked to your account.'}, status=404)
        school = school_user.school

        if request.method == 'GET':
            return Response(SchoolDetailSerializer(school).data)

        serializer = SchoolProfileUpdateSerializer(school, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(SchoolDetailSerializer(school).data)

    @action(detail=False, methods=['post'], url_path='request-review')
    def request_review(self, request):
        try:
            school_user = request.user.school_profile
        except SchoolUser.DoesNotExist:
            return Response({'error': 'No school linked to your account.'}, status=404)

        note = request.data.get('note', '').strip()
        if not note:
            return Response({'error': 'Note is required.'}, status=status.HTTP_400_BAD_REQUEST)

        review = ReviewRequest.objects.create(school=school_user.school, note=note)
        return Response(ReviewRequestSerializer(review).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-review-requests')
    def my_review_requests(self, request):
        try:
            school_user = request.user.school_profile
        except SchoolUser.DoesNotExist:
            return Response({'error': 'No school linked.'}, status=404)

        reviews = ReviewRequest.objects.filter(school=school_user.school)
        return Response({'count': reviews.count(), 'results': ReviewRequestSerializer(reviews, many=True).data})

    @action(detail=False, methods=['get'], url_path='review-requests')
    def all_review_requests(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin required.'}, status=403)
        reviews = ReviewRequest.objects.select_related('school').order_by('-created_at')
        return Response({'count': reviews.count(), 'results': ReviewRequestSerializer(reviews, many=True).data})

    @action(detail=False, methods=['post'], url_path='import-csv', parser_classes=[MultiPartParser])
    def import_csv(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin access required.'}, status=403)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded = file_obj.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(decoded))
        except Exception as e:
            return Response({'error': f'Could not read CSV: {e}'}, status=400)

        created_count = 0
        updated_count = 0
        errors = []

        # Small helpers to safely read a number from a CSV row.
        def fval(row, key, default=0.0):
            try:
                return float(row.get(key, default) or default)
            except (ValueError, TypeError):
                return default

        def ival(row, key, default=0):
            try:
                return int(row.get(key, default) or default)
            except (ValueError, TypeError):
                return default

        for row_num, row in enumerate(reader, start=2):
            emis = row.get('emis', '').strip().upper()
            if not emis:
                errors.append(f"Row {row_num}: missing EMIS.")
                continue

            defaults = {
                'name': row.get('name', '').strip() or f"School {emis}",
                'province': row.get('province', 'bagmati').strip().lower(),
                'district': row.get('district', '').strip(),
                'students': ival(row, 'students'),
                'teachers': max(1, ival(row, 'teachers', 1)),
                'student_teacher_ratio': fval(row, 'student_teacher_ratio'),
                'infrastructure_deficit': fval(row, 'infrastructure_deficit'),
                'material_shortage': fval(row, 'material_shortage'),
                'geographic_difficulty': fval(row, 'geographic_difficulty'),
                'socioeconomic_index': fval(row, 'socioeconomic_index'),
            }

            try:
                school, was_created = School.objects.update_or_create(emis=emis, defaults=defaults)
                if was_created:
                    created_count += 1
                else:
                    updated_count += 1
            except Exception as e:
                errors.append(f"Row {row_num} (EMIS {emis}): {e}")

        return Response({'created': created_count, 'updated': updated_count, 'errors': errors})
