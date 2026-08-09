from django.contrib import admin
from django.utils.html import format_html
from .models import BudgetCycle, AllocationResult


class AllocationResultInline(admin.TabularInline):
    model = AllocationResult
    extra = 0
    readonly_fields = [
        'school', 'priority_rank', 'priority_score',
        'allocated_amount', 'allocation_pct', 'allocation_tier',
    ]
    can_delete = False
    max_num = 20


@admin.register(BudgetCycle)
class BudgetCycleAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'fiscal_year', 'status',
        'total_budget_display', 'schools_covered',
        'utilization_rate_display', 'gini_display',
        'allocation_strategy', 'created_at',
    ]
    list_filter = ['status', 'allocation_strategy', 'fiscal_year']
    search_fields = ['name', 'fiscal_year']
    readonly_fields = [
        'total_allocated', 'schools_covered', 'utilization_rate',
        'gini_coefficient', 'computed_at', 'created_at', 'updated_at',
    ]
    inlines = [AllocationResultInline]

    def total_budget_display(self, obj):
        return f"NPR {obj.total_budget:,.0f}"
    total_budget_display.short_description = 'Budget'

    def utilization_rate_display(self, obj):
        color = '#27ae60' if obj.utilization_rate >= 90 else '#f39c12'
        return format_html(
            '<span style="color: {};">{:.1f}%</span>',
            color, obj.utilization_rate
        )
    utilization_rate_display.short_description = 'Utilization'

    def gini_display(self, obj):
        color = '#27ae60' if obj.gini_coefficient < 0.3 else (
            '#f39c12' if obj.gini_coefficient < 0.5 else '#e74c3c'
        )
        return format_html(
            '<span style="color: {};">{:.3f}</span>',
            color, obj.gini_coefficient
        )
    gini_display.short_description = 'Gini'


@admin.register(AllocationResult)
class AllocationResultAdmin(admin.ModelAdmin):
    list_display = [
        'school', 'budget_cycle', 'priority_rank',
        'allocated_amount', 'allocation_tier', 'fairness_score',
    ]
    list_filter = ['allocation_strategy', 'allocation_tier', 'budget_cycle']
    search_fields = ['school__name', 'school__emis']
    ordering = ['priority_rank']
