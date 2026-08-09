from rest_framework import serializers
from decimal import Decimal
from .models import BudgetCycle, AllocationResult, FiscalYearBudget, DiscretionaryGrant


class AllocationResultSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    school_district = serializers.CharField(
        source='school.district', read_only=True)
    school_province = serializers.CharField(
        source='school.province', read_only=True)
    school_students = serializers.IntegerField(
        source='school.students', read_only=True)

    class Meta:
        model = AllocationResult
        fields = [
            'id', 'school', 'school_name', 'school_district',
            'school_province', 'school_students',
            'priority_rank', 'priority_score',
            'allocated_amount',
            'allocation_pct', 'allocation_strategy',
            'fairness_score', 'allocation_tier',
            'disbursement_status', 'disbursed_at',
        ]


class BudgetCycleListSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetCycle
        fields = [
            'id', 'name', 'fiscal_year', 'status',
            'total_budget', 'allocation_strategy',
            'total_allocated', 'schools_covered',
            'utilization_rate', 'gini_coefficient',
            'created_at', 'computed_at',
        ]


class BudgetCycleDetailSerializer(serializers.ModelSerializer):
    results = AllocationResultSerializer(many=True, read_only=True)

    class Meta:
        model = BudgetCycle
        fields = '__all__'
        read_only_fields = [
            'total_allocated', 'schools_covered', 'utilization_rate',
            'gini_coefficient', 'computed_at', 'created_at', 'updated_at',
        ]


class AllocationRunSerializer(serializers.Serializer):
    """Input serializer for running a new allocation."""
    name = serializers.CharField(max_length=200)
    fiscal_year = serializers.CharField(max_length=10)
    total_budget = serializers.DecimalField(max_digits=15, decimal_places=2)
    min_allocation = serializers.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('50000')
    )
    max_per_school = serializers.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('500000')
    )
    allocation_strategy = serializers.ChoiceField(
        choices=['priority', 'equality', 'hybrid'], default='priority'
    )
    weight_student_teacher = serializers.FloatField(default=0.30)
    weight_infrastructure = serializers.FloatField(default=0.25)
    weight_materials = serializers.FloatField(default=0.20)
    weight_geographic = serializers.FloatField(default=0.15)
    weight_socioeconomic = serializers.FloatField(default=0.10)
    province_filter = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

    def validate(self, data):
        weights = [
            data['weight_student_teacher'],
            data['weight_infrastructure'],
            data['weight_materials'],
            data['weight_geographic'],
            data['weight_socioeconomic'],
        ]
        total = sum(weights)
        if abs(total - 1.0) > 0.01:
            raise serializers.ValidationError(
                f"Weights must sum to 1.0, got {total:.3f}"
            )
        if data['min_allocation'] > data['max_per_school']:
            raise serializers.ValidationError(
                "min_allocation cannot exceed max_per_school."
            )
        return data


class FiscalYearBudgetSerializer(serializers.ModelSerializer):
    """Annual pool with live balance figures."""
    allocated_by_cycles = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True)
    granted_by_requests = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True)
    spent = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True)
    available = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True)
    cycle_count = serializers.SerializerMethodField()
    grant_count = serializers.SerializerMethodField()

    class Meta:
        model = FiscalYearBudget
        fields = [
            'id', 'fiscal_year', 'name', 'total_amount', 'is_active', 'created_at',
            'allocated_by_cycles', 'granted_by_requests', 'spent', 'available',
            'cycle_count', 'grant_count',
        ]
        read_only_fields = ['id', 'created_at']

    def get_cycle_count(self, obj):
        return obj.cycles.exclude(status='draft').count()

    def get_grant_count(self, obj):
        return obj.discretionary_grants.count()


class DiscretionaryGrantSerializer(serializers.ModelSerializer):
    school_name = serializers.ReadOnlyField(source='school.name')
    school_district = serializers.ReadOnlyField(source='school.district')
    request_subject = serializers.ReadOnlyField(
        source='resource_request.subject')
    granted_by_username = serializers.ReadOnlyField(
        source='granted_by.username')

    class Meta:
        model = DiscretionaryGrant
        fields = [
            'id', 'fiscal_budget', 'school', 'school_name', 'school_district',
            'resource_request', 'request_subject', 'amount',
            'granted_by', 'granted_by_username', 'granted_at',
            'disbursement_status', 'disbursed_at',
        ]
        read_only_fields = fields
