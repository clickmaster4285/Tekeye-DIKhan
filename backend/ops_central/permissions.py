from rest_framework import permissions

from users.permissions import is_it_superadmin, is_ops_viewer


class IsITSuperAdminOnly(permissions.BasePermission):
    """Central Ops write/connect — IT Super Admin only."""

    message = "Only IT Super Admin can manage Central Ops servers."

    def has_permission(self, request, view):
        return is_it_superadmin(request.user)


class IsOpsViewer(permissions.BasePermission):
    """View connected servers / all-cities streams — Super Admin, IT Super Admin, or collectorate officers."""

    message = "Only Super Admin, IT Super Admin, or Collector officers can view Central Ops streams."

    def has_permission(self, request, view):
        return is_ops_viewer(request.user)
