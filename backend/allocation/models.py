from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from schools.models import School

ALLOCATION_STRATEGY_CHOICES = [
    ('priority', 'Priority-Based (Pure Greedy)'),
    ('equality', 'Equal Distribution'),
    ('hybrid', 'Hybrid (60% Priority + 40% Equal)'),
]

STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('computed', 'Computed'),
    ('approved', 'Approved'),
    ('disbursed', 'Disbursed'),
]


class FiscalYearBudget(models.Model):
    """
    The annual budget pool for a Nepali fiscal year.

    Everything draws down from this single pool:
      - Budget cycles (tranches) distributed by the Greedy algorithm
      - Discretionary grants approved from school resource-request letters

    The pool tracks a COMMITTED balance: money is deducted when a cycle is
    actually RUN (not while it is a draft) and when a letter grant is APPROVED.
    Spending can never exceed `total_amount`.
    """
    fiscal_year = models.CharField(
        max_length=10, unique=True,
        help_text="e.g. 2081/82 (Nepali fiscal year)",
    )
    name = models.CharField(max_length=200, blank=True)
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Total annual budget in NPR",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fiscal_year']
        verbose_name = 'Fiscal Year Budget'
        verbose_name_plural = 'Fiscal Year Budgets'

    def __str__(self):
        return f"{self.fiscal_year} — NPR {self.total_amount:,.0f}"

    # Balance accounting
    @property
    def allocated_by_cycles(self):
        """Sum of budgets of cycles that have actually been RUN (not drafts)."""
        agg = self.cycles.exclude(status='draft').aggregate(
            total=models.Sum('total_budget')
        )
        return agg['total'] or Decimal('0')

    @property
    def granted_by_requests(self):
        """Sum of discretionary grants approved from resource-request letters."""
        agg = self.discretionary_grants.aggregate(total=models.Sum('amount'))
        return agg['total'] or Decimal('0')

    @property
    def spent(self):
        return self.allocated_by_cycles + self.granted_by_requests

    @property
    def available(self):
        return self.total_amount - self.spent

    def can_afford(self, amount):
        return Decimal(str(amount)) <= self.available


class BudgetCycle(models.Model):
    """
    Represents a government budget allocation cycle (fiscal year).
    Stores MCDA weights and allocation constraints.
    """
    name = models.CharField(max_length=200)
    fiscal_year = models.CharField(
        max_length=10,
        help_text="e.g. 2080/81 (Nepali fiscal year)"
    )
    # The annual pool this cycle draws from. Nullable so existing cycles
    # (created before the pool existed) keep working.
    fiscal_budget = models.ForeignKey(
        'FiscalYearBudget', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cycles',
        help_text="Annual budget pool this cycle draws from",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='draft'
    )

    # Budget Parameters
    total_budget = models.DecimalField(
        max_digits=15, decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Total budget in Nepali Rupees (NPR)"
    )
    min_allocation = models.DecimalField(
        max_digits=12, decimal_places=2,
        default=50000,
        validators=[MinValueValidator(0)],
        help_text="Minimum guaranteed allocation per school (NPR)"
    )
    max_per_school = models.DecimalField(
        max_digits=12, decimal_places=2,
        default=500000,
        validators=[MinValueValidator(0)],
        help_text="Maximum allocation any single school can receive (NPR)"
    )

    # MCDA Weights
    weight_student_teacher = models.FloatField(
        default=0.30,
        validators=[MinValueValidator(0), MaxValueValidator(1)]
    )
    weight_infrastructure = models.FloatField(
        default=0.25,
        validators=[MinValueValidator(0), MaxValueValidator(1)]
    )
    weight_materials = models.FloatField(
        default=0.20,
        validators=[MinValueValidator(0), MaxValueValidator(1)]
    )
    weight_geographic = models.FloatField(
        default=0.15,
        validators=[MinValueValidator(0), MaxValueValidator(1)]
    )
    weight_socioeconomic = models.FloatField(
        default=0.10,
        validators=[MinValueValidator(0), MaxValueValidator(1)]
    )

    # Strategy
    allocation_strategy = models.CharField(
        max_length=20,
        choices=ALLOCATION_STRATEGY_CHOICES,
        default='priority'
    )
    target_provinces = models.JSONField(
        default=list,
        help_text="Province filter: [] means all provinces"
    )

    # Results (populated after computation)
    total_allocated = models.DecimalField(
        max_digits=15, decimal_places=2, default=0
    )
    schools_covered = models.PositiveIntegerField(default=0)
    utilization_rate = models.FloatField(
        default=0.0,
        help_text="Budget utilization % (0-100)"
    )
    gini_coefficient = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Fairness metric: 0=equal, 1=maximum inequality"
    )
    computed_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='budget_cycles'
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Budget Cycle'
        verbose_name_plural = 'Budget Cycles'

    def __str__(self):
        return f"{self.name} ({self.fiscal_year})"

    @property
    def weights_dict(self):
        return {
            'student_teacher_ratio': self.weight_student_teacher,
            'infrastructure_deficit': self.weight_infrastructure,
            'material_shortage': self.weight_materials,
            'geographic_difficulty': self.weight_geographic,
            'socioeconomic_index': self.weight_socioeconomic,
        }


class AllocationResult(models.Model):
    """
    Individual school allocation result for a budget cycle.
    Created by the Greedy Allocator.
    """
    budget_cycle = models.ForeignKey(
        BudgetCycle, on_delete=models.CASCADE,
        related_name='results'
    )
    school = models.ForeignKey(
        School, on_delete=models.CASCADE,
        related_name='allocations'
    )

    # Priority Data
    priority_rank = models.PositiveIntegerField()
    priority_score = models.FloatField()

    # Allocation
    allocated_amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        help_text="Amount allocated (NPR)"
    )
    allocation_pct = models.FloatField(
        default=0.0,
        help_text="% of total budget allocated to this school"
    )

    # Strategy & Fairness
    allocation_strategy = models.CharField(max_length=20)
    fairness_score = models.FloatField(
        default=0.0,
        help_text="School-level fairness metric (0-1)"
    )
    allocation_tier = models.CharField(
        max_length=20,
        default='standard',
        help_text="minimum / standard / priority / maximum"
    )

    # Disbursement
    disbursement_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('disbursed', 'Disbursed')],
        default='pending',
        db_index=True,
    )
    disbursed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['budget_cycle', 'school']
        ordering = ['priority_rank']

    def __str__(self):
        return (
            f"{self.school.name} -> NPR {self.allocated_amount:,} "
            f"(Rank #{self.priority_rank})"
        )


class DiscretionaryGrant(models.Model):
    """
    A one-off grant made to a single school after an administrator approved
    that school's official resource-request letter.

    Unlike algorithmic allocations (which the Greedy engine computes for all
    schools by MCDA rank), a discretionary grant is a human decision backed by
    a document. It draws from the same annual FiscalYearBudget pool, so total
    government spending can never exceed the annual budget.
    """
    fiscal_budget = models.ForeignKey(
        FiscalYearBudget, on_delete=models.CASCADE,
        related_name='discretionary_grants',
    )
    school = models.ForeignKey(
        School, on_delete=models.CASCADE,
        related_name='discretionary_grants',
    )
    resource_request = models.OneToOneField(
        'schools.ResourceRequest', on_delete=models.CASCADE,
        related_name='grant',
        help_text="The approved letter this grant was made against",
    )
    amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Amount granted in NPR",
    )
    granted_by = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='discretionary_grants_made',
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    disbursement_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('disbursed', 'Disbursed')],
        default='pending',
    )
    disbursed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-granted_at']
        verbose_name = 'Discretionary Grant'
        verbose_name_plural = 'Discretionary Grants'

    def __str__(self):
        return f"Grant NPR {self.amount:,.0f} → {self.school.name}"
