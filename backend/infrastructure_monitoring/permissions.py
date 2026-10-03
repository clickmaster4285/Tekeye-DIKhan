from rest_framework import permissions

from users.permissions import is_global_admin, is_it_superadmin


class IsInfraAdmin(permissions.BasePermission):
    """IT Super Admin and Super Admin may manage infrastructure monitoring."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return is_it_superadmin(user) or is_global_admin(user)
