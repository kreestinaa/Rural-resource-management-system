"""
Unit tests for the GreedyAllocator (allocation/algorithms/greedy.py).

Tests cover:
- Constructor validation (bad budget, negative min, max < min)
- Insufficient budget proportional fallback
- All three strategies (priority, equality, hybrid)
- Gini coefficient (perfect equality, perfect inequality)
- Allocation summary shape
- Edge cases: zero scores, single school
"""
from decimal import Decimal
from django.test import TestCase
from allocation.algorithms.greedy import GreedyAllocator


def _schools(n, base_score=0.5):
    """Generate n ranked school dicts with distinct priority scores."""
    return [
        {
            'id': i,
            'priority_rank': i,
            'priority_score': round(base_score - (i - 1) * (base_score / n), 6),
            'students': 100 + i * 10,
        }
        for i in range(1, n + 1)
    ]


class GreedyConstructorTests(TestCase):
    def test_valid_construction(self):
        alloc = GreedyAllocator(1_000_000, 5_000, 100_000)
        self.assertEqual(alloc.strategy, 'priority')

    def test_zero_budget_raises(self):
        with self.assertRaises(ValueError):
            GreedyAllocator(0, 5_000, 100_000)

    def test_negative_budget_raises(self):
        with self.assertRaises(ValueError):
            GreedyAllocator(-1, 5_000, 100_000)

    def test_negative_min_alloc_raises(self):
        with self.assertRaises(ValueError):
            GreedyAllocator(1_000_000, -1, 100_000)

    def test_max_less_than_min_raises(self):
        with self.assertRaises(ValueError):
            GreedyAllocator(1_000_000, 50_000, 10_000)


class GreedyInsufficientBudgetTests(TestCase):
    def test_proportional_fallback_when_budget_too_small(self):
        # 10 schools × 10_000 min = 100_000 but budget is 50_000
        alloc = GreedyAllocator(50_000, 10_000, 20_000)
        schools = _schools(10)
        result = alloc.allocate_resources(schools)
        self.assertEqual(len(result), 10)
        total = sum(result.values())
        # Total allocated should not exceed budget
        self.assertLessEqual(float(total), 50_000 + 1)  # allow rounding


class GreedyPriorityStrategyTests(TestCase):
    def setUp(self):
        self.alloc = GreedyAllocator(1_000_000, 5_000, 100_000, 'priority')
        self.schools = _schools(10)

    def test_returns_all_schools(self):
        result = self.alloc.allocate_resources(self.schools)
        self.assertEqual(len(result), 10)

    def test_every_school_at_least_minimum(self):
        result = self.alloc.allocate_resources(self.schools)
        for school in self.schools:
            self.assertGreaterEqual(
                float(result[school['id']]),
                float(self.alloc.min_alloc) - 0.01,
            )

    def test_no_school_exceeds_maximum(self):
        result = self.alloc.allocate_resources(self.schools)
        for amount in result.values():
            self.assertLessEqual(float(amount), float(self.alloc.max_per_school) + 0.01)

    def test_higher_priority_gets_more_or_equal(self):
        result = self.alloc.allocate_resources(self.schools)
        # School 1 (highest priority) should get >= school 5 (lower)
        self.assertGreaterEqual(float(result[1]), float(result[5]))

    def test_zero_scores_distributes_equally(self):
        zero_schools = [{'id': i, 'priority_rank': i, 'priority_score': 0.0, 'students': 100}
                        for i in range(1, 6)]
        result = self.alloc.allocate_resources(zero_schools)
        amounts = list(result.values())
        # All should be roughly equal
        self.assertAlmostEqual(float(amounts[0]), float(amounts[-1]), delta=1.0)


class GreedyEqualityStrategyTests(TestCase):
    def test_all_schools_same_amount(self):
        alloc = GreedyAllocator(500_000, 5_000, 100_000, 'equality')
        schools = _schools(5)
        result = alloc.allocate_resources(schools)
        amounts = [float(v) for v in result.values()]
        self.assertAlmostEqual(amounts[0], amounts[-1], delta=0.01)


class GreedyHybridStrategyTests(TestCase):
    def test_hybrid_all_schools_covered(self):
        alloc = GreedyAllocator(2_000_000, 5_000, 200_000, 'hybrid')
        schools = _schools(15)
        result = alloc.allocate_resources(schools)
        self.assertEqual(len(result), 15)

    def test_hybrid_no_school_exceeds_max(self):
        alloc = GreedyAllocator(2_000_000, 5_000, 200_000, 'hybrid')
        schools = _schools(15)
        result = alloc.allocate_resources(schools)
        for amount in result.values():
            self.assertLessEqual(float(amount), 200_000 + 0.01)


class GiniCoefficientTests(TestCase):
    def setUp(self):
        self.alloc = GreedyAllocator(1_000_000, 1_000, 200_000)

    def test_perfect_equality_gini_near_zero(self):
        equal_allocs = {i: Decimal('100000') for i in range(1, 6)}
        gini = self.alloc.calculate_gini_coefficient(equal_allocs)
        self.assertAlmostEqual(gini, 0.0, delta=0.01)

    def test_high_inequality_gini_above_zero(self):
        # One school gets almost everything
        allocs = {1: Decimal('950000'), 2: Decimal('10000'), 3: Decimal('10000'),
                  4: Decimal('10000'), 5: Decimal('10000'), 6: Decimal('10000')}
        gini = self.alloc.calculate_gini_coefficient(allocs)
        self.assertGreater(gini, 0.5)

    def test_gini_in_zero_one_range(self):
        schools = _schools(20)
        result = self.alloc.allocate_resources(schools)
        gini = self.alloc.calculate_gini_coefficient(result)
        self.assertGreaterEqual(gini, 0.0)
        self.assertLessEqual(gini, 1.0)

    def test_empty_allocations_returns_zero(self):
        self.assertEqual(self.alloc.calculate_gini_coefficient({}), 0.0)


class AllocationSummaryTests(TestCase):
    def test_summary_has_required_keys(self):
        alloc = GreedyAllocator(1_000_000, 5_000, 100_000)
        schools = _schools(10)
        result = alloc.allocate_resources(schools)
        summary = alloc.compute_allocation_summary(schools, result)
        for key in ('total_budget', 'total_allocated', 'utilization_rate',
                    'schools_covered', 'gini_coefficient', 'allocation_tiers'):
            self.assertIn(key, summary)

    def test_summary_schools_covered_matches_input(self):
        alloc = GreedyAllocator(1_000_000, 5_000, 100_000)
        schools = _schools(7)
        result = alloc.allocate_resources(schools)
        summary = alloc.compute_allocation_summary(schools, result)
        self.assertEqual(summary['schools_covered'], 7)

    def test_utilization_rate_between_zero_and_hundred(self):
        alloc = GreedyAllocator(1_000_000, 5_000, 100_000)
        schools = _schools(5)
        result = alloc.allocate_resources(schools)
        summary = alloc.compute_allocation_summary(schools, result)
        self.assertGreaterEqual(summary['utilization_rate'], 0)
        self.assertLessEqual(summary['utilization_rate'], 100)
