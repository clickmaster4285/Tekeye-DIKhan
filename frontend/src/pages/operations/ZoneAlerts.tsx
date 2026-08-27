import React, { useState } from 'react';
import {
    MapPin,
    AlertTriangle,
    Camera,
    Users,
    Clock,
    Activity,
    Filter,
    Download,
    Eye,
    CheckCircle,
    XCircle,
    Bell,
    Search,
    ChevronDown,
    RefreshCw,
    BarChart3,
    TrendingUp,
    Shield,
    Circle,
    CircleDot,
    ArrowRight,
    ArrowLeftRight,
    Maximize2,
    Minimize2,
    Grid,
    Layers,
    Target,
    Gauge,
    Info
} from 'lucide-react';

interface ZoneAlert {
    id: string;
    category: 'intrusion' | 'line-crossing' | 'perimeter-breach' | 'dwell-time' | 'occupancy';
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    timestamp: string;
    camera: string;
    zone: string;
    zoneType: 'restricted' | 'perimeter' | 'common' | 'warehouse' | 'office' | 'parking' | 'entry';
    confidence: number;
    acknowledged: boolean;
    resolved: boolean;
    duration?: string;
    threshold?: string;
    currentValue?: number;
    maxValue?: number;
    coordinates?: {
        x: number;
        y: number;
    };
    metadata?: Record<string, any>;
}

const ZoneAlerts: React.FC = () => {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
    const [selectedZone, setSelectedZone] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showAcknowledged, setShowAcknowledged] = useState<boolean>(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showMap, setShowMap] = useState<boolean>(false);

    // Comprehensive zone alerts dummy data
    const [alerts, setAlerts] = useState<ZoneAlert[]>([
        // ZONE INTRUSION ALERTS
        {
            id: '1',
            category: 'intrusion',
            type: 'Zone Intrusion',
            severity: 'critical',
            title: 'Unauthorized Entry - Server Room',
            description: 'Unauthorized individual detected in restricted server room Zone A',
            timestamp: '30 seconds ago',
            camera: 'Camera 07 - Server Room Entrance',
            zone: 'Data Center - Zone A (Restricted)',
            zoneType: 'restricted',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            coordinates: { x: 45, y: 30 },
            metadata: {
                accessLevel: 'Level 5 required',
                currentBadge: 'Level 2 - Employee',
                entryMethod: 'Tailgating',
                individualCount: 1,
                alertTrigger: 'Motion sensor + Camera AI'
            }
        },
        {
            id: '2',
            category: 'intrusion',
            type: 'Zone Intrusion',
            severity: 'high',
            title: 'Intrusion - Executive Office',
            description: 'Unauthorized person detected in CEO office after hours',
            timestamp: '2 minutes ago',
            camera: 'Camera 12 - Executive Floor',
            zone: 'Executive Suite - Office 501',
            zoneType: 'restricted',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            coordinates: { x: 78, y: 45 },
            metadata: {
                timeAfterHours: '7:45 PM',
                lastAuthorizedExit: '6:30 PM',
                motionDetected: 'Yes',
                lights: 'Off',
                securityLevel: 'Maximum'
            }
        },
        {
            id: '3',
            category: 'intrusion',
            type: 'Zone Intrusion',
            severity: 'high',
            title: 'Rooftop Access - Unauthorized',
            description: 'Unauthorized access detected on rooftop helipad',
            timestamp: '4 minutes ago',
            camera: 'Camera 34 - Rooftop',
            zone: 'Helipad Access Zone',
            zoneType: 'restricted',
            confidence: 96,
            acknowledged: false,
            resolved: false,
            metadata: {
                accessPoint: 'Stairwell C - Rooftop door',
                doorStatus: 'Forced open',
                alarmTriggered: 'Yes',
                weatherConditions: 'Clear',
                securityResponse: 'Dispatch'
            }
        },
        {
            id: '4',
            category: 'intrusion',
            type: 'Zone Intrusion',
            severity: 'medium',
            title: 'Warehouse Zone B Intrusion',
            description: 'Unauthorized forklift in pedestrian-only zone',
            timestamp: '6 minutes ago',
            camera: 'Camera 23 - Warehouse',
            zone: 'Warehouse - Pedestrian Lane',
            zoneType: 'warehouse',
            confidence: 95,
            acknowledged: true,
            resolved: false,
            metadata: {
                vehicleId: 'Forklift FL-07',
                operator: 'Unidentified',
                hazardLevel: 'Medium',
                pedestrianTraffic: 'High'
            }
        },

        // LINE CROSSING ALERTS
        {
            id: '5',
            category: 'line-crossing',
            type: 'Line Crossing',
            severity: 'high',
            title: 'Security Line Crossed - Main Gate',
            description: 'Individual crossed security line without stopping',
            timestamp: '45 seconds ago',
            camera: 'Camera 03 - Main Gate',
            zone: 'Entry Point - Security Check',
            zoneType: 'entry',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            coordinates: { x: 50, y: 80 },
            metadata: {
                lineType: 'Security checkpoint',
                direction: 'Inbound - Skipped screening',
                individualDescription: 'Male, black jacket, baseball cap',
                securityAlert: 'Guard dispatched'
            }
        },
        {
            id: '6',
            category: 'line-crossing',
            type: 'Line Crossing',
            severity: 'critical',
            title: 'Restricted Line Crossed - Laboratory',
            description: 'Individual crossed biohazard zone boundary',
            timestamp: '1 minute ago',
            camera: 'Camera 29 - Bio Lab',
            zone: 'Biohazard Level 3 Zone',
            zoneType: 'restricted',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                lineType: 'Biohazard containment line',
                ppeStatus: 'Incomplete - No respirator',
                decontaminationRequired: 'Immediate',
                hazardType: 'Biological agents present'
            }
        },
        {
            id: '7',
            category: 'line-crossing',
            type: 'Line Crossing',
            severity: 'medium',
            title: 'Parking Lane Crossing',
            description: 'Pedestrian crossed active vehicle lane unsafely',
            timestamp: '3 minutes ago',
            camera: 'Camera 15 - Parking Garage',
            zone: 'Parking - Level 2 Vehicle Lane',
            zoneType: 'parking',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            metadata: {
                laneType: 'One-way vehicle lane',
                nearMiss: 'Yes - Vehicle approaching',
                pedestrianCount: 2,
                safetyViolation: 'Jaywalking'
            }
        },
        {
            id: '8',
            category: 'line-crossing',
            type: 'Line Crossing',
            severity: 'low',
            title: 'Queue Line Crossed - Cafeteria',
            description: 'Individual cut cafeteria queue line',
            timestamp: '8 minutes ago',
            camera: 'Camera 18 - Cafeteria',
            zone: 'Food Service Area',
            zoneType: 'common',
            confidence: 92,
            acknowledged: true,
            resolved: true,
            metadata: {
                lineType: 'Queue line',
                complaint: 'Other patrons complained',
                staffIntervention: 'Yes - Resolved'
            }
        },

        // PERIMETER BREACH ALERTS
        {
            id: '9',
            category: 'perimeter-breach',
            type: 'Perimeter Breach',
            severity: 'critical',
            title: 'Fence Breach - North Perimeter',
            description: 'Section of perimeter fence cut/damaged in north sector',
            timestamp: '30 seconds ago',
            camera: 'PTZ Camera 05 - North Wall',
            zone: 'North Perimeter - Sector 7',
            zoneType: 'perimeter',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            coordinates: { x: 20, y: 15 },
            metadata: {
                breachType: 'Fence cut',
                size: 'Approx 60cm x 90cm',
                alarmStatus: 'Vibration sensors triggered',
                lastPatrol: '15 minutes ago',
                evidence: 'Footprints leading inside',
                responseTeam: 'Rapid response dispatched'
            }
        },
        {
            id: '10',
            category: 'perimeter-breach',
            type: 'Perimeter Breach',
            severity: 'critical',
            title: 'Gate Breach - Vehicle Entry',
            description: 'Vehicle forced through closed security gate',
            timestamp: '2 minutes ago',
            camera: 'Camera 02 - Main Vehicle Gate',
            zone: 'South Perimeter - Vehicle Entry',
            zoneType: 'perimeter',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            metadata: {
                vehicle: 'Black SUV - Partial plate ABC?8',
                gateStatus: 'Closed - Forced open',
                direction: 'Entering facility',
                speed: 'High speed (>30 mph)',
                pursuitStatus: 'Security vehicles in pursuit',
                lawEnforcement: 'Notified'
            }
        },
        {
            id: '11',
            category: 'perimeter-breach',
            type: 'Perimeter Breach',
            severity: 'high',
            title: 'Wall Scaling Attempt',
            description: 'Individual attempting to scale perimeter wall',
            timestamp: '3 minutes ago',
            camera: 'Camera 41 - East Wall',
            zone: 'East Perimeter - Wall Section 12',
            zoneType: 'perimeter',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                method: 'Climbing with rope',
                status: 'Intercepted by patrol',
                individualCount: 1,
                deterrentUsed: 'Warning shot',
                apprehension: 'In progress'
            }
        },
        {
            id: '12',
            category: 'perimeter-breach',
            type: 'Perimeter Breach',
            severity: 'medium',
            title: 'Tunnel Detection - Underground',
            description: 'Ground disturbance detected near perimeter',
            timestamp: '10 minutes ago',
            camera: 'Seismic Sensor Array',
            zone: 'West Perimeter - Underground',
            zoneType: 'perimeter',
            confidence: 88,
            acknowledged: false,
            resolved: false,
            metadata: {
                depth: 'Approx 2 meters',
                activityType: 'Digging/tunneling',
                sensorData: 'Anomaly detected',
                investigation: 'K9 unit dispatched'
            }
        },

        // DWELL TIME EXCEEDED ALERTS
        {
            id: '13',
            category: 'dwell-time',
            type: 'Dwell Time Exceeded',
            severity: 'medium',
            title: 'Vehicle Dwell Time - Parking Lot',
            description: 'Vehicle idling in same spot for 45+ minutes',
            timestamp: '2 minutes ago',
            camera: 'Camera 14 - Parking Lot C',
            zone: 'Parking - Visitor Section',
            zoneType: 'parking',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            duration: '47 minutes',
            threshold: '30 minutes',
            metadata: {
                vehicle: 'White van - No plates visible',
                occupants: '1 person visible',
                engine: 'Running intermittently',
                behavior: 'Observing facility',
                action: 'Security check recommended'
            }
        },
        {
            id: '14',
            category: 'dwell-time',
            type: 'Dwell Time Exceeded',
            severity: 'high',
            title: 'Suspicious Loitering - Restricted Zone',
            description: 'Individual loitering near restricted entrance',
            timestamp: '1 minute ago',
            camera: 'Camera 06 - Restricted Wing',
            zone: 'Research Wing Entrance',
            zoneType: 'restricted',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            duration: '15 minutes',
            threshold: '5 minutes',
            metadata: {
                behavior: 'Observing access patterns, taking photos',
                identity: 'Unknown - No badge visible',
                interactions: 'Approached by 2 employees',
                riskLevel: 'High - Potential surveillance'
            }
        },
        {
            id: '15',
            category: 'dwell-time',
            type: 'Dwell Time Exceeded',
            severity: 'medium',
            title: 'Package Unattended - Lobby',
            description: 'Suspicious package unattended for extended period',
            timestamp: '3 minutes ago',
            camera: 'Camera 01 - Main Lobby',
            zone: 'Reception Area',
            zoneType: 'common',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            duration: '22 minutes',
            threshold: '10 minutes',
            metadata: {
                packageType: 'Backpack - Black',
                owner: 'Unknown',
                position: 'Near seating area',
                bombSquad: 'Notified',
                evacuationStatus: 'Partial evacuation'
            }
        },
        {
            id: '16',
            category: 'dwell-time',
            type: 'Dwell Time Exceeded',
            severity: 'low',
            title: 'Customer Dwell - Retail Area',
            description: 'Customer in restricted stock area for extended time',
            timestamp: '5 minutes ago',
            camera: 'Camera 25 - Retail Store',
            zone: 'Stock Room - Employees Only',
            zoneType: 'restricted',
            confidence: 94,
            acknowledged: true,
            resolved: false,
            duration: '12 minutes',
            threshold: '5 minutes',
            metadata: {
                customerId: 'Unknown',
                staffAware: 'Yes',
                intervention: 'Staff dispatched'
            }
        },
        {
            id: '17',
            category: 'dwell-time',
            type: 'Dwell Time Exceeded',
            severity: 'medium',
            title: 'Vehicle Dwell - Loading Dock',
            description: 'Delivery truck parked beyond scheduled time',
            timestamp: '4 minutes ago',
            camera: 'Camera 09 - Loading Dock',
            zone: 'Logistics - Bay 4',
            zoneType: 'warehouse',
            confidence: 96,
            acknowledged: false,
            resolved: false,
            duration: '35 minutes',
            threshold: '20 minutes',
            metadata: {
                vehicle: 'Truck - Fresh Foods Inc',
                scheduledDeparture: '10:30 AM',
                currentTime: '11:05 AM',
                unloadingStatus: 'Complete',
                action: 'Dispatch security'
            }
        },

        // OCCUPANCY LIMIT EXCEEDED ALERTS
        {
            id: '18',
            category: 'occupancy',
            type: 'Occupancy Limit Exceeded',
            severity: 'high',
            title: 'Meeting Room Overcrowding',
            description: 'Conference room exceeds maximum occupancy',
            timestamp: '1 minute ago',
            camera: 'Camera 27 - Conference Center',
            zone: 'Conference Room A - Capacity 50',
            zoneType: 'common',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            currentValue: 78,
            maxValue: 50,
            metadata: {
                room: 'Grand Hall A',
                event: 'All-hands meeting',
                safetyRisk: 'Blocked emergency exits',
                fireCodeViolation: 'Yes',
                actionRequired: 'Evacuate to capacity'
            }
        },
        {
            id: '19',
            category: 'occupancy',
            type: 'Occupancy Limit Exceeded',
            severity: 'critical',
            title: 'Warehead Occupancy Exceeded',
            description: 'Number of personnel in warehouse exceeds safe limit',
            timestamp: '2 minutes ago',
            camera: 'Camera 22 - Warehouse Floor',
            zone: 'Warehouse - Main Floor',
            zoneType: 'warehouse',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            currentValue: 145,
            maxValue: 100,
            metadata: {
                safetyRegulation: 'OSHA 1910.38',
                hazardLevel: 'Increased accident risk',
                equipmentOperation: 'Forklifts active',
                evacuationAlarm: 'Triggered',
                safetyOfficer: 'Notified'
            }
        },
        {
            id: '20',
            category: 'occupancy',
            type: 'Occupancy Limit Exceeded',
            severity: 'critical',
            title: 'Cafeteria Overcrowding',
            description: 'Cafeteria exceeds emergency exit capacity',
            timestamp: '3 minutes ago',
            camera: 'Camera 19 - Cafeteria',
            zone: 'Dining Area',
            zoneType: 'common',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            currentValue: 312,
            maxValue: 250,
            metadata: {
                timeOfDay: 'Lunch peak',
                blockedExits: 'Main exit partially blocked',
                fireMarshal: 'Alerted',
                action: 'Limit new entries'
            }
        },
        {
            id: '21',
            category: 'occupancy',
            type: 'Occupancy Limit Exceeded',
            severity: 'high',
            title: 'Elevator Overload',
            description: 'Elevator car exceeds weight capacity',
            timestamp: '30 seconds ago',
            camera: 'Camera 33 - Elevator Lobby',
            zone: 'Elevator Bank A - Car 3',
            zoneType: 'common',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            currentValue: 18,
            maxValue: 15,
            metadata: {
                weightCapacity: '115%',
                alarmStatus: 'Triggered',
                location: 'Stuck between floors 7 and 8',
                passengers: '18 people',
                emergencyServices: 'Dispatched'
            }
        },
        {
            id: '22',
            category: 'occupancy',
            type: 'Occupancy Limit Exceeded',
            severity: 'medium',
            title: 'Gym Capacity Exceeded',
            description: 'Fitness center exceeds safe occupancy',
            timestamp: '5 minutes ago',
            camera: 'Camera 38 - Fitness Center',
            zone: 'Gym Floor',
            zoneType: 'common',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            currentValue: 65,
            maxValue: 50,
            metadata: {
                peakTime: '5:30 PM after work',
                equipmentAvailability: 'Limited',
                safetyRisk: 'Reduced emergency egress',
                staffAction: 'Limit access at door'
            }
        },
        {
            id: '23',
            category: 'occupancy',
            type: 'Occupancy Limit Exceeded',
            severity: 'medium',
            title: 'Laboratory Capacity Alert',
            description: 'Too many personnel in cleanroom',
            timestamp: '7 minutes ago',
            camera: 'Camera 31 - Cleanroom',
            zone: 'ISO 7 Cleanroom',
            zoneType: 'restricted',
            confidence: 96,
            acknowledged: true,
            resolved: false,
            currentValue: 22,
            maxValue: 15,
            metadata: {
                contaminationRisk: 'Elevated',
                airChangesPerHour: 'Reduced effectiveness',
                gowningCompliance: 'Partial',
                supervisorNotified: 'Yes'
            }
        },

        // Additional Zone Alerts
        {
            id: '24',
            category: 'intrusion',
            type: 'Zone Intrusion',
            severity: 'medium',
            title: 'Construction Zone Intrusion',
            description: 'Unauthorized person in active construction area',
            timestamp: '4 minutes ago',
            camera: 'Camera 45 - Construction Site',
            zone: 'Building B - Construction Zone',
            zoneType: 'restricted',
            confidence: 95,
            acknowledged: false,
            resolved: false,
            metadata: {
                safetyHazards: 'Heavy equipment, open excavations',
                ppeCompliance: 'No hard hat or vest',
                siteSupervisor: 'Alerted',
                evacuationRequired: 'Yes'
            }
        },
        {
            id: '25',
            category: 'line-crossing',
            type: 'Line Crossing',
            severity: 'high',
            title: 'Rail Crossing Violation',
            description: 'Vehicle crossing railroad tracks while lights active',
            timestamp: '1 minute ago',
            camera: 'Camera 51 - Rail Crossing',
            zone: 'North Rail Crossing',
            zoneType: 'perimeter',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            metadata: {
                trainApproaching: 'Yes - 500 meters',
                crossingArms: 'Down - Ignored',
                vehicleType: 'Pickup truck',
                licensePlate: 'XYZ-7890',
                policeNotified: 'Yes'
            }
        },
        {
            id: '26',
            category: 'dwell-time',
            type: 'Dwell Time Exceeded',
            severity: 'high',
            title: 'Person Dwell - Rooftop',
            description: 'Individual on rooftop for extended period',
            timestamp: '2 minutes ago',
            camera: 'Camera 35 - Rooftop',
            zone: 'Building A - Rooftop',
            zoneType: 'restricted',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            duration: '18 minutes',
            threshold: '5 minutes',
            metadata: {
                individualCount: 1,
                behavior: 'Pacing, looking over edge',
                safetyRisk: 'Potential suicide attempt',
                emergencyResponse: 'Crisis team dispatched'
            }
        },
        {
            id: '27',
            category: 'occupancy',
            type: 'Occupancy Limit Exceeded',
            severity: 'critical',
            title: 'Emergency Exit Blocked',
            description: 'Emergency exit blocked by stored materials',
            timestamp: '3 minutes ago',
            camera: 'Camera 17 - Corridor D',
            zone: 'Emergency Exit - Stairwell D',
            zoneType: 'common',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            currentValue: 100,
            maxValue: 0,
            metadata: {
                obstruction: 'Pallets, boxes',
                fireCodeViolation: 'Critical',
                inspectionDate: '2024-03-01',
                fireWarden: 'Alerted',
                immediateAction: 'Clear exit'
            }
        },
        {
            id: '28',
            category: 'perimeter-breach',
            type: 'Perimeter Breach',
            severity: 'critical',
            title: 'Water Perimeter Breach',
            description: 'Unauthorized boat approaching restricted dock',
            timestamp: '4 minutes ago',
            camera: 'Thermal Camera 55 - Waterfront',
            zone: 'Maritime Exclusion Zone',
            zoneType: 'perimeter',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                vesselType: 'Small speedboat',
                occupants: '3 persons',
                distance: '200 meters',
                speed: '25 knots',
                warningIssued: 'Radio warning transmitted',
                coastGuard: 'Notified'
            }
        }
    ]);

    const categories = [
        { value: 'all', label: 'All Zone Alerts', icon: MapPin },
        { value: 'intrusion', label: 'Zone Intrusion', icon: Shield },
        { value: 'line-crossing', label: 'Line Crossing', icon: ArrowLeftRight },
        { value: 'perimeter-breach', label: 'Perimeter Breach', icon: Target },
        { value: 'dwell-time', label: 'Dwell Time', icon: Clock },
        { value: 'occupancy', label: 'Occupancy', icon: Users }
    ];

    const zoneTypes = [
        { value: 'all', label: 'All Zones' },
        { value: 'restricted', label: 'Restricted Areas' },
        { value: 'perimeter', label: 'Perimeter' },
        { value: 'common', label: 'Common Areas' },
        { value: 'warehouse', label: 'Warehouse' },
        { value: 'office', label: 'Office' },
        { value: 'parking', label: 'Parking' },
        { value: 'entry', label: 'Entry Points' }
    ];

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-100 text-red-800 border-red-200';
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'intrusion': return <Shield className="w-4 h-4" />;
            case 'line-crossing': return <ArrowLeftRight className="w-4 h-4" />;
            case 'perimeter-breach': return <Target className="w-4 h-4" />;
            case 'dwell-time': return <Clock className="w-4 h-4" />;
            case 'occupancy': return <Users className="w-4 h-4" />;
            default: return <MapPin className="w-4 h-4" />;
        }
    };

    const getZoneTypeColor = (zoneType: string) => {
        switch (zoneType) {
            case 'restricted': return 'bg-purple-100 text-purple-800';
            case 'perimeter': return 'bg-red-100 text-red-800';
            case 'common': return 'bg-green-100 text-green-800';
            case 'warehouse': return 'bg-yellow-100 text-yellow-800';
            case 'office': return 'bg-blue-100 text-blue-800';
            case 'parking': return 'bg-gray-100 text-gray-800';
            case 'entry': return 'bg-indigo-100 text-indigo-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const filteredAlerts = alerts.filter(alert => {
        if (selectedCategory !== 'all' && alert.category !== selectedCategory) return false;
        if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) return false;
        if (selectedZone !== 'all' && alert.zoneType !== selectedZone) return false;
        if (!showAcknowledged && alert.acknowledged) return false;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                alert.title.toLowerCase().includes(searchLower) ||
                alert.description.toLowerCase().includes(searchLower) ||
                alert.type.toLowerCase().includes(searchLower) ||
                alert.zone.toLowerCase().includes(searchLower) ||
                alert.camera.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    const acknowledgeAlert = (id: string) => {
        setAlerts(alerts.map(alert =>
            alert.id === id ? { ...alert, acknowledged: true } : alert
        ));
    };

    const resolveAlert = (id: string) => {
        setAlerts(alerts.map(alert =>
            alert.id === id ? { ...alert, resolved: true, acknowledged: true } : alert
        ));
    };

    const dismissAlert = (id: string) => {
        setAlerts(alerts.filter(alert => alert.id !== id));
    };

    const getStats = () => {
        const active = alerts.filter(a => !a.resolved).length;
        const critical = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
        const high = alerts.filter(a => a.severity === 'high' && !a.resolved).length;
        const medium = alerts.filter(a => a.severity === 'medium' && !a.resolved).length;
        const low = alerts.filter(a => a.severity === 'low' && !a.resolved).length;

        const byCategory = categories.filter(c => c.value !== 'all').map(cat => ({
            ...cat,
            count: alerts.filter(a => a.category === cat.value && !a.resolved).length
        }));

        const byZoneType = zoneTypes.filter(z => z.value !== 'all').map(zone => ({
            ...zone,
            count: alerts.filter(a => a.zoneType === zone.value && !a.resolved).length
        }));

        return { active, critical, high, medium, low, byCategory, byZoneType };
    };

    const stats = getStats();

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Zone Alerts</h1>
                    <p className="text-sm text-gray-500 mt-1">Real-time zone monitoring and security alerts</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowMap(!showMap)}
                        className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showMap
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {showMap ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        {showMap ? 'Hide Map' : 'Show Zone Map'}
                    </button>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700">
                        <Bell className="w-4 h-4" />
                        Configure Zones
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Active Zone Alerts</p>
                            <p className="text-2xl font-bold">{stats.active}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-full">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Requires attention</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Critical</p>
                            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-full">
                            <Shield className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                    <p className="text-xs text-red-400 mt-2">Immediate action required</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Intrusions</p>
                            <p className="text-2xl font-bold text-orange-600">
                                {alerts.filter(a => a.category === 'intrusion' && !a.resolved).length}
                            </p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-full">
                            <Target className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-xs text-orange-400 mt-2">Active intrusions</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Perimeter Breaches</p>
                            <p className="text-2xl font-bold text-yellow-600">
                                {alerts.filter(a => a.category === 'perimeter-breach' && !a.resolved).length}
                            </p>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-full">
                            <MapPin className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                    <p className="text-xs text-yellow-400 mt-2">Security perimeter</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Occupancy Issues</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {alerts.filter(a => a.category === 'occupancy' && !a.resolved).length}
                            </p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-full">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <p className="text-xs text-purple-400 mt-2">Capacity exceeded</p>
                </div>
            </div>

            {/* Zone Map Visualization (Conditional) */}
            {showMap && (
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Zone Map Overview</h3>
                        <div className="flex gap-2">
                            <button className="p-1 hover:bg-gray-100 rounded">
                                <Plus className="w-4 h-4" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded">
                                <Minus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="relative bg-gray-100 rounded-lg h-64 overflow-hidden">
                        {/* Simulated zone map */}
                        <div className="absolute inset-0 p-4">
                            {/* Zone Grid */}
                            <div className="grid grid-cols-4 gap-2 h-full">
                                <div className="relative border-2 border-red-300 bg-red-50/30 rounded-lg flex items-center justify-center">
                                    <span className="text-xs font-medium text-red-600">Restricted Zone A</span>
                                    <CircleDot className="absolute top-1 right-1 w-3 h-3 text-red-600 animate-pulse" />
                                </div>
                                <div className="relative border-2 border-yellow-300 bg-yellow-50/30 rounded-lg col-span-2 flex items-center justify-center">
                                    <span className="text-xs font-medium text-yellow-600">Warehouse</span>
                                    <Circle className="absolute top-1 right-1 w-3 h-3 text-yellow-600" />
                                </div>
                                <div className="relative border-2 border-blue-300 bg-blue-50/30 rounded-lg flex items-center justify-center">
                                    <span className="text-xs font-medium text-blue-600">Office Wing</span>
                                </div>
                                <div className="relative border-2 border-purple-300 bg-purple-50/30 rounded-lg col-span-2 flex items-center justify-center">
                                    <span className="text-xs font-medium text-purple-600">Perimeter North</span>
                                    <AlertTriangle className="absolute top-1 right-1 w-3 h-3 text-red-600 animate-pulse" />
                                </div>
                                <div className="relative border-2 border-green-300 bg-green-50/30 rounded-lg flex items-center justify-center">
                                    <span className="text-xs font-medium text-green-600">Parking</span>
                                </div>
                                <div className="relative border-2 border-orange-300 bg-orange-50/30 rounded-lg col-span-2 flex items-center justify-center">
                                    <span className="text-xs font-medium text-orange-600">Entry Points</span>
                                    <CircleDot className="absolute top-1 right-1 w-3 h-3 text-orange-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4 mt-3 text-xs">
                        <div className="flex items-center gap-1">
                            <CircleDot className="w-3 h-3 text-red-600" />
                            <span>Active Alerts (5)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Circle className="w-3 h-3 text-yellow-600" />
                            <span>Watched Zones</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                            <span>Clear</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Stats */}
            <div className="grid grid-cols-5 gap-3">
                {stats.byCategory.map(cat => (
                    <div key={cat.value} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2">
                            <cat.icon className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">{cat.label}</span>
                        </div>
                        <p className="text-lg font-semibold mt-1">{cat.count}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search zone alerts..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <select
                        className="px-3 py-2 border border-gray-300 rounded-lg min-w-[180px]"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        {categories.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                    </select>

                    <select
                        className="px-3 py-2 border border-gray-300 rounded-lg min-w-[150px]"
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                    >
                        {zoneTypes.map(zone => (
                            <option key={zone.value} value={zone.value}>{zone.label}</option>
                        ))}
                    </select>

                    <select
                        className="px-3 py-2 border border-gray-300 rounded-lg min-w-[150px]"
                        value={selectedSeverity}
                        onChange={(e) => setSelectedSeverity(e.target.value)}
                    >
                        <option value="all">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="showAcknowledgedZone"
                            checked={showAcknowledged}
                            onChange={(e) => setShowAcknowledged(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="showAcknowledgedZone" className="text-sm text-gray-700 whitespace-nowrap">
                            Show Acknowledged
                        </label>
                    </div>

                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                        <button
                            className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                            onClick={() => setViewMode('grid')}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                            onClick={() => setViewMode('list')}
                        >
                            <Layers className="w-4 h-4" />
                        </button>
                    </div>

                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                        <Filter className="w-4 h-4" />
                        More Filters
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
            </div>
            {/* Recent Activity Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Recent Zone Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-red-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700 mb-1">
                            <Shield className="w-4 h-4" />
                            <span className="font-medium">Most Active Zone</span>
                        </div>
                        <p className="text-lg font-bold">Entry Points</p>
                        <p className="text-sm text-red-600">12 alerts in last hour</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-orange-700 mb-1">
                            <TrendingUp className="w-4 h-4" />
                            <span className="font-medium">Trending Alert</span>
                        </div>
                        <p className="text-lg font-bold">Perimeter Breach</p>
                        <p className="text-sm text-orange-600">↑ 45% increase</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">Avg Response Time</span>
                        </div>
                        <p className="text-lg font-bold">3.2 minutes</p>
                        <p className="text-sm text-green-600">↓ 30 seconds improvement</p>
                    </div>
                </div>
            </div>
            {/* Alerts Display */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAlerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`bg-white rounded-lg border-l-4 ${alert.severity === 'critical' ? 'border-l-red-600' :
                                    alert.severity === 'high' ? 'border-l-orange-500' :
                                        alert.severity === 'medium' ? 'border-l-yellow-500' :
                                            'border-l-blue-500'
                                } border border-gray-200 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className={`p-2 rounded-lg ${alert.severity === 'critical' ? 'bg-red-50' :
                                            alert.severity === 'high' ? 'bg-orange-50' :
                                                alert.severity === 'medium' ? 'bg-yellow-50' :
                                                    'bg-blue-50'
                                        }`}>
                                        {getCategoryIcon(alert.category)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                                            {alert.severity}
                                        </span>
                                        {!alert.acknowledged && (
                                            <span className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></span>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{alert.description}</p>
                                </div>

                                {/* Zone Type Badge */}
                                <div className="mb-3">
                                    <span className={`text-xs px-2 py-1 rounded-full ${getZoneTypeColor(alert.zoneType)}`}>
                                        {alert.zoneType.replace('-', ' ').toUpperCase()}
                                    </span>
                                </div>

                                {/* Alert-specific metrics */}
                                {alert.category === 'dwell-time' && (
                                    <div className="bg-gray-50 p-2 rounded-lg mb-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Duration:</span>
                                            <span className="font-medium text-orange-600">{alert.duration}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">Threshold:</span>
                                            <span className="font-medium">{alert.threshold}</span>
                                        </div>
                                    </div>
                                )}

                                {alert.category === 'occupancy' && (
                                    <div className="bg-gray-50 p-2 rounded-lg mb-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Current:</span>
                                            <span className="font-bold text-red-600">{alert.currentValue}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Max:</span>
                                            <span className="font-medium">{alert.maxValue}</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
                                            <div
                                                className="h-full bg-red-600 rounded-full"
                                                style={{ width: `${(alert.currentValue! / alert.maxValue! * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {/* Metadata Tags */}
                                {alert.metadata && (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {Object.entries(alert.metadata).slice(0, 3).map(([key, value]) => (
                                            <span key={key} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                                {key}: {String(value).substring(0, 15)}
                                                {String(value).length > 15 ? '...' : ''}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Location and Time */}
                                <div className="space-y-1 mb-3 text-xs text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <Camera className="w-3 h-3" />
                                        <span className="truncate">{alert.camera}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        <span className="truncate">{alert.zone}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{alert.timestamp}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                    {!alert.acknowledged && (
                                        <button
                                            onClick={() => acknowledgeAlert(alert.id)}
                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                            title="Acknowledge"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                    )}
                                    {!alert.resolved && alert.acknowledged && (
                                        <button
                                            onClick={() => resolveAlert(alert.id)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                            title="Resolve"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => dismissAlert(alert.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                        title="Dismiss"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Confidence Badge */}
                                <div className="mt-2 text-right">
                                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                        {alert.confidence}% confidence
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // List View
                <div className="space-y-3">
                    {filteredAlerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`bg-white rounded-lg border-l-4 ${alert.severity === 'critical' ? 'border-l-red-600' :
                                    alert.severity === 'high' ? 'border-l-orange-500' :
                                        alert.severity === 'medium' ? 'border-l-yellow-500' :
                                            'border-l-blue-500'
                                } border border-gray-200 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            <div className="p-4">
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={`p-3 rounded-lg ${alert.severity === 'critical' ? 'bg-red-50' :
                                            alert.severity === 'high' ? 'bg-orange-50' :
                                                alert.severity === 'medium' ? 'bg-yellow-50' :
                                                    'bg-blue-50'
                                        }`}>
                                        {getCategoryIcon(alert.category)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                                                {alert.severity.toUpperCase()}
                                            </span>
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${getZoneTypeColor(alert.zoneType)}`}>
                                                {alert.zoneType}
                                            </span>
                                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded-full">
                                                {alert.type}
                                            </span>
                                            {!alert.acknowledged && (
                                                <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-pulse"></span>
                                                    NEW
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-600 mb-2">{alert.description}</p>

                                        {/* Alert-specific metrics inline */}
                                        {alert.category === 'dwell-time' && (
                                            <div className="flex items-center gap-4 mb-2 text-sm">
                                                <span className="flex items-center gap-1 text-orange-600">
                                                    <Clock className="w-4 h-4" />
                                                    Duration: {alert.duration}
                                                </span>
                                                <span className="text-gray-500">
                                                    Threshold: {alert.threshold}
                                                </span>
                                            </div>
                                        )}

                                        {alert.category === 'occupancy' && (
                                            <div className="flex items-center gap-4 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm font-medium">{alert.currentValue}/{alert.maxValue}</span>
                                                </div>
                                                <div className="w-32 h-2 bg-gray-200 rounded-full">
                                                    <div
                                                        className="h-full bg-red-600 rounded-full"
                                                        style={{ width: `${(alert.currentValue! / alert.maxValue! * 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Location and Time */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <Camera className="w-3 h-3" />
                                                {alert.camera}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {alert.zone}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {alert.timestamp}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Activity className="w-3 h-3" />
                                                {alert.confidence}% confidence
                                            </span>
                                        </div>

                                        {/* Metadata */}
                                        {alert.metadata && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {Object.entries(alert.metadata).map(([key, value]) => (
                                                    <span key={key} className="text-xs bg-gray-50 px-2 py-1 rounded-full text-gray-600">
                                                        {key.replace(/([A-Z])/g, ' $1').trim()}: {String(value)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-1">
                                        {!alert.acknowledged && (
                                            <button
                                                onClick={() => acknowledgeAlert(alert.id)}
                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                                title="Acknowledge"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                        {!alert.resolved && alert.acknowledged && (
                                            <button
                                                onClick={() => resolveAlert(alert.id)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                title="Resolve"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => dismissAlert(alert.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Dismiss"
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {filteredAlerts.length === 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Zone Alerts Found</h3>
                    <p className="text-gray-500">No alerts match your current filter criteria.</p>
                    <button
                        onClick={() => {
                            setSelectedCategory('all');
                            setSelectedSeverity('all');
                            setSelectedZone('all');
                            setSearchTerm('');
                            setShowAcknowledged(true);
                        }}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Clear Filters
                    </button>
                </div>
            )}

            {/* Zone Analytics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Alerts by Zone Type</h3>
                        <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <BarChart3 className="w-4 h-4" />
                            View Details
                        </button>
                    </div>
                    <div className="space-y-2">
                        {stats.byZoneType.map(zone => (
                            <div key={zone.value} className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 w-24">{zone.label}</span>
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${zone.value === 'restricted' ? 'bg-purple-600' :
                                                zone.value === 'perimeter' ? 'bg-red-600' :
                                                    zone.value === 'common' ? 'bg-green-600' :
                                                        zone.value === 'warehouse' ? 'bg-yellow-600' :
                                                            zone.value === 'entry' ? 'bg-indigo-600' :
                                                                'bg-blue-600'
                                            }`}
                                        style={{ width: `${(zone.count / stats.active * 100) || 0}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm font-medium w-8">{zone.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Alert Distribution</h3>
                        <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            Trends
                        </button>
                    </div>
                    <div className="space-y-2">
                        {stats.byCategory.map(cat => (
                            <div key={cat.value} className="flex items-center gap-2">
                                <cat.icon className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600 flex-1">{cat.label}</span>
                                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 rounded-full"
                                        style={{ width: `${(cat.count / stats.active * 100) || 0}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm font-medium w-8">{cat.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>


        </div>
    );
};

export default ZoneAlerts;