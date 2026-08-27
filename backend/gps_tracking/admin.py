from django.contrib import admin

from .models import OfficerGpsHistory, OfficerGpsLatest


@admin.register(OfficerGpsLatest)
class OfficerGpsLatestAdmin(admin.ModelAdmin):
    list_display = ("user", "on_duty", "latitude", "longitude", "accuracy_m", "location", "recorded_at")
    list_filter = ("on_duty", "location")
    search_fields = ("user__username", "user__full_name")


@admin.register(OfficerGpsHistory)
class OfficerGpsHistoryAdmin(admin.ModelAdmin):
    list_display = ("user", "latitude", "longitude", "accuracy_m", "recorded_at")
    search_fields = ("user__username",)
    date_hierarchy = "recorded_at"
