from rest_framework.permissions import BasePermission

class IsPatientUser(BasePermission):
    """
    Enforces authorization allowing ONLY registered Patients
    who belong to the 'Patients' Django auth group.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.groups.filter(name='Patients').exists()
        )
