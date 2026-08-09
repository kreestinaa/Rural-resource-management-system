import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('allocation', '0002_allocationresult_disbursed_at_and_more'),
        ('schools', '0008_resourcerequest'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FiscalYearBudget',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fiscal_year', models.CharField(help_text='e.g. 2081/82 (Nepali fiscal year)', max_length=10, unique=True)),
                ('name', models.CharField(blank=True, max_length=200)),
                ('total_amount', models.DecimalField(decimal_places=2, help_text='Total annual budget in NPR', max_digits=15, validators=[django.core.validators.MinValueValidator(0)])),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Fiscal Year Budget',
                'verbose_name_plural': 'Fiscal Year Budgets',
                'ordering': ['-fiscal_year'],
            },
        ),
        migrations.AddField(
            model_name='budgetcycle',
            name='fiscal_budget',
            field=models.ForeignKey(blank=True, help_text='Annual budget pool this cycle draws from', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='cycles', to='allocation.fiscalyearbudget'),
        ),
        migrations.CreateModel(
            name='DiscretionaryGrant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, help_text='Amount granted in NPR', max_digits=12, validators=[django.core.validators.MinValueValidator(0)])),
                ('granted_at', models.DateTimeField(auto_now_add=True)),
                ('disbursement_status', models.CharField(choices=[('pending', 'Pending'), ('disbursed', 'Disbursed')], default='pending', max_length=20)),
                ('disbursed_at', models.DateTimeField(blank=True, null=True)),
                ('fiscal_budget', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='discretionary_grants', to='allocation.fiscalyearbudget')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='discretionary_grants', to='schools.school')),
                ('resource_request', models.OneToOneField(help_text='The approved letter this grant was made against', on_delete=django.db.models.deletion.CASCADE, related_name='grant', to='schools.resourcerequest')),
                ('granted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='discretionary_grants_made', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Discretionary Grant',
                'verbose_name_plural': 'Discretionary Grants',
                'ordering': ['-granted_at'],
            },
        ),
    ]
