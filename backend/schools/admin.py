from django.contrib import admin
from django.utils.html import format_html
from .models import School, SchoolUser, ReviewRequest, DistrictAdmin


@admin.register(ReviewRequest)
class ReviewRequestAdmin(admin.ModelAdmin):
    list_display = ['school', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['school__name', 'note']


@admin.register(DistrictAdmin)
class DistrictAdminAdmin(admin.ModelAdmin):
    list_display = ['user', 'provinces', 'districts', 'created_at']
    search_fields = ['user__username']


@admin.register(SchoolUser)
class SchoolUserAdmin(admin.ModelAdmin):
    list_display = ['user', 'school', 'role', 'created_at']
    search_fields = ['user__username', 'school__name', 'school__emis']
    list_filter = ['role']


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'emis', 'province', 'district',
        'students', 'teachers', 'priority_rank_display',
        'priority_score_display', 'is_rural', 'has_user_account',
    ]
    list_filter = ['province', 'school_type', 'is_rural']
    search_fields = ['name', 'emis', 'district', 'municipality']
    ordering = ['priority_rank']
    readonly_fields = [
        'priority_score', 'priority_rank', 'teacher_demand',
        'ranking_history', 'improvement_score', 'last_ranking_date',
        'created_at', 'updated_at',
    ]
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'emis', 'province', 'district', 'municipality', 'ward_number', 'school_type', 'is_rural')
        }),
        ('Student & Staff', {
            'fields': ('students', 'teachers', 'classrooms', 'female_students', 'female_teachers')
        }),
        ('MCDA Indicators (0-100)', {
            'fields': ('student_teacher_ratio', 'infrastructure_deficit', 'material_shortage', 'geographic_difficulty', 'socioeconomic_index'),
            'description': 'Higher values = greater need/deficit.'
        }),
        ('Priority Scores (Computed)', {
            'fields': ('priority_score', 'priority_rank', 'teacher_demand', 'improvement_score', 'last_ranking_date')
        }),
        ('History', {'fields': ('ranking_history',), 'classes': ('collapse',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    def has_user_account(self, obj):
        has = SchoolUser.objects.filter(school=obj).exists()
        color = '#27ae60' if has else '#e74c3c'
        label = '✓ Yes' if has else '✗ No'
        return format_html('<span style="color: {};">{}</span>', color, label)
    has_user_account.short_description = 'Has Login'

    def priority_rank_display(self, obj):
        if obj.priority_rank:
            color = '#e74c3c' if obj.priority_rank <= 10 else ('#f39c12' if obj.priority_rank <= 50 else '#27ae60')
            return format_html('<span style="color: {}; font-weight: bold;">#{}</span>', color, obj.priority_rank)
        return '—'
    priority_rank_display.short_description = 'Rank'

    def priority_score_display(self, obj):
        color = '#e74c3c' if obj.priority_score >= 0.7 else ('#f39c12' if obj.priority_score >= 0.4 else '#27ae60')
        return format_html('<span style="color: {};">{:.3f}</span>', color, obj.priority_score)
    priority_score_display.short_description = 'Score'
