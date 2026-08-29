from rest_framework.permissions import BasePermission

class IsReportingDoctor(BasePermission):
    """
    Enforces authorization allowing ONLY internal Reporting Radiologists
    who belong to the 'Doctors' Django auth group.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.groups.filter(name='Doctors').exists()
        )

class IsAssociatedDoctor(BasePermission):
    """
    Enforces authorization allowing ONLY referring Associate Doctors
    who belong to the 'AssociatedDoctors' Django auth group.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.groups.filter(name='AssociatedDoctors').exists()
        )
