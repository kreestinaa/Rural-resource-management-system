from django.db.models.signals import post_save
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver


@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    from .models import AuditLog
    AuditLog.log(
        user=user,
        action='user_login',
        model_name='User',
        object_id=user.id,
        details={'username': user.username},
        request=request,
    )


@receiver(post_save, sender='allocation.BudgetCycle')
def log_budget_cycle_save(sender, instance, created, **kwargs):
    from .models import AuditLog
    action = 'allocation_cycle_created' if created else 'allocation_cycle_updated'
    AuditLog.log(
        user=instance.created_by,
        action=action,
        model_name='BudgetCycle',
        object_id=instance.id,
        details={
            'name': instance.name,
            'fiscal_year': instance.fiscal_year,
            'status': instance.status,
            'total_budget': str(instance.total_budget),
        },
    )


@receiver(post_save, sender='schools.School')
def log_school_update(sender, instance, created, **kwargs):
    if not created:
        from .models import AuditLog
        AuditLog.log(
            user=None,
            action='school_profile_updated',
            model_name='School',
            object_id=instance.id,
            details={'name': instance.name, 'emis': instance.emis},
        )


@receiver(post_save, sender='schools.ResourceRequest')
def log_resource_request(sender, instance, created, **kwargs):
    """Audit a school's resource-request letter and the admin's decision."""
    from .models import AuditLog
    if created:
        action = 'resource_request_submitted'
        user = instance.submitted_by
    else:
        action = f'resource_request_{instance.status}'   # ..._approved / ..._rejected
        user = instance.reviewed_by or instance.submitted_by

    AuditLog.log(
        user=user,
        action=action,
        model_name='ResourceRequest',
        object_id=instance.id,
        details={
            'school': instance.school.name,
            'emis': instance.school.emis,
            'subject': instance.subject,
            'status': instance.status,
            'amount_granted': str(instance.amount_granted) if instance.amount_granted else None,
        },
    )


@receiver(post_save, sender='allocation.DiscretionaryGrant')
def log_discretionary_grant(sender, instance, created, **kwargs):
    """Audit money granted from the annual pool via an approved letter."""
    from .models import AuditLog
    if not created:
        return
    AuditLog.log(
        user=instance.granted_by,
        action='discretionary_grant_made',
        model_name='DiscretionaryGrant',
        object_id=instance.id,
        details={
            'school': instance.school.name,
            'emis': instance.school.emis,
            'amount': str(instance.amount),
            'fiscal_year': instance.fiscal_budget.fiscal_year,
            'pool_remaining_after': str(instance.fiscal_budget.available),
            'request_subject': instance.resource_request.subject,
        },
    )


@receiver(post_save, sender='allocation.FiscalYearBudget')
def log_fiscal_year_budget(sender, instance, created, **kwargs):
    """Audit creation/edit of the annual budget pool."""
    from .models import AuditLog
    AuditLog.log(
        user=None,
        action='annual_budget_created' if created else 'annual_budget_updated',
        model_name='FiscalYearBudget',
        object_id=instance.id,
        details={
            'fiscal_year': instance.fiscal_year,
            'total_amount': str(instance.total_amount),
        },
    )
