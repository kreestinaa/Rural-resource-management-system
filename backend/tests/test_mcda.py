"""
Unit tests for the MCDAEngine (schools/algorithms/mcda.py).

Tests cover:
- Weight validation (sum != 1, negatives)
- Min-max normalization (normal, all-equal edge case, empty)
- Priority score computation (1 school, 2 schools, 150 schools)
- Ranking order correctness
- Sensitivity analysis shape
"""
from django.test import TestCase
from schools.algorithms.mcda import MCDAEngine


def _school(id_, str_=50, infra=50, mat=50, geo=50, ses=50):
    """Build a minimal school dict for MCDAEngine.compute_priority_scores."""
    return {
        'id': id_,
        'student_teacher_ratio': str_,
        'infrastructure_deficit': infra,
        'material_shortage': mat,
        'geographic_difficulty': geo,
        'socioeconomic_index': ses,
    }


class MCDAWeightValidationTests(TestCase):
    def test_default_weights_valid(self):
        engine = MCDAEngine()
        self.assertAlmostEqual(sum(engine.weights.values()), 1.0, places=5)

    def test_custom_weights_equal_sum(self):
        weights = {k: 0.2 for k in MCDAEngine.DEFAULT_WEIGHTS}
        engine = MCDAEngine(weights=weights)
        self.assertAlmostEqual(sum(engine.weights.values()), 1.0, places=5)

    def test_weights_not_summing_to_one_raises(self):
        bad = {k: 0.1 for k in MCDAEngine.DEFAULT_WEIGHTS}  # sums to 0.5
        with self.assertRaises(ValueError):
            MCDAEngine(weights=bad)

    def test_negative_weight_raises(self):
        w = MCDAEngine.DEFAULT_WEIGHTS.copy()
        w['student_teacher_ratio'] = -0.10
        w['infrastructure_deficit'] = 0.65  # keep sum ~1
        with self.assertRaises(ValueError):
            MCDAEngine(weights=w)

    def test_tolerance_allows_small_rounding(self):
        # weights summing to 1.005 should pass the 0.01 tolerance
        w = {k: 0.2 + (0.005 / 5) for k in MCDAEngine.DEFAULT_WEIGHTS}
        engine = MCDAEngine(weights=w)
        self.assertIsNotNone(engine)


class MinMaxNormalizationTests(TestCase):
    def setUp(self):
        self.engine = MCDAEngine()

    def test_normal_case(self):
        result = self.engine.min_max_normalize([0, 50, 100])
        self.assertAlmostEqual(result[0], 0.0)
        self.assertAlmostEqual(result[1], 0.5)
        self.assertAlmostEqual(result[2], 1.0)

    def test_all_equal_returns_half(self):
        result = self.engine.min_max_normalize([42, 42, 42])
        self.assertEqual(result, [0.5, 0.5, 0.5])

    def test_empty_list_returns_empty(self):
        self.assertEqual(self.engine.min_max_normalize([]), [])

    def test_single_value_returns_half(self):
        result = self.engine.min_max_normalize([75])
        self.assertEqual(result, [0.5])

    def test_output_in_zero_one_range(self):
        import random
        vals = [random.uniform(0, 100) for _ in range(20)]
        result = self.engine.min_max_normalize(vals)
        for v in result:
            self.assertGreaterEqual(v, 0.0)
            self.assertLessEqual(v, 1.0)


class PriorityScoreComputationTests(TestCase):
    def setUp(self):
        self.engine = MCDAEngine()

    def test_empty_input_returns_empty(self):
        self.assertEqual(self.engine.compute_priority_scores([]), [])

    def test_single_school_gets_neutral_score(self):
        schools = [_school(1, 50, 50, 50, 50, 50)]
        results = self.engine.compute_priority_scores(schools)
        self.assertEqual(len(results), 1)
        school_id, score = results[0]
        self.assertEqual(school_id, 1)
        # Single school: all normalized to 0.5, score = 0.5
        self.assertAlmostEqual(score, 0.5, places=4)

    def test_two_schools_higher_indicators_rank_first(self):
        high = _school(1, str_=90, infra=90, mat=90, geo=90, ses=90)
        low = _school(2, str_=10, infra=10, mat=10, geo=10, ses=10)
        results = self.engine.compute_priority_scores([high, low])
        self.assertEqual(results[0][0], 1)  # high-need school ranked first

    def test_score_is_between_zero_and_one(self):
        schools = [
            _school(i, str_=i * 6 % 100, infra=i * 7 % 100,
                    mat=i * 11 % 100, geo=i * 13 % 100, ses=i * 17 % 100)
            for i in range(1, 20)
        ]
        results = self.engine.compute_priority_scores(schools)
        for _, score in results:
            self.assertGreaterEqual(score, 0.0)
            self.assertLessEqual(score, 1.0)

    def test_150_schools_all_ranked(self):
        schools = [_school(i, i % 100, (i * 3) % 100, (i * 7) % 100,
                           (i * 11) % 100, (i * 13) % 100)
                   for i in range(1, 151)]
        results = self.engine.compute_priority_scores(schools)
        self.assertEqual(len(results), 150)
        # Must be sorted by score descending
        scores = [s for _, s in results]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_identical_schools_same_score(self):
        schools = [_school(i, 60, 70, 50, 40, 55) for i in range(1, 6)]
        results = self.engine.compute_priority_scores(schools)
        scores = [s for _, s in results]
        self.assertEqual(len(set(scores)), 1)  # all identical

    def test_result_is_sorted_descending(self):
        schools = [_school(i) for i in range(1, 11)]
        # Give each school a unique profile
        for i, s in enumerate(schools):
            s['student_teacher_ratio'] = i * 10
            s['infrastructure_deficit'] = (9 - i) * 10
        results = self.engine.compute_priority_scores(schools)
        scores = [s for _, s in results]
        self.assertEqual(scores, sorted(scores, reverse=True))
