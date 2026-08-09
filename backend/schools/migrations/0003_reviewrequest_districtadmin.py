from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        ('schools', '0002_alter_school_emis_alter_school_geographic_difficulty_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReviewRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('note', models.TextField()),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('approved', 'Approved'),
                        ('rejected', 'Rejected'),
                    ],
                    default='pending',
                    max_length=20
                )),
                ('admin_response', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='review_requests',
                    to='schools.school'
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='DistrictAdmin',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provinces', models.JSONField(default=list, help_text='List of province keys this admin can view')),
                ('districts', models.JSONField(default=list, help_text='List of district names this admin can view')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='district_admin_profile',
                    to='auth.user'
                )),
            ],
            options={
                'verbose_name': 'District Admin',
                'verbose_name_plural': 'District Admins',
            },
        ),
    ]
