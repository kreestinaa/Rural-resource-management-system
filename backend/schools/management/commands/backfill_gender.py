"""Backfill male_students / male_teachers = total - female for existing schools.
Run: python manage.py backfill_gender"""
from django.core.management.base import BaseCommand
from schools.models import School


class Command(BaseCommand):
    help = "Set male counts = total - female for schools that have none"

    def handle(self, *args, **options):
        updated = 0
        for s in School.objects.all():
            new_ms = max(0, s.students - s.female_students)
            new_mt = max(0, s.teachers - s.female_teachers)
            if s.male_students != new_ms or s.male_teachers != new_mt:
                s.male_students = new_ms
                s.male_teachers = new_mt
                s.save(update_fields=['male_students', 'male_teachers'])
                updated += 1
        self.stdout.write(self.style.SUCCESS(f"Backfilled gender split for {updated} schools."))
