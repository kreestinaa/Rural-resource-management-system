"""
Scheduled background tasks for the schools module.

Registered with django-apscheduler via AppConfig.ready().
Run manually with: python manage.py run_scheduled_tasks
"""
import logging
from django.core.cache import cache

logger = logging.getLogger('schools')


def run_daily_mcda():
    """
    Nightly MCDA re-ranking for all schools.

    Runs at midnight Nepal time (Asia/Kathmandu).
    Invalidates ranking/stats caches after completion.
    """
    from schools.models import School
    from schools.algorithms.mcda import MCDAEngine

    logger.info('Scheduled MCDA ranking started.')
    try:
        engine = MCDAEngine()
        schools_qs = School.objects.all()
        updated = engine.update_school_priorities(schools_qs)
        # Invalidate stale caches
        cache.delete('school_stats')
        for k in ('', '10', '20', '50', '100', '150'):
            cache.delete(f'school_rankings:{k}')
        logger.info('Scheduled MCDA ranking completed: %d schools updated.', len(updated))
    except Exception:
        logger.exception('Scheduled MCDA ranking failed.')


def run_weekly_summary():
    """
    Weekly summary: logs stats snapshot and clears district caches.

    Runs every Monday at 06:00 Nepal time.
    """
    from schools.models import School
    from allocation.models import BudgetCycle
    from django.db.models import Avg, Count

    logger.info('Weekly summary task started.')
    try:
        total = School.objects.count()
        ranked = School.objects.filter(priority_rank__isnull=False).count()
        avg_score = School.objects.aggregate(a=Avg('priority_score'))['a'] or 0
        latest_cycle = BudgetCycle.objects.order_by('-created_at').first()

        logger.info(
            'Weekly snapshot | total=%d | ranked=%d | avg_score=%.4f | latest_cycle=%s',
            total, ranked, avg_score,
            latest_cycle.name if latest_cycle else 'none',
        )

        # Clear district caches so next request fetches fresh data
        from schools.models import PROVINCE_CHOICES
        for prov, _ in PROVINCE_CHOICES:
            cache.delete(f'school_districts:{prov}')
        cache.delete('school_districts:')
        cache.delete('school_stats')
    except Exception:
        logger.exception('Weekly summary task failed.')
