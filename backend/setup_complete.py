#!/usr/bin/env python
"""
Auto-setup script for Rural Resource Allocation System.

Usage:
    python setup_complete.py

This script:
1. Runs Django migrations
2. Creates superuser (admin / admin123)
3. Generates 150 rural Nepal government school records
4. Runs initial MCDA computation
"""
import os
import sys
import subprocess
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')


def run_cmd(cmd, desc=""):
    print(f"\n{'='*55}")
    print(f"  {desc or cmd}")
    print('='*55)
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"\n[ERROR] Command failed: {cmd}")
        sys.exit(1)
    print("  Done!")


def main():
    banner = "RURAL RESOURCE ALLOCATION — AUTO SETUP"
    print("\n" + "=" * 55)
    print(f"  {banner}")
    print("=" * 55)

    # Migrations
    run_cmd(f'"{sys.executable}" manage.py makemigrations', "Creating migrations")
    run_cmd(f'"{sys.executable}" manage.py migrate', "Applying migrations")
    run_cmd(f'"{sys.executable}" manage.py collectstatic --noinput', "Collecting static files")

    # Django setup
    import django
    django.setup()

    # Superuser
    from django.contrib.auth.models import User
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@asmt.edu.np', 'admin123')
        print("\n  Superuser created: admin / admin123")
    else:
        print("\n  Superuser already exists.")

    # Sample Data
    print("\n  Generating 150 rural Nepal government school records...")
    generate_schools()

    # MCDA
    print("\n  Running initial MCDA computation...")
    from schools.models import School
    from schools.algorithms.mcda import MCDAEngine
    engine = MCDAEngine()
    engine.update_school_priorities(School.objects.all())
    print(f"  MCDA computed for {School.objects.count()} schools.")

    # Demo school accounts
    from schools.models import SchoolUser
    demo_accounts = [
        {'username': 'school_karnali',  'password': 'karnali123', 'rank_target': 1},
        {'username': 'school_lumbini',  'password': 'lumbini123', 'rank_target': 75},
        {'username': 'school_bagmati',  'password': 'bagmati123', 'rank_target': 145},
    ]
    for acc in demo_accounts:
        if not User.objects.filter(username=acc['username']).exists():
            school = School.objects.filter(priority_rank=acc['rank_target']).first() or School.objects.first()
            user = User.objects.create_user(username=acc['username'], password=acc['password'])
            SchoolUser.objects.get_or_create(user=user, defaults={'school': school, 'role': 'principal'})
            print(f"  Demo account: {acc['username']} / {acc['password']} -> {school.name if school else 'N/A'}")

    # Summary
    print("\n" + "=" * 55)
    print("  SETUP COMPLETE!")
    print("=" * 55)
    print("\n  Access Points:")
    print("    Frontend   :  http://localhost:5173")
    print("    Backend API:  http://localhost:8000/api/")
    print("    Admin Panel:  http://localhost:8000/admin/")
    print("\n  Credentials:  admin / admin123")
    print("\n  Start backend:  python manage.py runserver")
    print("  Start frontend: cd ../frontend && npm run dev")
    print()


# Rural-only districts (no urban centres)
PROVINCES = {
    'karnali': ['Humla', 'Dolpa', 'Mugu', 'Jumla', 'Kalikot',
                'Jajarkot', 'Dailekh', 'Surkhet', 'Rukum West', 'Salyan'],
    'sudurpashchim': ['Bajhang', 'Bajura', 'Achham', 'Doti', 'Dadeldhura',
                      'Baitadi', 'Darchula', 'Kailali', 'Kanchanpur'],
    'madhesh': ['Sarlahi', 'Mahottari', 'Dhanusha', 'Siraha',
                'Saptari', 'Rautahat', 'Bara', 'Parsa'],
    'lumbini': ['Rolpa', 'Pyuthan', 'Arghakhanchi', 'Gulmi', 'Palpa',
                'Kapilvastu', 'Nawalparasi West', 'Dang', 'Banke', 'Bardiya'],
    'gandaki': ['Mustang', 'Manang', 'Myagdi', 'Baglung', 'Parbat',
                'Syangja', 'Gorkha', 'Lamjung', 'Tanahun'],
    'bagmati': ['Sindhupalchok', 'Dolakha', 'Ramechhap', 'Sindhuli',
                'Makwanpur', 'Nuwakot', 'Rasuwa', 'Dhading', 'Kavrepalanchok'],
    'province1': ['Taplejung', 'Panchthar', 'Ilam', 'Terhathum',
                  'Sankhuwasabha', 'Bhojpur', 'Dhankuta', 'Okhaldhunga',
                  'Khotang', 'Solukhumbu', 'Udayapur'],
}

# Fixed counts — remote provinces get more schools (total = 150)
PROVINCE_COUNTS = {
    'karnali':       30,
    'sudurpashchim': 25,
    'lumbini':       22,
    'gandaki':       20,
    'madhesh':       20,
    'province1':     18,
    'bagmati':       15,
}

PREFIXES = [
    'Shree', 'Jana Jyoti', 'Adarsha', 'Rastriya', 'Janapriya',
    'Saraswati', 'Gyanodaya', 'Navajyoti', 'Janata', 'Bal Kalyan',
    'Himalaya', 'Tribhuvan', 'Bhanu', 'Pragati', 'Janahit',
]

SUFFIXES = [
    'Primary School', 'Lower Secondary School',
    'Secondary School', 'Basic School', 'Community School', 'Ma Vi',
]

# Per-province indicator ranges — remote/mountain provinces are most needy
PROVINCE_PROFILES = {
    'karnali':       {'str': (40, 70), 'infra': (65, 95), 'material': (60, 90), 'geo': (75, 95), 'socio': (78, 95)},
    'sudurpashchim': {'str': (35, 65), 'infra': (58, 92), 'material': (55, 88), 'geo': (65, 92), 'socio': (68, 92)},
    'madhesh':       {'str': (45, 75), 'infra': (45, 78), 'material': (42, 75), 'geo': (10, 25), 'socio': (58, 82)},
    'lumbini':       {'str': (28, 58), 'infra': (38, 72), 'material': (35, 70), 'geo': (22, 58), 'socio': (42, 72)},
    'gandaki':       {'str': (22, 48), 'infra': (32, 68), 'material': (30, 65), 'geo': (42, 72), 'socio': (32, 62)},
    'bagmati':       {'str': (18, 42), 'infra': (25, 58), 'material': (22, 52), 'geo': (18, 45), 'socio': (22, 48)},
    'province1':     {'str': (25, 52), 'infra': (32, 68), 'material': (30, 65), 'geo': (32, 68), 'socio': (38, 68)},
}



# District approximate GPS coordinates (lat, lon) for map pins
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


def generate_schools():
    from schools.models import School

    if School.objects.count() >= 150:
        print("  Schools already exist. Skipping generation.")
        return

    emis_set = set()
    schools_to_create = []

    for province, count in PROVINCE_COUNTS.items():
        p = PROVINCE_PROFILES[province]
        districts = PROVINCES[province]

        for _ in range(count):
            district = random.choice(districts)

            # GPS coordinates with small jitter so schools don't stack on one pin
            base_lat, base_lon = DISTRICT_COORDS.get(district, (28.39, 84.12))
            lat = round(base_lat + random.uniform(-0.12, 0.12), 6)
            lon = round(base_lon + random.uniform(-0.12, 0.12), 6)

            # Unique EMIS code
            emis = None
            while emis is None or emis in emis_set:
                emis = f"NP{random.randint(10000, 99999)}"
            emis_set.add(emis)

            # Rural government schools are small
            students = random.randint(40, 350)
            teachers = random.randint(2, 12)

            name = (
                f"{random.choice(PREFIXES)} {district} "
                f"{random.choice(SUFFIXES)} No.{random.randint(1, 9)}"
            )

            schools_to_create.append(School(
                name=name,
                emis=emis,
                province=province,
                district=district,
                municipality=f"{district} Rural Municipality",
                ward_number=random.randint(1, 33),
                school_type=random.choice(['primary', 'lower_secondary', 'secondary']),
                is_rural=True,  # ALL schools are rural — no exceptions
                students=students,
                teachers=teachers,
                classrooms=max(1, students // 40 + random.randint(-1, 2)),
                female_students=(fem_s := int(students * random.uniform(0.40, 0.52))),
                female_teachers=(fem_t := int(teachers * random.uniform(0.20, 0.45))),
                male_students=students - fem_s,
                male_teachers=teachers - fem_t,
                student_teacher_ratio=round(random.uniform(*p['str']), 1),
                infrastructure_deficit=round(random.uniform(*p['infra']), 1),
                material_shortage=round(random.uniform(*p['material']), 1),
                geographic_difficulty=round(random.uniform(*p['geo']), 1),
                socioeconomic_index=round(random.uniform(*p['socio']), 1),
                latitude=lat,
                longitude=lon,
            ))

    School.objects.bulk_create(schools_to_create)
    print(f"  Created {len(schools_to_create)} rural government schools across 7 provinces.")


if __name__ == '__main__':
    main()
