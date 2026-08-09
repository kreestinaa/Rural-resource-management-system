"""
Evaluate the MCDA priority classification with a confusion matrix.

MCDA is a rule-based classifier: it reads five indicators, computes a weighted
score, and the schools are then grouped into priority tiers. To judge whether
those tiers are correct we need labels that were NOT produced by MCDA.

Ground truth (Method A, default):
    Each school's province has a known development level. Karnali and
    Sudurpashchim are Nepal's least developed provinces, Bagmati the most
    developed. The dataset was generated from these province profiles, so the
    province gives an independent "true" need level. MCDA never sees the
    province - only the five indicators.

Ground truth (Method B, --method equal):
    Equal-weight triage: the plain average of the five indicators, as an
    officer would judge a school treating every factor as equally important.
    MCDA instead applies policy weights (30/25/20/15/10), so the two methods
    genuinely disagree on some schools.

Usage:
    python manage.py evaluate_mcda
    python manage.py evaluate_mcda --method equal
    python manage.py evaluate_mcda --csv dataset.csv
"""
import csv

from django.core.management.base import BaseCommand

from schools.models import School
from schools.algorithms.mcda import MCDAEngine

INDICATORS = [
    'student_teacher_ratio',
    'infrastructure_deficit',
    'material_shortage',
    'geographic_difficulty',
    'socioeconomic_index',
]

# Development level of each province.
PROVINCE_NEED = {
    'karnali': 'High',
    'sudurpashchim': 'High',
    'madhesh': 'Medium',
    'lumbini': 'Medium',
    'province1': 'Medium',
    'gandaki': 'Medium',
    'bagmati': 'Low',
}

TIERS_3 = ['High', 'Medium', 'Low']
TIERS_4 = ['Critical', 'High', 'Medium', 'Low']


def tiers_by_position(ordered_ids, class_sizes, class_names):
    """Give the first class_sizes[0] ids the first class name, and so on."""
    labels = {}
    index = 0
    for position in range(len(class_names)):
        for _ in range(class_sizes[position]):
            if index < len(ordered_ids):
                labels[ordered_ids[index]] = class_names[position]
                index += 1
    while index < len(ordered_ids):
        labels[ordered_ids[index]] = class_names[-1]
        index += 1
    return labels


class Command(BaseCommand):
    help = "Evaluate MCDA priority classification with a confusion matrix."

    def add_arguments(self, parser):
        parser.add_argument('--method', type=str, default='province',
                            choices=['province', 'equal'],
                            help="Ground truth: 'province' (default) or 'equal'.")
        parser.add_argument('--csv', type=str, default=None,
                            help='Save the labelled dataset to this CSV file.')

    def handle(self, *args, **options):
        schools = list(School.objects.all().values(
            'id', 'name', 'emis', 'district', 'province', *INDICATORS))

        if len(schools) < 8:
            self.stdout.write(self.style.ERROR("Need at least 8 schools to evaluate."))
            return

        total = len(schools)
        method = options['method']

        # ---------- MCDA scores (the model being evaluated) ----------
        engine = MCDAEngine()
        scored = engine.compute_priority_scores(schools)
        score_of = {}
        mcda_order = []
        for school_id, score in scored:
            score_of[school_id] = score
            mcda_order.append(school_id)

        # ---------- ground truth ----------
        if method == 'province':
            classes = TIERS_3
            actual = {}
            for school in schools:
                actual[school['id']] = PROVINCE_NEED.get(school['province'], 'Medium')
            sizes = []
            for c in classes:
                count = 0
                for sid in actual:
                    if actual[sid] == c:
                        count += 1
                sizes.append(count)
            predicted = tiers_by_position(mcda_order, sizes, classes)
            truth_note = "province development level (independent of MCDA)"
        else:
            classes = TIERS_4
            severity = {}
            for school in schools:
                s = 0
                for field in INDICATORS:
                    s += float(school[field] or 0)
                severity[school['id']] = s / len(INDICATORS)
            equal_order = sorted(severity, key=lambda sid: severity[sid], reverse=True)
            quarter = total // 4
            sizes = [quarter, quarter, quarter, total - 3 * quarter]
            actual = tiers_by_position(equal_order, sizes, classes)
            predicted = tiers_by_position(mcda_order, sizes, classes)
            truth_note = "equal-weight average of the five indicators"

        # ---------- confusion matrix ----------
        matrix = {}
        for a in classes:
            matrix[a] = {}
            for p in classes:
                matrix[a][p] = 0
        for school in schools:
            sid = school['id']
            matrix[actual[sid]][predicted[sid]] += 1

        self.stdout.write("")
        self.stdout.write("EVALUATION OF MCDA PRIORITY CLASSIFICATION")
        self.stdout.write("Schools: {}".format(total))
        self.stdout.write("Predicted : MCDA weighted score, grouped into tiers")
        self.stdout.write("Actual    : {}".format(truth_note))

        # ---------- print matrix ----------
        self.stdout.write("")
        self.stdout.write("CONFUSION MATRIX  (rows = Actual, columns = Predicted)")
        self.stdout.write("")
        header = "{:<12}".format("")
        for c in classes:
            header += "{:>10}".format(c)
        header += "{:>10}".format("Total")
        self.stdout.write(header)
        for a in classes:
            row = "{:<12}".format(a)
            row_total = 0
            for p in classes:
                row += "{:>10}".format(matrix[a][p])
                row_total += matrix[a][p]
            row += "{:>10}".format(row_total)
            self.stdout.write(row)
        footer = "{:<12}".format("Total")
        for p in classes:
            col = 0
            for a in classes:
                col += matrix[a][p]
            footer += "{:>10}".format(col)
        footer += "{:>10}".format(total)
        self.stdout.write(footer)

        # ---------- metrics ----------
        self.stdout.write("")
        self.stdout.write("CLASS-WISE PERFORMANCE")
        self.stdout.write("")
        self.stdout.write("{:<12}{:>6}{:>6}{:>6}{:>6}{:>12}{:>10}{:>8}".format(
            "Class", "TP", "FP", "FN", "TN", "Precision", "Recall", "F1"))

        correct = 0
        macro_f1 = 0
        for tier in classes:
            tp = matrix[tier][tier]
            correct += tp
            fp = 0
            for a in classes:
                if a != tier:
                    fp += matrix[a][tier]
            fn = 0
            for p in classes:
                if p != tier:
                    fn += matrix[tier][p]
            tn = total - tp - fp - fn

            precision = tp / (tp + fp) if (tp + fp) else 0.0
            recall = tp / (tp + fn) if (tp + fn) else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
            macro_f1 += f1

            self.stdout.write("{:<12}{:>6}{:>6}{:>6}{:>6}{:>12.2f}{:>10.2f}{:>8.2f}".format(
                tier, tp, fp, fn, tn, precision, recall, f1))

        accuracy = correct / total
        self.stdout.write("")
        self.stdout.write("Overall Accuracy = {}/{} = {:.4f}  ({:.2f}%)".format(
            correct, total, accuracy, accuracy * 100))
        self.stdout.write("Macro-average F1 = {:.4f}".format(macro_f1 / len(classes)))

        adjacent = 0
        severe = 0
        for a in classes:
            for p in classes:
                if a == p:
                    continue
                gap = abs(classes.index(a) - classes.index(p))
                if gap == 1:
                    adjacent += matrix[a][p]
                else:
                    severe += matrix[a][p]
        self.stdout.write("Misclassifications: {} adjacent-tier, {} two or more tiers apart.".format(
            adjacent, severe))
        self.stdout.write("")

        # ---------- optional CSV ----------
        if options['csv']:
            with open(options['csv'], 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['school_id', 'name', 'emis', 'district', 'province']
                                + INDICATORS
                                + ['mcda_score', 'predicted_tier', 'actual_tier', 'correct'])
                for school in schools:
                    sid = school['id']
                    row = [sid, school['name'], school['emis'], school['district'], school['province']]
                    for field in INDICATORS:
                        row.append(school[field])
                    row.append(score_of.get(sid))
                    row.append(predicted[sid])
                    row.append(actual[sid])
                    row.append('yes' if predicted[sid] == actual[sid] else 'no')
                    writer.writerow(row)
            self.stdout.write(self.style.SUCCESS("Labelled dataset saved to " + options['csv']))
            self.stdout.write("")
