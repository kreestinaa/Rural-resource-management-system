from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Q
import logging

logger = logging.getLogger('schools')

PROVINCE_CHOICES = [
    ('bagmati', 'Bagmati Province'),
    ('gandaki', 'Gandaki Province'),
    ('province1', 'Province No. 1 (Koshi)'),
    ('madhesh', 'Madhesh Province'),
    ('lumbini', 'Lumbini Province'),
    ('karnali', 'Karnali Province'),
    ('sudurpashchim', 'Sudurpashchim Province'),
]

SCHOOL_TYPE_CHOICES = [
    ('primary', 'Primary (1-5)'),
    ('lower_secondary', 'Lower Secondary (1-8)'),
    ('secondary', 'Secondary (1-10)'),
    ('higher_secondary', 'Higher Secondary (1-12)'),
]

REVIEW_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]


class School(models.Model):
    name = models.CharField(max_length=200, db_index=True)
    emis = models.CharField(max_length=20, unique=True)
    province = models.CharField(max_length=30, choices=PROVINCE_CHOICES, db_index=True)
    district = models.CharField(max_length=100, db_index=True)
    municipality = models.CharField(max_length=100, blank=True)
    ward_number = models.PositiveIntegerField(null=True, blank=True)
    school_type = models.CharField(max_length=20, choices=SCHOOL_TYPE_CHOICES, default='primary')
    is_rural = models.BooleanField(default=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    students = models.PositiveIntegerField(default=0)
    teachers = models.PositiveIntegerField(default=1)
    classrooms = models.PositiveIntegerField(default=1)
    female_students = models.PositiveIntegerField(default=0)
    female_teachers = models.PositiveIntegerField(default=0)
    male_students = models.PositiveIntegerField(default=0)
    male_teachers = models.PositiveIntegerField(default=0)

    student_teacher_ratio = models.FloatField(default=0.0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    infrastructure_deficit = models.FloatField(default=0.0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    material_shortage = models.FloatField(default=0.0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    geographic_difficulty = models.FloatField(default=0.0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    socioeconomic_index = models.FloatField(default=0.0, validators=[MinValueValidator(0), MaxValueValidator(100)])

    priority_score = models.FloatField(default=0.0, validators=[MinValueValidator(0), MaxValueValidator(1)])
    priority_rank = models.PositiveIntegerField(null=True, blank=True)
    teacher_demand = models.IntegerField(default=0)

    ranking_history = models.JSONField(default=list)
    improvement_score = models.FloatField(default=0.0)
    last_ranking_date = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['priority_rank', 'name']
        indexes = [
            models.Index(fields=['province', 'district']),
            models.Index(fields=['province', 'priority_rank']),
            models.Index(fields=['district', 'is_rural']),
            models.Index(fields=['priority_rank']),
            models.Index(fields=['priority_score']),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(student_teacher_ratio__gte=0) & Q(student_teacher_ratio__lte=100),
                name='school_str_range',
            ),
            models.CheckConstraint(
                check=Q(infrastructure_deficit__gte=0) & Q(infrastructure_deficit__lte=100),
                name='school_infra_range',
            ),
            models.CheckConstraint(
                check=Q(material_shortage__gte=0) & Q(material_shortage__lte=100),
                name='school_materials_range',
            ),
            models.CheckConstraint(
                check=Q(geographic_difficulty__gte=0) & Q(geographic_difficulty__lte=100),
                name='school_geo_range',
            ),
            models.CheckConstraint(
                check=Q(socioeconomic_index__gte=0) & Q(socioeconomic_index__lte=100),
                name='school_ses_range',
            ),
            models.CheckConstraint(
                check=Q(priority_score__gte=0) & Q(priority_score__lte=1),
                name='school_priority_score_range',
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.emis}) - {self.district}"

    @property
    def student_teacher_ratio_raw(self):
        if self.teachers == 0:
            return 0
        return round(self.students / self.teachers, 1)

    @property
    def computed_teacher_demand(self):
        required = max(1, self.students // 30)
        return max(0, required - self.teachers)

    def save(self, *args, **kwargs):
        self.teacher_demand = self.computed_teacher_demand
        super().save(*args, **kwargs)


class SchoolUser(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='school_profile')
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='user_account')
    role = models.CharField(max_length=50, default='principal', choices=[
        ('principal', 'Principal'),
        ('teacher', 'Teacher'),
        ('admin_staff', 'Administrative Staff'),
    ])
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} → {self.school.name}"


class ReviewRequest(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='review_requests')
    note = models.TextField()
    status = models.CharField(max_length=20, choices=REVIEW_STATUS_CHOICES, default='pending')
    admin_response = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ReviewRequest({self.school.name}, {self.status})"


class DataVerificationRequest(models.Model):
    STATUS = [('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')]
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='verification_requests')
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submitted_verifications')
    student_teacher_ratio = models.FloatField()
    infrastructure_deficit = models.FloatField()
    material_shortage = models.FloatField()
    geographic_difficulty = models.FloatField()
    socioeconomic_index = models.FloatField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS, default='pending', db_index=True)
    admin_note = models.TextField(blank=True)
    # Snapshot of the school's values at the moment of approval (for showing the
    # applied change on approved cards). Null until approved.
    prev_student_teacher_ratio = models.FloatField(null=True, blank=True)
    prev_infrastructure_deficit = models.FloatField(null=True, blank=True)
    prev_material_shortage = models.FloatField(null=True, blank=True)
    prev_geographic_difficulty = models.FloatField(null=True, blank=True)
    prev_socioeconomic_index = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='reviewed_verifications'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"VerificationRequest({self.school.name}, {self.status})"


class RankingAppeal(models.Model):
    STATUS = [
        ('pending', 'Pending'),
        ('under_review', 'Under Review'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='appeals')
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submitted_appeals')
    current_rank = models.IntegerField()
    current_score = models.FloatField()
    reason = models.TextField()
    supporting_notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default='pending', db_index=True)
    admin_response = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='reviewed_appeals'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Appeal({self.school.name}, rank #{self.current_rank}, {self.status})"


class DistrictAdmin(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='district_admin_profile')
    provinces = models.JSONField(default=list, help_text="List of province keys this admin can view")
    districts = models.JSONField(default=list, help_text="List of district names this admin can view")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'District Admin'
        verbose_name_plural = 'District Admins'

    def __str__(self):
        return f"DistrictAdmin({self.user.username})"

    def can_access_school(self, school):
        if self.provinces and school.province not in self.provinces:
            return False
        if self.districts and school.district not in self.districts:
            return False
        return True


def letter_upload_path(instance, filename):
    """Store letters under media/resource_letters/<school_id>/<filename>."""
    return f"resource_letters/{instance.school_id}/{filename}"


class ResourceRequest(models.Model):
    """A school's formal request for resources, backed by an uploaded official
    letter (PDF or image). All request detail lives inside the letter; the form
    only captures a subject line for identification."""
    STATUS = [
        ('pending', 'Pending'),
        ('under_review', 'Under Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='resource_requests')
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submitted_resource_requests')
    subject = models.CharField(max_length=200, help_text="Short subject line to identify this request")
    letter = models.FileField(
        upload_to=letter_upload_path,
        help_text="Official school letter (PDF, JPG, or PNG)",
    )
    amount_granted = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Amount granted from the annual pool (set by admin on approval)",
    )
    status = models.CharField(max_length=20, choices=STATUS, default='pending', db_index=True)
    admin_response = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_resource_requests',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Resource Request'
        verbose_name_plural = 'Resource Requests'

    def __str__(self):
        return f"ResourceRequest({self.school.name} — {self.subject} — {self.status})"
