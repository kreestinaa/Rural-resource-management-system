import logging
from decimal import Decimal

logger = logging.getLogger('allocation')


class GreedyAllocator:
    """
    Greedy algorithm for school budget allocation.

    Guarantees:
    - Every school receives at least min_allocation
    - No school exceeds max_per_school
    - Budget is fully utilized where possible
    - Higher-priority schools get proportionally more
    """

    def __init__(self, budget, min_alloc, max_per_school, strategy='priority'):
        """
        budget:         Total available budget (NPR)
        min_alloc:      Minimum guaranteed per school (NPR)
        max_per_school: Maximum any school can receive (NPR)
        strategy:       'priority' | 'equality' | 'hybrid'
        """
        if budget <= 0:
            raise ValueError("Budget must be positive.")
        if min_alloc < 0:
            raise ValueError("Minimum allocation cannot be negative.")
        if max_per_school < min_alloc:
            raise ValueError("max_per_school must be >= min_allocation.")

        self.budget = Decimal(str(budget))
        self.min_alloc = Decimal(str(min_alloc))
        self.max_per_school = Decimal(str(max_per_school))
        self.strategy = strategy

        logger.info(
            f"GreedyAllocator: budget=NPR {budget:,.0f}, "
            f"min={min_alloc:,.0f}, max={max_per_school:,.0f}, strategy={strategy}"
        )

    def allocate_resources(self, ranked_schools):
        """
        Main allocation entry point.

        ranked_schools: list of dicts sorted by priority_rank ascending.
            Each dict must have: {id, priority_rank, priority_score, students}

        Returns a dict mapping school_id -> allocated_amount (Decimal).
        """
        if not ranked_schools:
            return {}

        n = len(ranked_schools)
        min_reserve = self.min_alloc * n

        # Edge case: not enough budget for minimums -> proportional fallback
        if min_reserve > self.budget:
            logger.warning(
                f"Budget NPR {self.budget:,} < minimum reserve NPR {min_reserve:,} "
                f"for {n} schools. Using proportional fallback."
            )
            return self._proportional_fallback(ranked_schools)
        return self._priority_allocation(ranked_schools)

    def _priority_allocation(self, ranked_schools):
        """
        Pure greedy: guarantees minimums, then awards surplus by priority score.

        Steps:
            1. Reserve min_alloc for all schools
            2. Compute each school's score-proportional share of remaining budget
            3. Award up to (max_per_school - min_alloc) extra per school
            4. Re-distribute any leftover to top schools
        """
        n = len(ranked_schools)

        allocations = {}
        for school in ranked_schools:
            allocations[school['id']] = self.min_alloc

        remaining = self.budget - (self.min_alloc * n)
        if remaining <= 0:
            return allocations

        # total priority score across all schools
        scores = []
        for school in ranked_schools:
            scores.append(school['priority_score'])
        total_score = sum(scores)

        if total_score == 0:
            # All schools have equal score -> distribute surplus equally
            surplus_each = remaining / n
            for school in ranked_schools:
                extra = min(surplus_each, self.max_per_school - self.min_alloc)
                allocations[school['id']] += extra
            return allocations

        # Greedy pass: allocate proportional to priority score
        leftover = remaining
        for school in ranked_schools:
            if leftover <= 0:
                break
            score_share = Decimal(str(school['priority_score'] / total_score))
            ideal_extra = score_share * remaining
            max_extra = self.max_per_school - self.min_alloc
            actual_extra = min(ideal_extra, max_extra, leftover)
            actual_extra = max(actual_extra, Decimal('0'))

            allocations[school['id']] += actual_extra
            leftover -= actual_extra

        # Distribute rounding leftover to top priority schools
        if leftover > Decimal('0.01'):
            for school in ranked_schools:
                if leftover <= 0:
                    break
                headroom = self.max_per_school - allocations[school['id']]
                if headroom > 0:
                    bonus = min(headroom, leftover)
                    allocations[school['id']] += bonus
                    leftover -= bonus

        return allocations

    def _proportional_fallback(self, ranked_schools):
        """Proportional to priority score when minimums can't be guaranteed."""
        scores = []
        for school in ranked_schools:
            scores.append(school['priority_score'])
        total_score = sum(scores)

        if total_score == 0:
            n = len(ranked_schools)
            share = self.budget / n
            allocations = {}
            for school in ranked_schools:
                allocations[school['id']] = share
            return allocations

        allocations = {}
        for school in ranked_schools:
            score_share = Decimal(str(school['priority_score'] / total_score))
            amount = score_share * self.budget
            allocations[school['id']] = min(amount, self.max_per_school)
        return allocations

    def calculate_gini_coefficient(self, allocations):
        """
        Compute Gini coefficient for the allocation distribution.

        Formula: Gini = (2 * sum(i * y_i)) / (n * sum(y_i)) - (n+1)/n
        where y_i is sorted ascending and i is 1-indexed rank.

        Returns a float in [0, 1]: 0 = perfect equality, 1 = maximum inequality.
        """
        values = []
        for v in allocations.values():
            values.append(float(v))
        values = sorted(values)

        n = len(values)
        if n == 0:
            return 0.0

        total = sum(values)
        if total == 0:
            return 0.0

        products = []
        for i in range(len(values)):
            products.append((i + 1) * values[i])
        weighted_sum = sum(products)

        gini = (2 * weighted_sum) / (n * total) - (n + 1) / n
        return round(max(0.0, min(1.0, gini)), 4)

    def compute_allocation_summary(self, ranked_schools, allocations):
        """Generate summary statistics for an allocation run."""
        amounts = list(allocations.values())
        total_allocated = sum(amounts)
        gini = self.calculate_gini_coefficient(allocations)

        if amounts:
            min_alloc = min(amounts)
            max_alloc = max(amounts)
            avg_alloc = total_allocated / len(amounts)
        else:
            min_alloc = Decimal('0')
            max_alloc = Decimal('0')
            avg_alloc = Decimal('0')

        tiers = {'minimum': 0, 'standard': 0, 'priority': 0, 'maximum': 0}
        for amount in amounts:
            if amount <= self.min_alloc * Decimal('1.1'):
                tiers['minimum'] += 1
            elif amount >= self.max_per_school * Decimal('0.9'):
                tiers['maximum'] += 1
            elif amount >= self.max_per_school * Decimal('0.5'):
                tiers['priority'] += 1
            else:
                tiers['standard'] += 1

        return {
            'total_budget': float(self.budget),
            'total_allocated': float(total_allocated),
            'utilization_rate': round(
                float(total_allocated / self.budget * 100), 2
            ),
            'schools_covered': len(allocations),
            'gini_coefficient': gini,
            'min_allocation': float(min_alloc),
            'max_allocation': float(max_alloc),
            'avg_allocation': float(avg_alloc),
            'allocation_tiers': tiers,
            'strategy': self.strategy,
        }
