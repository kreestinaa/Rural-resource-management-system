import re
from django.core.management.base import BaseCommand
from schools.models import School


class Command(BaseCommand):
    help = "Remove the trailing 'No.X' from every school name (e.g. 'ABC School No.3' -> 'ABC School')."

    def handle(self, *args, **options):
        schools = list(School.objects.all())
        changed = []

        for school in schools:
            new_name = re.sub(r'\s*No\.\d+\s*$', '', school.name).strip()
            if new_name and new_name != school.name:
                school.name = new_name
                changed.append(school)

        School.objects.bulk_update(changed, ['name'], batch_size=200)
        self.stdout.write(self.style.SUCCESS(f"Updated {len(changed)} school names."))
