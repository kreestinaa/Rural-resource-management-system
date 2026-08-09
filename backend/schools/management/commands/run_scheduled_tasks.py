"""
Management command to manually trigger scheduled background tasks.

Usage:
    python manage.py run_scheduled_tasks --task mcda
    python manage.py run_scheduled_tasks --task weekly
    python manage.py run_scheduled_tasks --task all
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Run scheduled tasks on demand (mcda | weekly | all)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--task',
            choices=['mcda', 'weekly', 'all'],
            default='all',
            help='Which task to run (default: all)',
        )

    def handle(self, *args, **options):
        from schools.tasks import run_daily_mcda, run_weekly_summary

        task = options['task']

        if task in ('mcda', 'all'):
            self.stdout.write('Running MCDA ranking...')
            run_daily_mcda()
            self.stdout.write(self.style.SUCCESS('MCDA ranking done.'))

        if task in ('weekly', 'all'):
            self.stdout.write('Running weekly summary...')
            run_weekly_summary()
            self.stdout.write(self.style.SUCCESS('Weekly summary done.'))
