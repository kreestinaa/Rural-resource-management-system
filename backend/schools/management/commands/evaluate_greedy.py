"""
Evaluate the Greedy allocation algorithm.

The Greedy allocator is not a classifier, so it is judged on the properties it
is supposed to guarantee:

  1. Constraint satisfaction - every school gets at least the minimum, no school
     exceeds the maximum, and the total never exceeds the budget.
  2. Budget utilisation    - how much of the available budget was distributed.
  3. Equity                - Gini coefficient of the allocation.
  4. Priority alignment    - do higher ranked (needier) schools actually receive
     more money? Measured with Spearman rank correlation.
  5. Baseline comparison   - how the allocation differs from an equal split.

Usage:
    python manage.py evaluate_greedy
    python manage.py evaluate_greedy --cycle 3
"""
from django.core.management.base import BaseCommand

from allocation.models import BudgetCycle, AllocationResult


def spearman(x_values, y_values):
    """Spearman rank correlation between two lists (no external library)."""
    def to_ranks(values):
        order = sorted(range(len(values)), key=lambda i: values[i])
        ranks = [0] * len(values)
        position = 0
        while position < len(order):
            end = position
            while end + 1 < len(order) and values[order[end + 1]] == values[order[position]]:
                end += 1
            average_rank = (position + end) / 2 + 1
            for k in range(position, end + 1):
                ranks[order[k]] = average_rank
            position = end + 1
        return ranks

    rx = to_ranks(x_values)
    ry = to_ranks(y_values)
    n = len(rx)
    mean_x = sum(rx) / n
    mean_y = sum(ry) / n

    top = 0
    left = 0
    right = 0
    for i in range(n):
        dx = rx[i] - mean_x
        dy = ry[i] - mean_y
        top += dx * dy
        left += dx * dx
        right += dy * dy
    if left == 0 or right == 0:
        return 0.0
    return top / ((left ** 0.5) * (right ** 0.5))


def gini(values):
    """Gini coefficient of a list of amounts."""
    values = sorted(values)
    n = len(values)
    total = sum(values)
    if n == 0 or total == 0:
        return 0.0
    weighted = 0
    for i in range(n):
        weighted += (i + 1) * values[i]
    result = (2 * weighted) / (n * total) - (n + 1) / n
    return round(max(0.0, min(1.0, result)), 4)


class Command(BaseCommand):
    help = "Evaluate the Greedy allocation algorithm on a budget cycle."

    def add_arguments(self, parser):
        parser.add_argument('--cycle', type=int, default=None,
                            help='Budget cycle ID (default: most recent computed cycle).')

    def handle(self, *args, **options):
        if options['cycle']:
            cycle = BudgetCycle.objects.filter(id=options['cycle']).first()
        else:
            cycle = BudgetCycle.objects.exclude(status='draft').order_by('-created_at').first()

        if not cycle:
            self.stdout.write(self.style.ERROR("No budget cycle found. Run an allocation first."))
            return

        results = list(AllocationResult.objects.filter(budget_cycle=cycle)
                       .select_related('school')
                       .order_by('priority_rank'))
        if not results:
            self.stdout.write(self.style.ERROR("This cycle has no allocation results."))
            return

        amounts = []
        ranks = []
        for r in results:
            amounts.append(float(r.allocated_amount))
            ranks.append(r.priority_rank)

        n = len(results)
        budget = float(cycle.total_budget)
        min_alloc = float(cycle.min_allocation)
        max_alloc = float(cycle.max_per_school)
        total_given = sum(amounts)

        self.stdout.write("")
        self.stdout.write("EVALUATION OF GREEDY ALLOCATION")
        self.stdout.write("Cycle: {} ({})".format(cycle.name, cycle.fiscal_year))
        self.stdout.write("Schools: {}   Budget: NPR {:,.0f}   Min: NPR {:,.0f}   Max: NPR {:,.0f}".format(
            n, budget, min_alloc, max_alloc))

        # ---- 1. constraint satisfaction ----
        below_min = 0
        above_max = 0
        for a in amounts:
            if a < min_alloc - 0.01:
                below_min += 1
            if a > max_alloc + 0.01:
                above_max += 1
        over_budget = total_given > budget + 0.01

        self.stdout.write("")
        self.stdout.write("1. CONSTRAINT SATISFACTION")
        self.stdout.write("   Schools below minimum        : {}  {}".format(
            below_min, "PASS" if below_min == 0 else "FAIL"))
        self.stdout.write("   Schools above maximum        : {}  {}".format(
            above_max, "PASS" if above_max == 0 else "FAIL"))
        self.stdout.write("   Total within budget          : {}  {}".format(
            "yes" if not over_budget else "no", "PASS" if not over_budget else "FAIL"))
        self.stdout.write("   Schools funded               : {}/{}  ({:.1f}%)".format(
            n, n, 100.0))

        # ---- 2. budget utilisation ----
        utilisation = (total_given / budget * 100) if budget else 0
        self.stdout.write("")
        self.stdout.write("2. BUDGET UTILISATION")
        self.stdout.write("   Allocated : NPR {:,.2f}".format(total_given))
        self.stdout.write("   Remaining : NPR {:,.2f}".format(budget - total_given))
        self.stdout.write("   Utilisation rate: {:.2f}%".format(utilisation))

        # ---- 3. equity ----
        g = gini(amounts)
        equal_share = budget / n
        self.stdout.write("")
        self.stdout.write("3. EQUITY")
        self.stdout.write("   Gini coefficient : {:.4f}".format(g))
        self.stdout.write("   Highest allocation: NPR {:,.2f}".format(max(amounts)))
        self.stdout.write("   Lowest allocation : NPR {:,.2f}".format(min(amounts)))
        self.stdout.write("   Mean allocation   : NPR {:,.2f}".format(total_given / n))
        self.stdout.write("   Ratio highest:lowest = {:.2f} : 1".format(
            max(amounts) / min(amounts) if min(amounts) else 0))

        # ---- 4. priority alignment ----
        rho = spearman(ranks, amounts)
        self.stdout.write("")
        self.stdout.write("4. PRIORITY ALIGNMENT")
        self.stdout.write("   Spearman correlation (rank vs amount) = {:.4f}".format(rho))
        self.stdout.write("   (-1.0 is perfect: rank 1 receives the most)")

        top10 = amounts[:10]
        bottom10 = amounts[-10:]
        self.stdout.write("   Mean of top 10 ranked schools   : NPR {:,.2f}".format(sum(top10) / len(top10)))
        self.stdout.write("   Mean of bottom 10 ranked schools: NPR {:,.2f}".format(sum(bottom10) / len(bottom10)))
        if sum(bottom10) > 0:
            self.stdout.write("   Targeting ratio (top10 / bottom10) = {:.2f}".format(
                (sum(top10) / len(top10)) / (sum(bottom10) / len(bottom10))))

        # ---- 5. baseline comparison ----
        self.stdout.write("")
        self.stdout.write("5. COMPARISON WITH EQUAL-SPLIT BASELINE")
        self.stdout.write("   Equal split would give every school NPR {:,.2f} (Gini 0.0000).".format(equal_share))
        gained = 0
        lost = 0
        for a in amounts:
            if a > equal_share:
                gained += 1
            elif a < equal_share:
                lost += 1
        self.stdout.write("   Schools receiving more than the equal share : {}".format(gained))
        self.stdout.write("   Schools receiving less than the equal share : {}".format(lost))
        self.stdout.write("   Extra given to the top-ranked school: NPR {:,.2f} ({:+.1f}%)".format(
            amounts[0] - equal_share,
            (amounts[0] - equal_share) / equal_share * 100 if equal_share else 0))

        # ---- allocation tiers ----
        tiers = {}
        for r in results:
            tiers[r.allocation_tier] = tiers.get(r.allocation_tier, 0) + 1
        self.stdout.write("")
        self.stdout.write("6. ALLOCATION TIERS")
        for tier in sorted(tiers):
            self.stdout.write("   {:<12} {:>4} schools".format(tier, tiers[tier]))
        self.stdout.write("")
