from rest_framework.permissions import BasePermission

class IsAssistantUser(BasePermission):
    """
    Enforces authorization allowing ONLY administrative front-desk staff
    who belong to the 'Assistants' Django auth group.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.groups.filter(name='Assistants').exists()
        )
