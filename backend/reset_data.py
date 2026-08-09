import os
import sys
import shutil

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User                       # noqa: E402
from django.core.cache import cache                               # noqa: E402
from django.conf import settings                                  # noqa: E402

from schools.models import (                                      # noqa: E402
    School, SchoolUser, ReviewRequest, DataVerificationRequest,
    RankingAppeal, ResourceRequest,
)
from allocation.models import (                                   # noqa: E402
    FiscalYearBudget, BudgetCycle, AllocationResult, DiscretionaryGrant,
)
from notifications.models import Notification                     # noqa: E402
from audit.models import AuditLog                                 # noqa: E402


def clear_transactions():
    """Everything the system generates while you use it."""
    counts = {}

    # Order matters — children before parents
    counts['Discretionary grants'] = DiscretionaryGrant.objects.all().delete()[
        0]
    counts['Allocation results'] = AllocationResult.objects.all().delete()[0]
    counts['Budget cycles'] = BudgetCycle.objects.all().delete()[0]
    counts['Fiscal year budgets'] = FiscalYearBudget.objects.all().delete()[0]

    counts['Resource requests'] = ResourceRequest.objects.all().delete()[0]
    counts['Data verifications'] = DataVerificationRequest.objects.all().delete()[
        0]
    counts['Ranking appeals'] = RankingAppeal.objects.all().delete()[0]
    counts['Review requests'] = ReviewRequest.objects.all().delete()[0]

    counts['Notifications'] = Notification.objects.all().delete()[0]
    counts['Audit log entries'] = AuditLog.objects.all().delete()[0]

    # Reset every school's computed ranking so you start from a clean slate
    # (priority_score is non-nullable with default 0.0; rank IS nullable)
    reset = School.objects.update(
        priority_score=0.0,
        priority_rank=None,
        last_ranking_date=None,
    )
    counts['School rankings reset'] = reset

    # Delete uploaded letters from disk.
    # On Windows this can fail if OneDrive (or the running Django server) still
    # holds a handle on the folder. That must NOT abort the reset — the database
    # is already cleared by this point, and stray files are harmless.
    media_root = getattr(settings, 'MEDIA_ROOT', None)
    if media_root:
        letters_dir = os.path.join(str(media_root), 'resource_letters')
        if os.path.isdir(letters_dir):
            try:
                shutil.rmtree(letters_dir)
                counts['Uploaded letters (files)'] = 'deleted'
            except (PermissionError, OSError) as exc:
                counts['Uploaded letters (files)'] = f'SKIPPED (locked: {exc.__class__.__name__})'
                print(
                    "\n  ! Could not delete uploaded letter files — the folder is locked\n"
                    "    (usually OneDrive syncing, or the Django server still running).\n"
                    "    This is harmless: the database is already cleared. To remove them,\n"
                    "    stop the server and delete this folder by hand:\n"
                    f"      {letters_dir}\n"
                )

    # Clear login lockouts / cached rankings
    cache.clear()
    counts['Cache'] = 'cleared'

    return counts


def clear_schools_and_users():
    """Also remove schools and school accounts. Keeps admin superusers."""
    counts = {}
    counts['School user links'] = SchoolUser.objects.all().delete()[0]
    counts['Schools'] = School.objects.all().delete()[0]

    non_admins = User.objects.filter(is_superuser=False, is_staff=False)
    counts['School user accounts'] = non_admins.count()
    non_admins.delete()

    return counts


def main():
    args = sys.argv[1:]
    full = '--all' in args
    transactions = '--transactions' in args or full
    skip_confirm = '--yes' in args

    if not transactions:
        print(__doc__)
        return

    print("=" * 66)
    print("RESET — Rural Resource Allocation Management System")
    print("=" * 66)
    print("\nThis will DELETE:")
    print("  • All fiscal year budgets, budget cycles, allocations, grants")
    print("  • All resource requests (and uploaded letters), verifications, appeals")
    print("  • All notifications and audit log entries")
    print("  • All computed school rankings (scores reset to empty)")
    if full:
        print("  • ALL 150 SCHOOLS and every school user account")
        print("    (admin superuser is kept)")
    else:
        print("\nThis will KEEP:")
        print("  • The 150 schools and their indicator data")
        print("  • All user accounts (admin + schools)")

    if not skip_confirm:
        print()
        answer = input("Type 'yes' to continue: ").strip().lower()
        if answer != 'yes':
            print("Aborted. Nothing was deleted.")
            return

    print("\nClearing...")
    counts = clear_transactions()
    if full:
        counts.update(clear_schools_and_users())

    print("\n" + "-" * 66)
    for label, n in counts.items():
        print(f"  {label:<32} {n}")
    print("-" * 66)

    print("\n✅ Reset complete.\n")
    print("NEXT STEPS:")
    if full:
        print("  1. python setup_complete.py       # reseed 150 schools + demo users")
        print("  2. python manage.py runserver")
    else:
        print("  1. python manage.py runserver")
        print("  2. Log in as admin")
        print("  3. Annual Budget  → create a fiscal year pool")
        print("  4. Rankings       → Compute Rankings")
        print("  5. Allocation     → run a cycle")
        print("  6. Test school side: verifications, appeals, resource requests")


if __name__ == '__main__':
    main()
