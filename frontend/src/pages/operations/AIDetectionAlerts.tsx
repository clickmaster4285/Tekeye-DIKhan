import React, { useState } from 'react';
import {
    Bell,
    AlertTriangle,
    Camera,
    Users,
    Car,
    Flame,
    Thermometer,
    Shield,
    Activity,
    Filter,
    Download,
    Eye,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    User,
    AlertCircle,
    Zap,
    Users2,
    Gauge,
    Calendar,
    Search,
    ChevronDown,
    BarChart3,
    PieChart,
    RefreshCw,
    Info
} from 'lucide-react';

interface DetectionAlert {
    id: string;
    category: 'person' | 'vehicle' | 'face' | 'weapon' | 'fire' | 'behavior' | 'object' | 'crowd' | 'thermal';
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    timestamp: string;
    camera: string;
    zone: string;
    confidence: number;
    acknowledged: boolean;
    resolved: boolean;
    thumbnail?: string;
    metadata?: Record<string, any>;
}

const AIDetectionAlerts: React.FC = () => {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showAcknowledged, setShowAcknowledged] = useState<boolean>(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    // Dummy data covering all alert types
    const [alerts, setAlerts] = useState<DetectionAlert[]>([
        // PERSON DETECTED ALERTS
        {
            id: '1',
            category: 'person',
            type: 'Person Detected',
            severity: 'low',
            title: 'Person Detected - Zone B',
            description: 'Individual detected in warehouse aisle 7',
            timestamp: '2 minutes ago',
            camera: 'Camera 07 - Warehouse North',
            zone: 'Warehouse Zone B',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                gender: 'Male',
                clothing: 'Blue shirt, Black pants',
                direction: 'Northbound',
                speed: 'Walking'
            }
        },
        {
            id: '2',
            category: 'person',
            type: 'Person Detected',
            severity: 'low',
            title: 'Person Detected - Restricted Hours',
            description: 'Individual detected in office area after hours',
            timestamp: '15 minutes ago',
            camera: 'Camera 12 - Office Corridor',
            zone: 'Admin Building',
            confidence: 95,
            acknowledged: true,
            resolved: false,
            metadata: {
                gender: 'Female',
                clothing: 'Dark clothing',
                direction: 'Eastbound',
                speed: 'Walking'
            }
        },

        // VEHICLE DETECTED ALERTS
        {
            id: '3',
            category: 'vehicle',
            type: 'Vehicle Detected',
            severity: 'medium',
            title: 'Vehicle Detected - Loading Bay',
            description: 'Truck entering loading bay after hours',
            timestamp: '5 minutes ago',
            camera: 'Camera 04 - Loading Bay',
            zone: 'Logistics Zone',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            metadata: {
                vehicleType: 'Truck',
                color: 'White',
                speed: '5 mph',
                direction: 'Entering'
            }
        },
        {
            id: '4',
            category: 'vehicle',
            type: 'Vehicle Detected',
            severity: 'low',
            title: 'Vehicle Detected - Staff Parking',
            description: 'Vehicle entering staff parking area',
            timestamp: '8 minutes ago',
            camera: 'Camera 09 - Parking Entry',
            zone: 'Parking Zone A',
            confidence: 97,
            acknowledged: true,
            resolved: true,
            metadata: {
                vehicleType: 'Sedan',
                color: 'Silver',
                speed: '10 mph',
                direction: 'Entering'
            }
        },

        // FACE MATCH ALERTS
        {
            id: '5',
            category: 'face',
            type: 'Face Match - Blacklist',
            severity: 'critical',
            title: 'BLACKLIST MATCH: Person of Interest',
            description: 'Individual matches blacklist entry #BL-2024-089 - John Doe',
            timestamp: '1 minute ago',
            camera: 'Camera 01 - Main Entrance',
            zone: 'Entry Point',
            confidence: 96,
            acknowledged: false,
            resolved: false,
            metadata: {
                matchConfidence: '96%',
                blacklistId: 'BL-2024-089',
                riskLevel: 'High',
                lastSeen: '2024-03-15'
            }
        },
        {
            id: '6',
            category: 'face',
            type: 'Face Match - Whitelist',
            severity: 'low',
            title: 'Whitelist Match: Employee Detected',
            description: 'Authorized employee detected - Sarah Johnson (ID: EMP-789)',
            timestamp: '3 minutes ago',
            camera: 'Camera 03 - Security Gate',
            zone: 'Entry Point',
            confidence: 99,
            acknowledged: true,
            resolved: true,
            metadata: {
                employeeId: 'EMP-789',
                department: 'Operations',
                accessLevel: 'Level 3'
            }
        },
        {
            id: '7',
            category: 'face',
            type: 'Face Match - Watchlist',
            severity: 'high',
            title: 'Watchlist Match: Vendor',
            description: 'Vendor on watchlist detected at delivery entrance',
            timestamp: '7 minutes ago',
            camera: 'Camera 06 - Delivery Gate',
            zone: 'Logistics Zone',
            confidence: 88,
            acknowledged: false,
            resolved: false,
            metadata: {
                vendorId: 'VEN-456',
                company: 'Express Deliveries',
                flag: 'Expired credentials'
            }
        },

        // UNKNOWN PERSON ALERTS
        {
            id: '8',
            category: 'face',
            type: 'Unknown Person',
            severity: 'high',
            title: 'Unknown Person - Restricted Area',
            description: 'Unidentified individual in server room corridor',
            timestamp: '4 minutes ago',
            camera: 'Camera 21 - Server Room',
            zone: 'Restricted Zone',
            confidence: 92,
            acknowledged: false,
            resolved: false,
            metadata: {
                appearance: 'Hoodie, Face obscured',
                direction: 'Towards secure area',
                timeInZone: '30 seconds'
            }
        },
        {
            id: '9',
            category: 'face',
            type: 'Unknown Person',
            severity: 'medium',
            title: 'Unknown Person - Warehouse',
            description: 'Unidentified person in warehouse without visitor badge',
            timestamp: '12 minutes ago',
            camera: 'Camera 18 - Warehouse',
            zone: 'Storage Zone C',
            confidence: 85,
            acknowledged: false,
            resolved: false
        },

        // LICENSE PLATE MATCH ALERTS
        {
            id: '10',
            category: 'vehicle',
            type: 'License Plate Match - Blacklist',
            severity: 'critical',
            title: 'BLACKLIST VEHICLE DETECTED',
            description: 'Vehicle LWK-7890 flagged on stolen vehicle list',
            timestamp: '30 seconds ago',
            camera: 'Camera 02 - Entry Gate',
            zone: 'Main Gate',
            confidence: 100,
            acknowledged: false,
            resolved: false,
            metadata: {
                plateNumber: 'LWK-7890',
                vehicleModel: 'Toyota Corolla',
                color: 'Black',
                listType: 'Stolen Vehicles'
            }
        },
        {
            id: '11',
            category: 'vehicle',
            type: 'License Plate Match - Whitelist',
            severity: 'low',
            title: 'Whitelist Vehicle - VIP',
            description: 'VIP vehicle detected - CEO Mercedes S-Class',
            timestamp: '6 minutes ago',
            camera: 'Camera 01 - VIP Entrance',
            zone: 'Executive Parking',
            confidence: 99,
            acknowledged: true,
            resolved: true,
            metadata: {
                plateNumber: 'VIP-001',
                owner: 'CEO Office',
                priority: 'High'
            }
        },
        {
            id: '12',
            category: 'vehicle',
            type: 'License Plate Match - Watchlist',
            severity: 'medium',
            title: 'Watchlist Vehicle - Suspended Registration',
            description: 'Vehicle with suspended registration detected',
            timestamp: '10 minutes ago',
            camera: 'Camera 05 - Parking Entry',
            zone: 'Parking Zone B',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                plateNumber: 'XYZ-456',
                reason: 'Registration expired 6 months',
                state: 'California'
            }
        },

        // WEAPON DETECTED ALERTS
        {
            id: '13',
            category: 'weapon',
            type: 'Weapon Detected',
            severity: 'critical',
            title: 'POTENTIAL WEAPON DETECTED',
            description: 'Object resembling handgun detected at security checkpoint',
            timestamp: '45 seconds ago',
            camera: 'Camera 03 - Security Screening',
            zone: 'Main Entrance',
            confidence: 89,
            acknowledged: false,
            resolved: false,
            metadata: {
                weaponType: 'Handgun (tentative)',
                location: 'Baggage area',
                action: 'Alert security personnel'
            }
        },
        {
            id: '14',
            category: 'weapon',
            type: 'Weapon Detected',
            severity: 'critical',
            title: 'Knife Detected',
            description: 'Blade detected in parking lot altercation',
            timestamp: '3 minutes ago',
            camera: 'Camera 14 - Parking Lot',
            zone: 'Parking Zone C',
            confidence: 94,
            acknowledged: false,
            resolved: false,
            metadata: {
                weaponType: 'Knife/Blade',
                individuals: '2 males fighting',
                riskLevel: 'Critical'
            }
        },

        // FIRE DETECTED ALERTS
        {
            id: '15',
            category: 'fire',
            type: 'Fire Detected',
            severity: 'critical',
            title: 'FIRE DETECTED - Warehouse',
            description: 'Flames detected in warehouse section C, aisle 12',
            timestamp: '2 minutes ago',
            camera: 'Camera 31 - Warehouse C',
            zone: 'Storage Zone C',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            metadata: {
                fireSize: 'Small (2 sq ft)',
                nearbyMaterials: 'Cardboard, Pallets',
                sprinklerStatus: 'Active'
            }
        },
        {
            id: '16',
            category: 'fire',
            type: 'Fire Detected',
            severity: 'critical',
            title: 'Fire Detected - Electrical Room',
            description: 'Smoke and flames visible in electrical panel',
            timestamp: '5 minutes ago',
            camera: 'Camera 33 - Electrical Room',
            zone: 'Utility Area',
            confidence: 96,
            acknowledged: false,
            resolved: false,
            metadata: {
                source: 'Electrical panel',
                intensity: 'Growing',
                alarmStatus: 'Triggered'
            }
        },

        // SMOKE DETECTED ALERTS
        {
            id: '17',
            category: 'fire',
            type: 'Smoke Detected',
            severity: 'high',
            title: 'Smoke Detected - Cafeteria',
            description: 'Smoke detected near kitchen exhaust',
            timestamp: '4 minutes ago',
            camera: 'Camera 19 - Cafeteria',
            zone: 'Common Area',
            confidence: 92,
            acknowledged: false,
            resolved: false,
            metadata: {
                smokeDensity: 'Moderate',
                source: 'Kitchen area',
                ventilation: 'Active'
            }
        },
        {
            id: '18',
            category: 'fire',
            type: 'Smoke Detected',
            severity: 'high',
            title: 'Smoke Detected - Loading Dock',
            description: 'Smoke from truck exhaust in enclosed area',
            timestamp: '8 minutes ago',
            camera: 'Camera 08 - Loading Dock',
            zone: 'Logistics Zone',
            confidence: 88,
            acknowledged: true,
            resolved: false,
            metadata: {
                source: 'Vehicle exhaust',
                ventilation: 'Poor',
                action: 'Open bay doors'
            }
        },

        // FALL DETECTED ALERTS
        {
            id: '19',
            category: 'behavior',
            type: 'Fall Detected',
            severity: 'high',
            title: 'PERSON FALLEN - Warehouse',
            description: 'Individual fallen in aisle 5, not moving',
            timestamp: '1 minute ago',
            camera: 'Camera 22 - Warehouse',
            zone: 'Storage Zone A',
            confidence: 95,
            acknowledged: false,
            resolved: false,
            metadata: {
                timeDown: '15 seconds',
                movement: 'None detected',
                assistance: 'Required'
            }
        },
        {
            id: '20',
            category: 'behavior',
            type: 'Fall Detected',
            severity: 'high',
            title: 'Fall Detected - Stairwell',
            description: 'Person fallen on staircase',
            timestamp: '3 minutes ago',
            camera: 'Camera 17 - Stairwell B',
            zone: 'Building B',
            confidence: 93,
            acknowledged: false,
            resolved: false,
            metadata: {
                location: 'Midway on stairs',
                movement: 'Minimal',
                alertSent: 'First responders'
            }
        },

        // FIGHTING DETECTED ALERTS
        {
            id: '21',
            category: 'behavior',
            type: 'Fighting Detected',
            severity: 'critical',
            title: 'FIGHT IN PROGRESS - Parking Lot',
            description: 'Physical altercation between multiple individuals',
            timestamp: '30 seconds ago',
            camera: 'Camera 15 - Parking Lot',
            zone: 'Parking Zone A',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                participants: '3 individuals',
                intensity: 'High',
                weapons: 'None detected'
            }
        },
        {
            id: '22',
            category: 'behavior',
            type: 'Fighting Detected',
            severity: 'critical',
            title: 'Fighting - Warehouse Floor',
            description: 'Altercation between workers in packing area',
            timestamp: '2 minutes ago',
            camera: 'Camera 24 - Packing Area',
            zone: 'Warehouse',
            confidence: 96,
            acknowledged: false,
            resolved: false,
            metadata: {
                participants: '2 individuals',
                intensity: 'Medium',
                supervisor: 'Notified'
            }
        },

        // ABANDONED OBJECT ALERTS
        {
            id: '23',
            category: 'object',
            type: 'Abandoned Object',
            severity: 'high',
            title: 'SUSPICIOUS PACKAGE - Lobby',
            description: 'Unattended bag in lobby for 10+ minutes',
            timestamp: '2 minutes ago',
            camera: 'Camera 01 - Main Lobby',
            zone: 'Building A',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            metadata: {
                objectType: 'Backpack',
                timeUnattended: '12 minutes',
                owner: 'Unknown'
            }
        },
        {
            id: '24',
            category: 'object',
            type: 'Abandoned Object',
            severity: 'medium',
            title: 'Unattended Luggage - Reception',
            description: 'Suitcase left at reception desk',
            timestamp: '5 minutes ago',
            camera: 'Camera 02 - Reception',
            zone: 'Main Entrance',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                objectType: 'Suitcase',
                timeUnattended: '5 minutes',
                action: 'Security check'
            }
        },

        // OBJECT REMOVAL ALERTS
        {
            id: '25',
            category: 'object',
            type: 'Object Removal',
            severity: 'high',
            title: 'Fire Extinguisher Removed',
            description: 'Fire extinguisher removed from designated location',
            timestamp: '3 minutes ago',
            camera: 'Camera 16 - Corridor',
            zone: 'Building B',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            metadata: {
                object: 'Fire extinguisher',
                location: 'Wall mount A-12',
                currentStatus: 'Missing'
            }
        },
        {
            id: '26',
            category: 'object',
            type: 'Object Removal',
            severity: 'medium',
            title: 'Equipment Removed - Server Room',
            description: 'Server rack equipment removed without authorization',
            timestamp: '7 minutes ago',
            camera: 'Camera 21 - Server Room',
            zone: 'Restricted Zone',
            confidence: 94,
            acknowledged: false,
            resolved: false,
            metadata: {
                object: 'Network switch',
                authorized: 'No',
                workOrder: 'None'
            }
        },

        // LOITERING ALERTS
        {
            id: '27',
            category: 'behavior',
            type: 'Loitering',
            severity: 'medium',
            title: 'Loitering - Main Entrance',
            description: 'Individual loitering near entrance for 15+ minutes',
            timestamp: '4 minutes ago',
            camera: 'Camera 01 - Main Entrance',
            zone: 'Entry Point',
            confidence: 96,
            acknowledged: false,
            resolved: false,
            metadata: {
                duration: '18 minutes',
                behavior: 'Observing, pacing',
                action: 'Monitor'
            }
        },
        {
            id: '28',
            category: 'behavior',
            type: 'Loitering',
            severity: 'low',
            title: 'Loitering - Parking Lot',
            description: 'Vehicle parked with engine running for 20+ minutes',
            timestamp: '6 minutes ago',
            camera: 'Camera 12 - Parking Lot',
            zone: 'Parking Zone B',
            confidence: 92,
            acknowledged: true,
            resolved: false,
            metadata: {
                vehicle: 'White van',
                duration: '22 minutes',
                occupants: '1 person'
            }
        },

        // RUNNING ALERTS
        {
            id: '29',
            category: 'behavior',
            type: 'Running',
            severity: 'low',
            title: 'Running - Corridor',
            description: 'Individual running in no-running zone',
            timestamp: '2 minutes ago',
            camera: 'Camera 11 - Main Corridor',
            zone: 'Building A',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                speed: 'Fast run',
                direction: 'Towards exit',
                warning: 'Posted sign ignored'
            }
        },
        {
            id: '30',
            category: 'behavior',
            type: 'Running',
            severity: 'low',
            title: 'Running - Warehouse',
            description: 'Worker running in warehouse safety zone',
            timestamp: '5 minutes ago',
            camera: 'Camera 23 - Warehouse',
            zone: 'Storage Zone B',
            confidence: 95,
            acknowledged: true,
            resolved: true,
            metadata: {
                speed: 'Jogging',
                safetyVest: 'Worn',
                warning: 'Verbally warned'
            }
        },

        // WRONG DIRECTION ALERTS
        {
            id: '31',
            category: 'behavior',
            type: 'Wrong Direction',
            severity: 'medium',
            title: 'Wrong Direction - One Way Gate',
            description: 'Individual exiting through entry gate',
            timestamp: '1 minute ago',
            camera: 'Camera 03 - Security Gate',
            zone: 'Entry Point',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            metadata: {
                direction: 'Exiting through entry',
                gateStatus: 'Alarm triggered',
                action: 'Security check'
            }
        },
        {
            id: '32',
            category: 'behavior',
            type: 'Wrong Direction',
            severity: 'medium',
            title: 'Vehicle Wrong Way - Parking',
            description: 'Vehicle driving wrong way in parking aisle',
            timestamp: '3 minutes ago',
            camera: 'Camera 09 - Parking',
            zone: 'Parking Zone A',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            metadata: {
                vehicle: 'Blue SUV',
                lane: 'Exit lane',
                hazard: 'Near miss'
            }
        },

        // TAILGATING ALERTS
        {
            id: '33',
            category: 'behavior',
            type: 'Tailgating',
            severity: 'high',
            title: 'Tailgating Detected - Security Gate',
            description: 'Multiple individuals entering with single badge',
            timestamp: '30 seconds ago',
            camera: 'Camera 03 - Security Gate',
            zone: 'Entry Point',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                individuals: '3 people',
                badgeUsed: 'Single',
                timeGap: '< 2 seconds'
            }
        },
        {
            id: '34',
            category: 'behavior',
            type: 'Tailgating',
            severity: 'high',
            title: 'Tailgating - VIP Entrance',
            description: 'Unauthorized person following VIP through gate',
            timestamp: '2 minutes ago',
            camera: 'Camera 05 - VIP Entrance',
            zone: 'Executive Area',
            confidence: 95,
            acknowledged: false,
            resolved: false,
            metadata: {
                authorized: 'VIP only',
                individuals: '2 people',
                action: 'Security alert'
            }
        },

        // CROWD FORMATION ALERTS
        {
            id: '35',
            category: 'crowd',
            type: 'Crowd Formation',
            severity: 'medium',
            title: 'Crowd Forming - Main Entrance',
            description: 'Group of 15+ people gathering at entrance',
            timestamp: '3 minutes ago',
            camera: 'Camera 01 - Main Entrance',
            zone: 'Entry Point',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                count: '18 people',
                trend: 'Increasing',
                density: 'Moderate'
            }
        },
        {
            id: '36',
            category: 'crowd',
            type: 'Crowd Formation',
            severity: 'medium',
            title: 'Crowd - Cafeteria',
            description: 'Unusual crowd gathering in cafeteria',
            timestamp: '5 minutes ago',
            camera: 'Camera 19 - Cafeteria',
            zone: 'Common Area',
            confidence: 96,
            acknowledged: false,
            resolved: false,
            metadata: {
                count: '25+ people',
                event: 'Unscheduled meeting',
                capacity: 'Near limit'
            }
        },

        // QUEUE TOO LONG ALERTS
        {
            id: '37',
            category: 'crowd',
            type: 'Queue Too Long',
            severity: 'medium',
            title: 'Long Queue - Security Check',
            description: 'Queue at security exceeds 10 people',
            timestamp: '2 minutes ago',
            camera: 'Camera 02 - Security',
            zone: 'Entry Point',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            metadata: {
                queueLength: '14 people',
                waitTime: '8+ minutes',
                recommendation: 'Open new lane'
            }
        },
        {
            id: '38',
            category: 'crowd',
            type: 'Queue Too Long',
            severity: 'low',
            title: 'Long Queue - Reception',
            description: 'Queue at reception desk growing',
            timestamp: '4 minutes ago',
            camera: 'Camera 02 - Reception',
            zone: 'Lobby',
            confidence: 95,
            acknowledged: true,
            resolved: true,
            metadata: {
                queueLength: '7 people',
                waitTime: '5 minutes',
                action: 'Additional staff called'
            }
        },

        // SOCIAL DISTANCING VIOLATION ALERTS
        {
            id: '39',
            category: 'crowd',
            type: 'Social Distancing Violation',
            severity: 'low',
            title: 'Social Distancing - Check-in',
            description: 'Multiple groups within 1m distance at check-in',
            timestamp: '1 minute ago',
            camera: 'Camera 02 - Check-in',
            zone: 'Entry Point',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            metadata: {
                violations: '4 groups',
                spacing: '< 1 meter',
                recommendation: 'Announce spacing'
            }
        },
        {
            id: '40',
            category: 'crowd',
            type: 'Social Distancing Violation',
            severity: 'low',
            title: 'Social Distancing - Waiting Area',
            description: 'Close contact in waiting area',
            timestamp: '3 minutes ago',
            camera: 'Camera 14 - Waiting Area',
            zone: 'Lobby',
            confidence: 94,
            acknowledged: true,
            resolved: false,
            metadata: {
                violations: '3 pairs',
                spacing: '0.5 meters',
                action: 'Monitor'
            }
        },

        // THERMAL ALERTS
        {
            id: '41',
            category: 'thermal',
            type: 'High Temperature',
            severity: 'high',
            title: 'High Temperature - Server Room',
            description: 'Server rack temperature exceeds threshold',
            timestamp: '2 minutes ago',
            camera: 'Thermal Camera 03',
            zone: 'Server Room',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            metadata: {
                temperature: '42°C',
                threshold: '35°C',
                rack: 'Rack A-7'
            }
        },
        {
            id: '42',
            category: 'thermal',
            type: 'Fever Detected',
            severity: 'high',
            title: 'Fever Detected - Entry Screening',
            description: 'Individual with temperature 38.2°C detected',
            timestamp: '3 minutes ago',
            camera: 'Thermal Camera 01',
            zone: 'Entry Point',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                temperature: '38.2°C',
                threshold: '37.5°C',
                action: 'Secondary screening'
            }
        },
        {
            id: '43',
            category: 'thermal',
            type: 'Equipment Overheating',
            severity: 'critical',
            title: 'Equipment Overheating - Generator',
            description: 'Backup generator temperature critical',
            timestamp: '1 minute ago',
            camera: 'Thermal Camera 04',
            zone: 'Utility Room',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            metadata: {
                temperature: '95°C',
                component: 'Exhaust manifold',
                action: 'Immediate shutdown'
            }
        }
    ]);

    const categories = [
        { value: 'all', label: 'All Categories', icon: Bell },
        { value: 'person', label: 'Person Detection', icon: Users },
        { value: 'vehicle', label: 'Vehicle Detection', icon: Car },
        { value: 'face', label: 'Face Match', icon: User },
        { value: 'weapon', label: 'Weapon Detection', icon: Shield },
        { value: 'fire', label: 'Fire & Smoke', icon: Flame },
        { value: 'behavior', label: 'Behavior', icon: Activity },
        { value: 'object', label: 'Object', icon: AlertCircle },
        { value: 'crowd', label: 'Crowd & Queue', icon: Users2 },
        { value: 'thermal', label: 'Thermal', icon: Thermometer }
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
            case 'person': return <Users className="w-4 h-4" />;
            case 'vehicle': return <Car className="w-4 h-4" />;
            case 'face': return <User className="w-4 h-4" />;
            case 'weapon': return <Shield className="w-4 h-4" />;
            case 'fire': return <Flame className="w-4 h-4" />;
            case 'behavior': return <Activity className="w-4 h-4" />;
            case 'object': return <AlertCircle className="w-4 h-4" />;
            case 'crowd': return <Users2 className="w-4 h-4" />;
            case 'thermal': return <Thermometer className="w-4 h-4" />;
            default: return <Bell className="w-4 h-4" />;
        }
    };

    const getTypeColor = (type: string) => {
        if (type.includes('Blacklist') || type.includes('Weapon') || type.includes('Fire') || type.includes('Fighting')) {
            return 'bg-red-50 text-red-700';
        }
        if (type.includes('Whitelist') || type.includes('Resolved')) {
            return 'bg-green-50 text-green-700';
        }
        if (type.includes('Watchlist') || type.includes('Unknown') || type.includes('Abandoned')) {
            return 'bg-orange-50 text-orange-700';
        }
        return 'bg-gray-50 text-gray-700';
    };

    const filteredAlerts = alerts.filter(alert => {
        if (selectedCategory !== 'all' && alert.category !== selectedCategory) return false;
        if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) return false;
        if (!showAcknowledged && alert.acknowledged) return false;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                alert.title.toLowerCase().includes(searchLower) ||
                alert.description.toLowerCase().includes(searchLower) ||
                alert.type.toLowerCase().includes(searchLower) ||
                alert.camera.toLowerCase().includes(searchLower) ||
                alert.zone.toLowerCase().includes(searchLower)
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
        return { active, critical, high, medium, low };
    };

    const stats = getStats();

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">AI Detection Alerts</h1>
                    <p className="text-sm text-gray-500 mt-1">Real-time AI-powered detection and alert monitoring system</p>
                </div>
                <div className="flex gap-2">
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
                        Configure Alerts
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Active Alerts</p>
                            <p className="text-2xl font-bold">{stats.active}</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-full">
                            <Bell className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Total unresolved</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Critical</p>
                            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-full">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                    <p className="text-xs text-red-400 mt-2">Immediate action required</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">High</p>
                            <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-full">
                            <Zap className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-xs text-orange-400 mt-2">Priority attention</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Medium</p>
                            <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-full">
                            <Gauge className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                    <p className="text-xs text-yellow-400 mt-2">Monitor</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Low</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.low}</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-full">
                            <Info className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-xs text-blue-400 mt-2">Informational</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search alerts by title, description, camera..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <select
                        className="px-3 py-2 border border-gray-300 rounded-lg min-w-[150px]"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        {categories.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
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
                            id="showAcknowledged"
                            checked={showAcknowledged}
                            onChange={(e) => setShowAcknowledged(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="showAcknowledged" className="text-sm text-gray-700">
                            Show Acknowledged
                        </label>
                    </div>

                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                        <button
                            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                            onClick={() => setViewMode('list')}
                        >
                            List
                        </button>
                        <button
                            className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                            onClick={() => setViewMode('grid')}
                        >
                            Grid
                        </button>
                    </div>

                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                        <Filter className="w-4 h-4" />
                        More Filters
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Alert Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Alert Summary</h3>
                    <div className="flex gap-2">
                        <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <BarChart3 className="w-4 h-4" />
                            View Analytics
                        </button>
                        <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <PieChart className="w-4 h-4" />
                            Generate Report
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {categories.filter(c => c.value !== 'all').map(cat => {
                        const count = alerts.filter(a => a.category === cat.value && !a.resolved).length;
                        const Icon = cat.icon;
                        return (
                            <div key={cat.value} className="text-center p-3 bg-gray-50 rounded-lg">
                                <Icon className="w-5 h-5 mx-auto mb-1 text-gray-600" />
                                <div className="text-sm font-medium text-gray-900">{count}</div>
                                <div className="text-xs text-gray-500">{cat.label}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* Alerts Display */}
            {viewMode === 'list' ? (
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
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <div className={`p-2 rounded-lg ${alert.severity === 'critical' ? 'bg-red-50' :
                                            alert.severity === 'high' ? 'bg-orange-50' :
                                                alert.severity === 'medium' ? 'bg-yellow-50' :
                                                    'bg-blue-50'
                                            }`}>
                                            {getCategoryIcon(alert.category)}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                                                    {alert.severity.toUpperCase()}
                                                </span>
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${getTypeColor(alert.type)}`}>
                                                    {alert.type}
                                                </span>
                                                {!alert.acknowledged && (
                                                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-pulse"></span>
                                                        NEW
                                                    </span>
                                                )}
                                                {alert.resolved && (
                                                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                                                        RESOLVED
                                                    </span>
                                                )}
                                                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded-full">
                                                    {alert.confidence}% confidence
                                                </span>
                                            </div>

                                            <p className="text-sm text-gray-600 mt-1">{alert.description}</p>

                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {alert.timestamp}
                                                </span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Camera className="w-3 h-3" />
                                                    {alert.camera}
                                                </span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {alert.zone}
                                                </span>
                                            </div>

                                            {/* Metadata display if available */}
                                            {alert.metadata && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {Object.entries(alert.metadata).map(([key, value]) => (
                                                        <span key={key} className="text-xs bg-gray-50 px-2 py-1 rounded-full text-gray-600">
                                                            {key.replace(/([A-Z])/g, ' $1').trim()}: {value as string}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="ml-0 flex flex-wrap justify-end gap-2 sm:ml-4 sm:flex-nowrap">
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
                                                title="Mark Resolved"
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
            ) : (
                // Grid View
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAlerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`bg-white rounded-lg border-t-4 ${alert.severity === 'critical' ? 'border-t-red-600' :
                                alert.severity === 'high' ? 'border-t-orange-500' :
                                    alert.severity === 'medium' ? 'border-t-yellow-500' :
                                        'border-t-blue-500'
                                } border border-gray-200 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`p-2 rounded-lg ${alert.severity === 'critical' ? 'bg-red-50' :
                                        alert.severity === 'high' ? 'bg-orange-50' :
                                            alert.severity === 'medium' ? 'bg-yellow-50' :
                                                'bg-blue-50'
                                        }`}>
                                        {getCategoryIcon(alert.category)}
                                    </div>
                                    <div className="flex gap-1">
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                                            {alert.severity}
                                        </span>
                                        {!alert.acknowledged && (
                                            <span className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="font-semibold text-gray-900 mb-1">{alert.title}</h3>
                                <p className="text-sm text-gray-600 mb-3">{alert.description}</p>

                                <div className="space-y-2 mb-3">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Camera className="w-3 h-3" />
                                        <span>{alert.camera}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <MapPin className="w-3 h-3" />
                                        <span>{alert.zone}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Clock className="w-3 h-3" />
                                        <span>{alert.timestamp}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1 mb-3">
                                    <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(alert.type)}`}>
                                        {alert.type}
                                    </span>
                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                                        {alert.confidence}% confidence
                                    </span>
                                </div>

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
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {filteredAlerts.length === 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Alerts Found</h3>
                    <p className="text-gray-500">No alerts match your current filter criteria.</p>
                    <button
                        onClick={() => {
                            setSelectedCategory('all');
                            setSelectedSeverity('all');
                            setSearchTerm('');
                            setShowAcknowledged(true);
                        }}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Clear Filters
                    </button>
                </div>
            )}


        </div>
    );
};

export default AIDetectionAlerts;