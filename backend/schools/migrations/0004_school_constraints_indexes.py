from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0003_reviewrequest_districtadmin'),
    ]

    operations = [
        # New composite indexes
        migrations.AddIndex(
            model_name='school',
            index=models.Index(fields=['province', 'priority_rank'], name='school_prov_rank_idx'),
        ),
        migrations.AddIndex(
            model_name='school',
            index=models.Index(fields=['district', 'is_rural'], name='school_dist_rural_idx'),
        ),

        # CHECK constraints for indicator ranges
        migrations.AddConstraint(
            model_name='school',
            constraint=models.CheckConstraint(
                check=models.Q(student_teacher_ratio__gte=0) & models.Q(student_teacher_ratio__lte=100),
                name='school_str_range',
            ),
        ),
        migrations.AddConstraint(
            model_name='school',
            constraint=models.CheckConstraint(
                check=models.Q(infrastructure_deficit__gte=0) & models.Q(infrastructure_deficit__lte=100),
                name='school_infra_range',
            ),
        ),
        migrations.AddConstraint(
            model_name='school',
            constraint=models.CheckConstraint(
                check=models.Q(material_shortage__gte=0) & models.Q(material_shortage__lte=100),
                name='school_materials_range',
            ),
        ),
        migrations.AddConstraint(
            model_name='school',
            constraint=models.CheckConstraint(
                check=models.Q(geographic_difficulty__gte=0) & models.Q(geographic_difficulty__lte=100),
                name='school_geo_range',
            ),
        ),
        migrations.AddConstraint(
            model_name='school',
            constraint=models.CheckConstraint(
                check=models.Q(socioeconomic_index__gte=0) & models.Q(socioeconomic_index__lte=100),
                name='school_ses_range',
            ),
        ),
        migrations.AddConstraint(
            model_name='school',
            constraint=models.CheckConstraint(
                check=models.Q(priority_score__gte=0) & models.Q(priority_score__lte=1),
                name='school_priority_score_range',
            ),
        ),
    ]
