from rest_framework import serializers

from .models import (
    InfraAlert,
    InfraAlertRule,
    InfraDevice,
    InfraEvent,
    InfraSite,
)


class InfraSiteSerializer(serializers.ModelSerializer):
    device_count = serializers.SerializerMethodField()

    class Meta:
        model = InfraSite
        fields = [
            "id",
            "code",
            "name",
            "location",
            "description",
            "is_active",
            "device_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_device_count(self, obj):
        return obj.devices.filter(is_active=True).count()


class InfraDeviceSerializer(serializers.ModelSerializer):
    site_code = serializers.CharField(source="site.code", read_only=True, default="")
    site_name = serializers.CharField(source="site.name", read_only=True, default="")
    device_type_label = serializers.CharField(
        source="get_device_type_display", read_only=True
    )
    primary_protocol_label = serializers.CharField(
        source="get_primary_protocol_display", read_only=True
    )
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    password_set = serializers.SerializerMethodField()

    class Meta:
        model = InfraDevice
        fields = [
            "id",
            "site",
            "site_code",
            "site_name",
            "device_type",
            "device_type_label",
            "name",
            "manufacturer",
            "model_number",
            "serial_number",
            "asset_tag",
            "ip_address",
            "port",
            "mac_address",
            "install_location",
            "primary_protocol",
            "primary_protocol_label",
            "secondary_protocol",
            "username",
            "password",
            "password_set",
            "snmp_version",
            "snmp_community",
            "snmp_port",
            "snmp_oid_map",
            "modbus_unit_id",
            "modbus_port",
            "modbus_register_map",
            "onvif_port",
            "rtsp_url",
            "channel_count",
            "supports_onvif",
            "supports_rtsp",
            "supports_snmp",
            "supports_modbus",
            "rated_capacity_kva",
            "rated_power_kw",
            "network_role",
            "poll_interval_sec",
            "status",
            "status_label",
            "last_seen_at",
            "last_polled_at",
            "last_error",
            "last_metrics",
            "source_key",
            "is_active",
            "notes",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "last_seen_at",
            "last_polled_at",
            "last_error",
            "last_metrics",
            "source_key",
            "created_at",
            "updated_at",
            "password_set",
        ]
        extra_kwargs = {
            "password": {"write_only": True, "required": False, "allow_blank": True},
        }

    def get_password_set(self, obj):
        return bool(obj.password)

    def update(self, instance, validated_data):
        # Keep existing password when client omits or sends blank
        if "password" in validated_data and not validated_data["password"]:
            validated_data.pop("password")
        return super().update(instance, validated_data)


class InfraAlertRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = InfraAlertRule
        fields = [
            "id",
            "name",
            "device_type",
            "metric_key",
            "operator",
            "threshold_value",
            "severity",
            "message_template",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class InfraAlertSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source="device.name", read_only=True, default="")
    device_type = serializers.CharField(
        source="device.device_type", read_only=True, default=""
    )
    severity_label = serializers.CharField(
        source="get_severity_display", read_only=True
    )

    class Meta:
        model = InfraAlert
        fields = [
            "id",
            "device",
            "device_name",
            "device_type",
            "alert_type",
            "severity",
            "severity_label",
            "title",
            "message",
            "metric_key",
            "metric_value",
            "acknowledged",
            "acknowledged_at",
            "resolved",
            "resolved_at",
            "first_detected",
            "last_detected",
            "details",
        ]
        read_only_fields = [
            "first_detected",
            "last_detected",
            "acknowledged_at",
            "resolved_at",
        ]


class InfraEventSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source="device.name", read_only=True, default="")

    class Meta:
        model = InfraEvent
        fields = [
            "id",
            "device",
            "device_name",
            "event_type",
            "title",
            "message",
            "actor",
            "payload",
            "created_at",
        ]
        read_only_fields = ["created_at"]
