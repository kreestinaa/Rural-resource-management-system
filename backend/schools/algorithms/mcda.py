"""
MCDA (Multi-Criteria Decision Analysis) Engine
Module: School Priority Ranking System

Ranks schools by need using Min-Max Normalization + Weighted Scoring.
Weights are informed by Nepal SSDP (2016-2023) education priorities.

Formula for each school i:
    score_i = sum over criteria j of ( weight_j * normalized_value_ij )
The higher the score, the higher the need, the higher the priority.
"""
import logging

from django.utils import timezone

logger = logging.getLogger('schools')

# Keep only the most recent N ranking snapshots per school.
RANKING_HISTORY_LIMIT = 12


class MCDAEngine:
    """Scores and ranks schools from five weighted need indicators."""

    # Each weight says how much that indicator matters. They sum to 1.0.
    DEFAULT_WEIGHTS = {
        'student_teacher_ratio': 0.30,   # teacher shortage (most important)
        'infrastructure_deficit': 0.25,  # buildings, water, electricity
        'material_shortage': 0.20,       # textbooks, desks, materials
        'geographic_difficulty': 0.15,   # remoteness / access
        'socioeconomic_index': 0.10,     # community poverty
    }

    def __init__(self, weights=None):
        if weights:
            self.weights = weights
        else:
            self.weights = self.DEFAULT_WEIGHTS.copy()
        self._validate_weights()
        logger.info(f"MCDAEngine initialized with weights: {self.weights}")

    def _validate_weights(self):
        """Weights must be non-negative and add up to 1.0."""
        total = sum(self.weights.values())
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Weights must sum to 1.0, got {total:.4f}.")
        for w in self.weights.values():
            if w < 0:
                raise ValueError("All weights must be non-negative.")

    def min_max_normalize(self, values):
        """
        Rescale a list of values to the 0-1 range so different indicators
        (measured on different scales) can be compared fairly.

            normalized = (value - min) / (max - min)

        If every value is the same, they all get the neutral value 0.5.
        """
        if not values:
            return []

        low = min(values)
        high = max(values)
        spread = high - low
        if spread == 0:
            return [0.5] * len(values)

        result = []
        for v in values:
            result.append((v - low) / spread)
        return result

    def compute_priority_scores(self, schools_data):
        """
        Turn raw school indicators into ranked (school_id, score) pairs.

        Normalizes each indicator, then adds up weight * value for every
        school and sorts so the highest-need school comes first.
        """
        if not schools_data:
            return []

        criteria = list(self.weights.keys())

        # normalize each indicator across all schools
        normalized = {}
        for c in criteria:
            column = []
            for school in schools_data:
                column.append(school[c])
            normalized[c] = self.min_max_normalize(column)

        # weighted score for each school
        results = []
        for i in range(len(schools_data)):
            school = schools_data[i]
            terms = []
            for c in criteria:
                terms.append(self.weights[c] * normalized[c][i])
            score = sum(terms)
            results.append((school['id'], round(score, 6)))

        # highest score first
        results.sort(key=lambda pair: pair[1], reverse=True)

        logger.info(
            f"MCDA computed for {len(results)} schools "
            f"(top {results[0][1]:.4f}, bottom {results[-1][1]:.4f})."
        )
        return results

    def update_school_priorities(self, schools_queryset):
        """
        Compute scores and save each school's new rank/score to the database.
        Also appends a snapshot to the school's ranking history.
        """
        from schools.models import School

        schools = list(schools_queryset.values(
            'id', 'name', 'student_teacher_ratio', 'infrastructure_deficit',
            'material_shortage', 'geographic_difficulty', 'socioeconomic_index',
            'priority_rank', 'ranking_history',
        ))
        if not schools:
            logger.warning("No schools found for MCDA computation.")
            return []

        scored = self.compute_priority_scores(schools)

        # score_map: id -> score,  rank_map: id -> rank (1 = highest need)
        score_map = {}
        rank_map = {}
        for rank in range(len(scored)):
            sid = scored[rank][0]
            score = scored[rank][1]
            score_map[sid] = score
            rank_map[sid] = rank + 1

        now = timezone.now()
        to_update = []
        summary = []

        for school in School.objects.filter(id__in=score_map.keys()):
            new_score = score_map[school.id]
            new_rank = rank_map[school.id]

            school.ranking_history = self._append_history(
                school.ranking_history, now, new_rank, new_score
            )
            school.improvement_score = self._improvement(
                school.ranking_history)
            school.priority_score = new_score
            school.priority_rank = new_rank
            school.last_ranking_date = now
            to_update.append(school)

            summary.append({
                'id': school.id,
                'name': school.name,
                'priority_score': new_score,
                'priority_rank': new_rank,
                'improvement_score': school.improvement_score,
            })

        School.objects.bulk_update(
            to_update,
            ['priority_score', 'priority_rank', 'ranking_history',
             'improvement_score', 'last_ranking_date'],
            batch_size=100,
        )
        logger.info(f"Updated priority scores for {len(to_update)} schools.")
        return summary

    def _append_history(self, history, now, rank, score):
        """Add one snapshot and keep only the most recent RANKING_HISTORY_LIMIT."""
        if history:
            history = history + [{
                'date': now.isoformat(),
                'rank': rank,
                'score': score,
            }]
        else:
            history = [{
                'date': now.isoformat(),
                'rank': rank,
                'score': score,
            }]
        return history[-RANKING_HISTORY_LIMIT:]

    def _improvement(self, history):
        """
        How many places the school moved since last time.
        Positive means it improved (rank number went down).
        """
        if len(history) < 2:
            return 0.0
        return float(history[-2]['rank'] - history[-1]['rank'])
