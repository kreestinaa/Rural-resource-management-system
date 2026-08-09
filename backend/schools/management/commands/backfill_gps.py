"""
Backfill GPS coordinates for schools that already exist in the database
(for users who ran setup_complete.py before GPS support was added).

Run: python manage.py backfill_gps
"""
import random
from django.core.management.base import BaseCommand
from schools.models import School

DISTRICT_COORDS = {
    'Humla': (29.97, 81.83), 'Dolpa': (29.00, 82.90), 'Mugu': (29.55, 82.30),
    'Jumla': (29.28, 82.18), 'Kalikot': (29.13, 81.62), 'Jajarkot': (28.70, 82.20),
    'Dailekh': (28.84, 81.71), 'Surkhet': (28.60, 81.63), 'Rukum West': (28.63, 82.49),
    'Salyan': (28.38, 82.18),
    'Bajhang': (29.54, 81.20), 'Bajura': (29.50, 81.45), 'Achham': (29.05, 81.30),
    'Doti': (29.27, 80.93), 'Dadeldhura': (29.30, 80.58), 'Baitadi': (29.53, 80.48),
    'Darchula': (29.85, 80.55), 'Kailali': (28.84, 80.92), 'Kanchanpur': (28.83, 80.30),
    'Sarlahi': (26.98, 85.56), 'Mahottari': (26.92, 85.80), 'Dhanusha': (26.81, 86.03),
    'Siraha': (26.65, 86.21), 'Saptari': (26.60, 86.75), 'Rautahat': (26.99, 85.30),
    'Bara': (27.03, 85.04), 'Parsa': (27.12, 84.88),
    'Rolpa': (28.30, 82.64), 'Pyuthan': (28.10, 82.87), 'Arghakhanchi': (27.95, 83.05),
    'Gulmi': (28.07, 83.25), 'Palpa': (27.87, 83.55), 'Kapilvastu': (27.55, 83.05),
    'Nawalparasi West': (27.65, 83.66), 'Dang': (28.00, 82.30), 'Banke': (28.05, 81.62),
    'Bardiya': (28.30, 81.43),
    'Mustang': (28.92, 83.78), 'Manang': (28.67, 84.02), 'Myagdi': (28.60, 83.57),
    'Baglung': (28.27, 83.59), 'Parbat': (28.23, 83.71), 'Syangja': (28.10, 83.87),
    'Gorkha': (28.00, 84.63), 'Lamjung': (28.28, 84.36), 'Tanahun': (27.92, 84.25),
    'Sindhupalchok': (27.95, 85.69), 'Dolakha': (27.78, 86.18), 'Ramechhap': (27.42, 86.08),
    'Sindhuli': (27.26, 85.97), 'Makwanpur': (27.42, 85.03), 'Nuwakot': (27.92, 85.16),
    'Rasuwa': (28.12, 85.30), 'Dhading': (27.87, 84.90), 'Kavrepalanchok': (27.58, 85.56),
    'Taplejung': (27.35, 87.67), 'Panchthar': (27.18, 87.79), 'Ilam': (26.91, 87.93),
    'Terhathum': (27.13, 87.55), 'Sankhuwasabha': (27.62, 87.28), 'Bhojpur': (27.17, 87.05),
    'Dhankuta': (26.98, 87.34), 'Okhaldhunga': (27.32, 86.50), 'Khotang': (27.20, 86.80),
    'Solukhumbu': (27.70, 86.71), 'Udayapur': (26.84, 86.66),
}


class Command(BaseCommand):
    help = "Backfill latitude/longitude for schools missing coordinates"

    def handle(self, *args, **options):
        random.seed(42)
        schools = School.objects.filter(latitude__isnull=True)
        if not schools.exists():
            self.stdout.write(self.style.SUCCESS("All schools already have coordinates."))
            return

        updated = 0
        for school in schools:
            base = DISTRICT_COORDS.get(school.district, (28.39, 84.12))
            school.latitude  = round(base[0] + random.uniform(-0.12, 0.12), 6)
            school.longitude = round(base[1] + random.uniform(-0.12, 0.12), 6)
            school.save(update_fields=["latitude", "longitude"])
            updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Backfilled GPS coordinates for {updated} schools."
        ))
