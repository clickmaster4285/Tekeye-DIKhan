from rest_framework import permissions

from users.permissions import is_it_superadmin, is_ops_viewer


class IsITSuperAdminOnly(permissions.BasePermission):
    """Central Ops write/connect — IT Super Admin only."""

    message = "Only IT Super Admin can manage Central Ops servers."

    def has_permission(self, request, view):
        return is_it_superadmin(request.user)


class IsOpsViewer(permissions.BasePermission):
    """View connected servers — Super Admin or IT Super Admin."""

    message = "Only Super Admin or IT Super Admin can view Central Ops streams."

    def has_permission(self, request, view):
        return is_ops_viewer(request.user)
