from rest_framework import serializers
from .models import School, ReviewRequest, DataVerificationRequest, RankingAppeal, ResourceRequest


class SchoolListSerializer(serializers.ModelSerializer):
    student_teacher_ratio_raw = serializers.ReadOnlyField()

    class Meta:
        model = School
        fields = [
            'id', 'name', 'emis', 'province', 'district',
            'school_type', 'is_rural', 'students', 'teachers',
            'priority_score', 'priority_rank',
            'student_teacher_ratio_raw', 'last_ranking_date',
            'latitude', 'longitude',
        ]


class SchoolDetailSerializer(serializers.ModelSerializer):
    student_teacher_ratio_raw = serializers.ReadOnlyField()
    computed_teacher_demand = serializers.ReadOnlyField()
    has_user_account = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = '__all__'
        read_only_fields = [
            'priority_score', 'priority_rank', 'teacher_demand',
            'ranking_history', 'improvement_score', 'last_ranking_date',
            'created_at', 'updated_at',
        ]

    def get_has_user_account(self, obj):
        return hasattr(obj, 'user_account')


class SchoolRankingSerializer(serializers.ModelSerializer):
    student_teacher_ratio_raw = serializers.ReadOnlyField()

    class Meta:
        model = School
        fields = [
            'id', 'name', 'emis', 'province', 'district', 'is_rural',
            'students', 'teachers', 'student_teacher_ratio_raw',
            'student_teacher_ratio', 'infrastructure_deficit',
            'material_shortage', 'geographic_difficulty',
            'socioeconomic_index', 'priority_score', 'priority_rank',
            'improvement_score', 'ranking_history', 'last_ranking_date',
        ]


class MCDAWeightSerializer(serializers.Serializer):
    weight_student_teacher = serializers.FloatField(min_value=0, max_value=1)
    weight_infrastructure = serializers.FloatField(min_value=0, max_value=1)
    weight_materials = serializers.FloatField(min_value=0, max_value=1)
    weight_geographic = serializers.FloatField(min_value=0, max_value=1)
    weight_socioeconomic = serializers.FloatField(min_value=0, max_value=1)

    def validate(self, data):
        total = sum(data.values())
        if abs(total - 1.0) > 0.01:
            raise serializers.ValidationError(
                f"Weights must sum to 1.0, got {total:.3f}"
            )
        return data


class SchoolProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['students', 'teachers', 'classrooms', 'female_students', 'female_teachers', 'male_students', 'male_teachers']


class ReviewRequestSerializer(serializers.ModelSerializer):
    school_name = serializers.ReadOnlyField(source='school.name')
    school_emis = serializers.ReadOnlyField(source='school.emis')

    class Meta:
        model = ReviewRequest
        fields = [
            'id', 'school', 'school_name', 'school_emis',
            'note', 'status', 'admin_response', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'admin_response', 'created_at', 'updated_at', 'school']


class DataVerificationRequestSerializer(serializers.ModelSerializer):
    school_name = serializers.ReadOnlyField(source='school.name')
    school_emis = serializers.ReadOnlyField(source='school.emis')
    school_district = serializers.ReadOnlyField(source='school.district')
    submitted_by_username = serializers.ReadOnlyField(source='submitted_by.username')
    reviewed_by_username = serializers.ReadOnlyField(source='reviewed_by.username')
    # Current school values for side-by-side comparison
    current_student_teacher_ratio = serializers.ReadOnlyField(source='school.student_teacher_ratio')
    current_infrastructure_deficit = serializers.ReadOnlyField(source='school.infrastructure_deficit')
    current_material_shortage = serializers.ReadOnlyField(source='school.material_shortage')
    current_geographic_difficulty = serializers.ReadOnlyField(source='school.geographic_difficulty')
    current_socioeconomic_index = serializers.ReadOnlyField(source='school.socioeconomic_index')

    class Meta:
        model = DataVerificationRequest
        fields = [
            'id', 'school', 'school_name', 'school_emis', 'school_district',
            'submitted_by', 'submitted_by_username',
            'student_teacher_ratio', 'infrastructure_deficit',
            'material_shortage', 'geographic_difficulty', 'socioeconomic_index',
            'current_student_teacher_ratio', 'current_infrastructure_deficit',
            'current_material_shortage', 'current_geographic_difficulty',
            'current_socioeconomic_index',
            'prev_student_teacher_ratio', 'prev_infrastructure_deficit',
            'prev_material_shortage', 'prev_geographic_difficulty',
            'prev_socioeconomic_index',
            'reason', 'status', 'admin_note',
            'created_at', 'reviewed_at', 'reviewed_by', 'reviewed_by_username',
        ]
        read_only_fields = [
            'id', 'school', 'submitted_by', 'status', 'admin_note',
            'created_at', 'reviewed_at', 'reviewed_by',
        ]


class RankingAppealSerializer(serializers.ModelSerializer):
    school_name = serializers.ReadOnlyField(source='school.name')
    school_emis = serializers.ReadOnlyField(source='school.emis')
    school_district = serializers.ReadOnlyField(source='school.district')
    submitted_by_username = serializers.ReadOnlyField(source='submitted_by.username')
    reviewed_by_username = serializers.ReadOnlyField(source='reviewed_by.username')

    class Meta:
        model = RankingAppeal
        fields = [
            'id', 'school', 'school_name', 'school_emis', 'school_district',
            'submitted_by', 'submitted_by_username',
            'current_rank', 'current_score',
            'reason', 'supporting_notes',
            'status', 'admin_response',
            'created_at', 'reviewed_at', 'reviewed_by', 'reviewed_by_username',
        ]
        read_only_fields = [
            'id', 'school', 'submitted_by', 'current_rank', 'current_score',
            'status', 'admin_response', 'created_at', 'reviewed_at', 'reviewed_by',
        ]


class ResourceRequestSerializer(serializers.ModelSerializer):
    school_name = serializers.ReadOnlyField(source='school.name')
    school_emis = serializers.ReadOnlyField(source='school.emis')
    school_district = serializers.ReadOnlyField(source='school.district')
    school_province = serializers.ReadOnlyField(source='school.province')
    submitted_by_username = serializers.ReadOnlyField(source='submitted_by.username')
    reviewed_by_username = serializers.ReadOnlyField(source='reviewed_by.username')
    letter_url = serializers.SerializerMethodField()
    grant_id = serializers.SerializerMethodField()
    grant_disbursement_status = serializers.SerializerMethodField()

    class Meta:
        model = ResourceRequest
        fields = [
            'id', 'school', 'school_name', 'school_emis', 'school_district', 'school_province',
            'submitted_by', 'submitted_by_username',
            'subject', 'letter', 'letter_url',
            'status', 'admin_response', 'amount_granted',
            'grant_id', 'grant_disbursement_status',
            'created_at', 'reviewed_at', 'reviewed_by', 'reviewed_by_username',
        ]
        read_only_fields = [
            'id', 'school', 'submitted_by', 'status', 'admin_response', 'amount_granted',
            'grant_id', 'grant_disbursement_status',
            'created_at', 'reviewed_at', 'reviewed_by',
        ]
        extra_kwargs = {
            'letter': {'write_only': True},  # raw file field for upload; read via letter_url
        }

    def get_grant_id(self, obj):
        grant = getattr(obj, 'grant', None)
        if grant:
            return grant.id
        return None

    def get_grant_disbursement_status(self, obj):
        grant = getattr(obj, 'grant', None)
        if grant:
            return grant.disbursement_status
        return None

    def get_letter_url(self, obj):
        if not obj.letter:
            return None
        request = self.context.get('request')
        url = obj.letter.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def validate_letter(self, value):
        # Enforce type + size (PDF or image, <= 5MB)
        allowed = ('.pdf', '.jpg', '.jpeg', '.png')
        name = value.name.lower()
        if not name.endswith(allowed):
            raise serializers.ValidationError('Letter must be a PDF, JPG, or PNG file.')
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('File too large (max 5 MB).')
        return value
