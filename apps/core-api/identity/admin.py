from django.contrib import admin
from .models import User, PatientProfile, StaffProfile, Roles
from core.email_service import send_doctor_approved_email

@admin.action(description='Aprobar acceso para los Médicos Asociados seleccionados')
def approve_physicians(modeladmin, request, queryset):
    for user in queryset:
        if hasattr(user, 'staff_profile') and not user.is_active:
            user.is_active = True
            user.save()
            try:
                send_doctor_approved_email(user)
            except Exception as e:
                # Log error
                pass

class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'email_hash', 'is_active', 'is_staff', 'role')
    list_filter = ('is_active', 'is_staff', 'role')
    search_fields = ('email_hash',)
    actions = [approve_physicians]

class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ('user_email', 'first_name', 'last_name', 'cedula_profesional', 'specialty')
    search_fields = ('user__email_hash', 'first_name', 'last_name', 'cedula_profesional')
    
    def user_email(self, obj):
        return obj.user.email_hash
    user_email.short_description = 'Email'

class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ('user_email', 'first_name', 'last_name', 'curp_or_mrn')
    search_fields = ('user__email_hash', 'first_name', 'last_name', 'curp_or_mrn')

    def user_email(self, obj):
        return obj.user.email_hash
    user_email.short_description = 'Email'

admin.site.register(User, UserAdmin)
admin.site.register(StaffProfile, StaffProfileAdmin)
admin.site.register(PatientProfile, PatientProfileAdmin)
admin.site.register(Roles)
