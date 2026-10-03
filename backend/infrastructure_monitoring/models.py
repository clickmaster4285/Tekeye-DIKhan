from django.db import models


class DeviceType(models.TextChoices):
    CAMERA = "camera", "Camera"
    NVR = "nvr", "NVR"
    UPS = "ups", "UPS"
    INVERTER = "inverter", "Inverter"
    NETWORK = "network", "Network Device"
    SERVER = "server", "Server"


class ProtocolType(models.TextChoices):
    NONE = "none", "None / Manual"
    ICMP = "icmp", "ICMP (Ping)"
    SNMP = "snmp", "SNMP"
    MODBUS_TCP = "modbus_tcp", "Modbus TCP"
    MODBUS_RTU = "modbus_rtu", "Modbus RTU"
    ONVIF = "onvif", "ONVIF"
    RTSP = "rtsp", "RTSP"
    HTTP = "http", "HTTP API"


class SnmpVersion(models.TextChoices):
    V1 = "v1", "SNMPv1"
    V2C = "v2c", "SNMPv2c"
    V3 = "v3", "SNMPv3"


class DeviceStatus(models.TextChoices):
    ONLINE = "online", "Online"
    OFFLINE = "offline", "Offline"
    DEGRADED = "degraded", "Degraded"
    FAULT = "fault", "Fault"
    UNKNOWN = "unknown", "Unknown"
    MAINTENANCE = "maintenance", "Maintenance"


class AlertSeverity(models.TextChoices):
    INFO = "info", "Info"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    CRITICAL = "critical", "Critical"


class InfraSite(models.Model):
    """Physical site / location for infrastructure assets."""

    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=128, blank=True, default="")
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class InfraDevice(models.Model):
    """
    Configurable infrastructure asset (camera, NVR, UPS, inverter, network).
    Protocol fields support SNMP / Modbus / ONVIF / RTSP / ICMP.
    """

    site = models.ForeignKey(
        InfraSite,
        on_delete=models.CASCADE,
        related_name="devices",
        null=True,
        blank=True,
    )
    device_type = models.CharField(
        max_length=16,
        choices=DeviceType.choices,
        db_index=True,
    )
    name = models.CharField(max_length=200)
    manufacturer = models.CharField(max_length=120, blank=True, default="")
    model_number = models.CharField(max_length=120, blank=True, default="")
    serial_number = models.CharField(max_length=120, blank=True, default="")
    asset_tag = models.CharField(max_length=64, blank=True, default="")

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    port = models.PositiveIntegerField(null=True, blank=True)
    mac_address = models.CharField(max_length=32, blank=True, default="")
    install_location = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Room, rack, or zone label",
    )

    primary_protocol = models.CharField(
        max_length=16,
        choices=ProtocolType.choices,
        default=ProtocolType.ICMP,
    )
    secondary_protocol = models.CharField(
        max_length=16,
        choices=ProtocolType.choices,
        default=ProtocolType.NONE,
        blank=True,
    )

    # Credentials (optional)
    username = models.CharField(max_length=128, blank=True, default="")
    password = models.CharField(max_length=256, blank=True, default="")

    # SNMP
    snmp_version = models.CharField(
        max_length=8,
        choices=SnmpVersion.choices,
        default=SnmpVersion.V2C,
        blank=True,
    )
    snmp_community = models.CharField(max_length=128, blank=True, default="public")
    snmp_port = models.PositiveIntegerField(default=161)
    snmp_oid_map = models.JSONField(
        default=dict,
        blank=True,
        help_text='Optional OID map, e.g. {"battery_percent": "1.3.6.1..."}',
    )

    # Modbus
    modbus_unit_id = models.PositiveIntegerField(default=1)
    modbus_port = models.PositiveIntegerField(default=502)
    modbus_register_map = models.JSONField(
        default=list,
        blank=True,
        help_text='[{"name":"battery_soc","register":1003,"scale":0.1,"unit":"%"}]',
    )

    # Camera / NVR / ONVIF / RTSP
    onvif_port = models.PositiveIntegerField(default=80)
    rtsp_url = models.CharField(max_length=512, blank=True, default="")
    channel_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="NVR channel capacity",
    )
    supports_onvif = models.BooleanField(default=False)
    supports_rtsp = models.BooleanField(default=True)
    supports_snmp = models.BooleanField(default=False)
    supports_modbus = models.BooleanField(default=False)

    # Power / UPS / inverter hints
    rated_capacity_kva = models.FloatField(null=True, blank=True)
    rated_power_kw = models.FloatField(null=True, blank=True)

    # Network device / server role
    network_role = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Network: switch/router/firewall/ap. Server: app/db/web/file/domain/other.",
    )

    # Polling & health (updated automatically by infra poller — not user-set)
    poll_interval_sec = models.PositiveIntegerField(default=60)
    status = models.CharField(
        max_length=16,
        choices=DeviceStatus.choices,
        default=DeviceStatus.UNKNOWN,
        db_index=True,
    )
    last_seen_at = models.DateTimeField(null=True, blank=True)
    last_polled_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=512, blank=True, default="")
    last_metrics = models.JSONField(default=dict, blank=True)
    # Auto-import key e.g. "cameras.nvr:12" / "cameras.camera:45"
    source_key = models.CharField(
        max_length=96,
        blank=True,
        null=True,
        unique=True,
        help_text="External source identity for auto-synced devices",
    )

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["device_type", "name"]
        indexes = [
            models.Index(fields=["device_type", "is_active"]),
            models.Index(fields=["status", "device_type"]),
            models.Index(fields=["ip_address"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_device_type_display()}: {self.name}"


class InfraAlertRule(models.Model):
    """Threshold / condition for generating infrastructure alerts."""

    name = models.CharField(max_length=200)
    device_type = models.CharField(
        max_length=16,
        choices=DeviceType.choices,
        blank=True,
        default="",
        help_text="Empty = all device types",
    )
    metric_key = models.CharField(
        max_length=64,
        help_text="e.g. battery_percent, offline, inverter_fault",
    )
    operator = models.CharField(
        max_length=8,
        default="lt",
        help_text="lt | lte | gt | gte | eq | neq",
    )
    threshold_value = models.FloatField(null=True, blank=True)
    severity = models.CharField(
        max_length=16,
        choices=AlertSeverity.choices,
        default=AlertSeverity.MEDIUM,
    )
    message_template = models.CharField(
        max_length=512,
        blank=True,
        default="",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class InfraAlert(models.Model):
    device = models.ForeignKey(
        InfraDevice,
        on_delete=models.CASCADE,
        related_name="alerts",
        null=True,
        blank=True,
    )
    alert_type = models.CharField(max_length=64, db_index=True)
    severity = models.CharField(
        max_length=16,
        choices=AlertSeverity.choices,
        default=AlertSeverity.MEDIUM,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")
    metric_key = models.CharField(max_length=64, blank=True, default="")
    metric_value = models.FloatField(null=True, blank=True)
    acknowledged = models.BooleanField(default=False, db_index=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved = models.BooleanField(default=False, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    first_detected = models.DateTimeField(auto_now_add=True)
    last_detected = models.DateTimeField(auto_now=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-last_detected"]
        indexes = [
            models.Index(fields=["resolved", "severity", "-last_detected"]),
        ]

    def __str__(self) -> str:
        return f"{self.severity}: {self.title}"


class InfraEvent(models.Model):
    """Audit / timeline of infrastructure changes and incidents."""

    device = models.ForeignKey(
        InfraDevice,
        on_delete=models.SET_NULL,
        related_name="events",
        null=True,
        blank=True,
    )
    event_type = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")
    actor = models.CharField(max_length=128, blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.event_type}: {self.title}"


class InfraNvrLog(models.Model):
    """
    Full NVR system log entries pulled from the appliance (ISAPI / Dahua).
    Columns mirror NVR UI: Time, Major Type, Subtype, Channel, User, Remote IP.
    """

    device = models.ForeignKey(
        InfraDevice,
        on_delete=models.CASCADE,
        related_name="nvr_logs",
    )
    log_time = models.DateTimeField(db_index=True)
    major_type = models.CharField(max_length=128, blank=True, default="", db_index=True)
    subtype = models.CharField(max_length=256, blank=True, default="", db_index=True)
    channel_no = models.CharField(max_length=32, blank=True, default="")
    local_remote_user = models.CharField(max_length=128, blank=True, default="")
    remote_host_ip = models.CharField(max_length=64, blank=True, default="")
    description = models.TextField(blank=True, default="")
    raw = models.JSONField(default=dict, blank=True)
    fingerprint = models.CharField(max_length=64, db_index=True)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-log_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["device", "fingerprint"],
                name="uniq_infra_nvr_log_fingerprint",
            )
        ]
        indexes = [
            models.Index(fields=["device", "-log_time"]),
            models.Index(fields=["device", "major_type", "-log_time"]),
        ]

    def __str__(self) -> str:
        return f"{self.log_time} {self.major_type}/{self.subtype}"


class ServerLogCategory(models.TextChoices):
    ERROR = "error", "Error"
    ACCESS = "access", "Access"
    SYSTEM = "system", "System"
    SECURITY = "security", "Security"
    APPLICATION = "application", "Application"
    OTHER = "other", "Other"


class InfraServerLog(models.Model):
    """Host logs pushed by the server agent (Event Log / syslog / app logs)."""

    device = models.ForeignKey(
        InfraDevice,
        on_delete=models.CASCADE,
        related_name="server_logs",
    )
    log_time = models.DateTimeField(db_index=True)
    category = models.CharField(
        max_length=32,
        choices=ServerLogCategory.choices,
        default=ServerLogCategory.OTHER,
        db_index=True,
    )
    level = models.CharField(max_length=32, blank=True, default="", db_index=True)
    source = models.CharField(max_length=200, blank=True, default="")
    user = models.CharField(max_length=128, blank=True, default="")
    remote_host = models.CharField(max_length=64, blank=True, default="")
    event_id = models.CharField(max_length=64, blank=True, default="")
    message = models.TextField(blank=True, default="")
    raw = models.JSONField(default=dict, blank=True)
    fingerprint = models.CharField(max_length=64, db_index=True)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-log_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["device", "fingerprint"],
                name="uniq_infra_server_log_fingerprint",
            )
        ]
        indexes = [
            models.Index(fields=["device", "-log_time"]),
            models.Index(fields=["device", "category", "-log_time"]),
        ]

    def __str__(self) -> str:
        return f"{self.log_time} [{self.category}] {self.level}"
