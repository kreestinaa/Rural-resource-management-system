import django.db.models.deletion
import schools.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0007_verification_previous_values'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ResourceRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject', models.CharField(help_text='Short subject line to identify this request', max_length=200)),
                ('letter', models.FileField(help_text='Official school letter (PDF, JPG, or PNG)', upload_to=schools.models.letter_upload_path)),
                ('amount_granted', models.DecimalField(blank=True, decimal_places=2, help_text='Amount granted from the annual pool (set by admin on approval)', max_digits=12, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('under_review', 'Under Review'), ('approved', 'Approved'), ('rejected', 'Rejected')], db_index=True, default='pending', max_length=20)),
                ('admin_response', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='resource_requests', to='schools.school')),
                ('submitted_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='submitted_resource_requests', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_resource_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Resource Request',
                'verbose_name_plural': 'Resource Requests',
                'ordering': ['-created_at'],
            },
        ),
    ]
