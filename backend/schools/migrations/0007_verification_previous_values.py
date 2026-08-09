from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0006_school_male_students_male_teachers'),
    ]

    operations = [
        migrations.AddField(
            model_name='dataverificationrequest',
            name='prev_student_teacher_ratio',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='dataverificationrequest',
            name='prev_infrastructure_deficit',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='dataverificationrequest',
            name='prev_material_shortage',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='dataverificationrequest',
            name='prev_geographic_difficulty',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='dataverificationrequest',
            name='prev_socioeconomic_index',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
