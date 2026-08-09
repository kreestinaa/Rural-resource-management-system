from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0005_dataverificationrequest_rankingappeal_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='school',
            name='male_students',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='school',
            name='male_teachers',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
