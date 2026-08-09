import sys
from django.apps import AppConfig


class SchoolsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'schools'

    def ready(self):
        # Don't start scheduler during migrations or tests
        if 'migrate' in sys.argv or 'test' in sys.argv:
            return
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from apscheduler.triggers.cron import CronTrigger
            from django_apscheduler.jobstores import DjangoJobStore
            from schools.tasks import run_daily_mcda, run_weekly_summary

            scheduler = BackgroundScheduler(timezone='Asia/Kathmandu')
            scheduler.add_jobstore(DjangoJobStore(), 'default')

            scheduler.add_job(
                run_daily_mcda,
                trigger=CronTrigger(hour=0, minute=0),
                id='daily_mcda',
                name='Nightly MCDA ranking',
                replace_existing=True,
            )
            scheduler.add_job(
                run_weekly_summary,
                trigger=CronTrigger(day_of_week='mon', hour=6, minute=0),
                id='weekly_summary',
                name='Weekly stats summary',
                replace_existing=True,
            )
            scheduler.start()
        except Exception:
            import logging
            logging.getLogger('schools').exception('APScheduler failed to start.')
