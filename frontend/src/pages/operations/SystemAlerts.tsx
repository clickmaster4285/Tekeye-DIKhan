import React, { useState } from 'react';
import {
    Activity,
    AlertTriangle,
    Camera,
    HardDrive,
    Network,
    Cpu,
    Bell,
    Filter,
    Download,
    Eye,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    Zap,
    RefreshCw,
    BarChart3,
    TrendingUp,
    Server,
    Wifi,
    WifiOff,
    Database,
    Hdd,
    AlertOctagon,
    Calendar,
    Search,
    ChevronDown,
    Grid,
    Layers,
    Info,
    Settings,
    Shield,
    AlertCircle,
    Power,
    Thermometer,
    HardDrive as HardDriveIcon,
    Key
} from 'lucide-react';

interface SystemAlert {
    id: string;
    category: 'camera' | 'storage' | 'network' | 'ai-engine' | 'license' | 'system';
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'warning';
    title: string;
    description: string;
    timestamp: string;
    component: string;
    location?: string;
    duration?: string;
    threshold?: string;
    currentValue?: string;
    totalValue?: string;
    percentage?: number;
    confidence: number;
    acknowledged: boolean;
    resolved: boolean;
    estimatedResolution?: string;
    impact: 'high' | 'medium' | 'low' | 'none';
    affectedSystems?: string[];
    metadata?: Record<string, any>;
}

const SystemAlerts: React.FC = () => {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
    const [selectedImpact, setSelectedImpact] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showAcknowledged, setShowAcknowledged] = useState<boolean>(true);
    const [showResolved, setShowResolved] = useState<boolean>(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [timeRange, setTimeRange] = useState<string>('24h');

    // Comprehensive system alerts dummy data
    const [alerts, setAlerts] = useState<SystemAlert[]>([
        // CAMERA OFFLINE ALERTS
        {
            id: '1',
            category: 'camera',
            type: 'Camera Offline',
            severity: 'critical',
            title: 'Critical Camera Offline - Main Entrance',
            description: 'Primary security camera at main entrance is offline',
            timestamp: '2 minutes ago',
            component: 'Camera 01 - Hikvision DS-2CD2385G1',
            location: 'Main Entrance - North Wall',
            duration: '15 minutes',
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            affectedSystems: ['Recording Server 1', 'AI Analytics', 'Live Monitoring'],
            metadata: {
                cameraId: 'CAM-001',
                ipAddress: '192.168.1.101',
                lastSeen: '2024-03-15 14:23:45',
                firmware: 'V5.5.8',
                errorCode: 'ERR_CONNECTION_TIMEOUT',
                networkSwitch: 'Switch-07 Port 12',
                backupCamera: 'Camera 02 - Partial coverage'
            }
        },
        {
            id: '2',
            category: 'camera',
            type: 'Camera Offline',
            severity: 'high',
            title: 'Multiple Cameras Offline - Warehouse',
            description: '3 cameras in warehouse section C are offline',
            timestamp: '5 minutes ago',
            component: 'Camera 23, 24, 25',
            location: 'Warehouse - Section C',
            duration: '8 minutes',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            affectedSystems: ['Recording Server 2', 'Motion Detection'],
            metadata: {
                cameraIds: ['CAM-023', 'CAM-024', 'CAM-025'],
                commonFactor: 'Same network switch',
                switchStatus: 'Switch-09 - Ports 1-3 down',
                coverageGap: '1500 sq ft',
                estimatedFix: 'Replace switch'
            }
        },
        {
            id: '3',
            category: 'camera',
            type: 'Camera Offline',
            severity: 'medium',
            title: 'PTZ Camera Offline - Parking Lot',
            description: 'PTZ camera in parking lot not responding',
            timestamp: '12 minutes ago',
            component: 'PTZ Camera 05',
            location: 'Parking Lot - East Side',
            duration: '12 minutes',
            confidence: 98,
            acknowledged: true,
            resolved: false,
            impact: 'medium',
            metadata: {
                cameraId: 'PTZ-005',
                lastMotion: '2024-03-15 14:15:22',
                powerStatus: 'POE failure',
                diagnostic: 'Power cycle initiated',
                backupCoverage: 'Fixed camera 08'
            }
        },

        // CAMERA TAMPERED ALERTS
        {
            id: '4',
            category: 'camera',
            type: 'Camera Tampered',
            severity: 'critical',
            title: 'Camera Tampered - Vault Entrance',
            description: 'Camera lens covered with spray paint',
            timestamp: '1 minute ago',
            component: 'Camera 42',
            location: 'Vault Room - Entrance',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            impact: 'critical',
            affectedSystems: ['Vault Security', 'Recording'],
            metadata: {
                cameraId: 'CAM-042',
                tamperType: 'Lens obstruction - Paint',
                lastClearImage: '2024-03-15 14:28:10',
                securityResponse: 'Guard dispatched',
                evidenceImages: 'Last 5 frames saved'
            }
        },
        {
            id: '5',
            category: 'camera',
            type: 'Camera Tampered',
            severity: 'high',
            title: 'Camera Moved - Server Room',
            description: 'Camera position changed - possible tampering',
            timestamp: '3 minutes ago',
            component: 'Camera 33',
            location: 'Server Room - Rack A',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            metadata: {
                cameraId: 'CAM-033',
                tamperType: 'Physical repositioning',
                originalFOV: 'Racks A1-A8',
                currentFOV: 'Racks A5-A8 only',
                lastAccess: 'No authorized entry',
                investigation: 'Security review'
            }
        },
        {
            id: '6',
            category: 'camera',
            type: 'Camera Tampered',
            severity: 'medium',
            title: 'Camera Defocused - Checkpoint',
            description: 'Security camera at checkpoint out of focus',
            timestamp: '8 minutes ago',
            component: 'Camera 07',
            location: 'Security Checkpoint B',
            confidence: 95,
            acknowledged: false,
            resolved: false,
            impact: 'medium',
            metadata: {
                cameraId: 'CAM-007',
                tamperType: 'Lens defocused',
                imageQuality: 'Blurry - Face detection degraded',
                scheduledMaintenance: 'Tomorrow 10 AM'
            }
        },
        {
            id: '7',
            category: 'camera',
            type: 'Camera Tampered',
            severity: 'low',
            title: 'Camera Dirty Lens - Lobby',
            description: 'Camera lens obstructed by dust/dirt',
            timestamp: '25 minutes ago',
            component: 'Camera 02',
            location: 'Main Lobby',
            confidence: 92,
            acknowledged: true,
            resolved: true,
            impact: 'low',
            metadata: {
                cameraId: 'CAM-002',
                tamperType: 'Lens dirty',
                cleaningSchedule: 'Cleaned - Resolved',
                resolvedBy: 'Maintenance Team'
            }
        },

        // STORAGE FULL ALERTS
        {
            id: '8',
            category: 'storage',
            type: 'Storage Full',
            severity: 'critical',
            title: 'Recording Storage Critical',
            description: 'Main recording array at 98% capacity',
            timestamp: '30 seconds ago',
            component: 'Storage Array 1 - 48TB',
            location: 'Server Room - Rack 4',
            currentValue: '47.2 TB',
            totalValue: '48 TB',
            percentage: 98,
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'critical',
            affectedSystems: ['Recording Server 1', 'Recording Server 2', 'AI Analytics'],
            metadata: {
                storageType: 'RAID 6 - 12x4TB',
                filesystem: '/recordings',
                inodesUsed: '97%',
                oldestRecording: '7 days',
                deletionPolicy: 'Auto-delete in 2 hours',
                recommendedAction: 'Add storage immediately'
            }
        },
        {
            id: '9',
            category: 'storage',
            type: 'Storage Full',
            severity: 'high',
            title: 'Backup Storage Almost Full',
            description: 'Backup storage array at 92% capacity',
            timestamp: '5 minutes ago',
            component: 'Backup Array - 24TB',
            location: 'Server Room - Rack 5',
            currentValue: '22.1 TB',
            totalValue: '24 TB',
            percentage: 92,
            confidence: 99,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            metadata: {
                storageType: 'RAID 5 - 6x4TB',
                filesystem: '/backups',
                backupRetention: '30 days',
                oldestBackup: '28 days',
                estimatedFull: '3 days',
                actionRequired: 'Add disk or archive'
            }
        },
        {
            id: '10',
            category: 'storage',
            type: 'Storage Full',
            severity: 'medium',
            title: 'Analytics Storage Warning',
            description: 'AI analytics storage at 85% capacity',
            timestamp: '15 minutes ago',
            component: 'Analytics Array - 16TB',
            location: 'AI Server',
            currentValue: '13.6 TB',
            totalValue: '16 TB',
            percentage: 85,
            confidence: 98,
            acknowledged: false,
            resolved: false,
            impact: 'medium',
            metadata: {
                storageType: 'SSD RAID 10',
                filesystem: '/ai-data',
                growthRate: '~500GB per day',
                estimatedFull: '5 days',
                optimizationAvailable: 'Compress old data'
            }
        },

        // RECORDING FAILED ALERTS
        {
            id: '11',
            category: 'system',
            type: 'Recording Failed',
            severity: 'critical',
            title: 'Recording Failure - All Cameras',
            description: 'Recording service crashed - no recordings being saved',
            timestamp: '45 seconds ago',
            component: 'Recording Service',
            location: 'Recording Server 1',
            duration: '45 seconds',
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'critical',
            affectedSystems: ['All Cameras', 'Recording Database'],
            metadata: {
                serviceName: 'VMS Recording Service',
                errorCode: 'REC_SERVICE_CRASH',
                lastSuccessfulWrite: '14:29:15',
                camerasAffected: '124 cameras',
                autoRestart: 'Attempt 1/3',
                failoverServer: 'Recording Server 2 - Active'
            }
        },
        {
            id: '12',
            category: 'system',
            type: 'Recording Failed',
            severity: 'high',
            title: 'Recording Failed - Camera Group A',
            description: 'Recording failed for 15 cameras in group A',
            timestamp: '3 minutes ago',
            component: 'Recording Server 2',
            location: 'Server Room',
            duration: '3 minutes',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            metadata: {
                cameraGroup: 'Group A - Perimeter',
                errorCode: 'DISK_WRITE_ERROR',
                storagePath: '/recordings/perimeter',
                diskHealth: 'Disk 3 - Reallocated sectors',
                failoverStatus: 'Switched to backup path'
            }
        },
        {
            id: '13',
            category: 'system',
            type: 'Recording Failed',
            severity: 'medium',
            title: 'Motion Recording Failed',
            description: 'Motion-triggered recording failing for some cameras',
            timestamp: '8 minutes ago',
            component: 'Motion Detection Service',
            location: 'Analytics Server',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            impact: 'medium',
            metadata: {
                camerasAffected: '23 cameras',
                errorCode: 'MOTION_QUEUE_FULL',
                queueSize: '1500+ events',
                serviceRestart: 'Scheduled',
                temporaryFix: 'Reduce motion sensitivity'
            }
        },

        // AI ENGINE ERROR ALERTS
        {
            id: '14',
            category: 'ai-engine',
            type: 'AI Engine Error',
            severity: 'critical',
            title: 'AI Engine Crashed - Face Recognition',
            description: 'Face recognition AI engine service crashed',
            timestamp: '1 minute ago',
            component: 'Face Recognition Module',
            location: 'AI Server - GPU Node 1',
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            affectedSystems: ['Face Detection', 'Watchlist Alerts', 'Access Control'],
            metadata: {
                errorCode: 'CUDA_OUT_OF_MEMORY',
                gpuMemory: '24GB/24GB',
                processID: 'face_rec_789',
                restarts: '3 in last hour',
                recommendation: 'Restart GPU service'
            }
        },
        {
            id: '15',
            category: 'ai-engine',
            type: 'AI Engine Error',
            severity: 'high',
            title: 'Object Detection Model Failed',
            description: 'Object detection model failed to load',
            timestamp: '4 minutes ago',
            component: 'Object Detection AI',
            location: 'AI Server - CPU Node',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            metadata: {
                modelName: 'yolov8x-object-detection',
                errorCode: 'MODEL_CORRUPTION',
                modelPath: '/models/object-detection/latest',
                fallbackModel: 'Using v2.3 model',
                accuracyImpact: '-15% detection rate'
            }
        },
        {
            id: '16',
            category: 'ai-engine',
            type: 'AI Engine Error',
            severity: 'medium',
            title: 'ANPR Module Degraded',
            description: 'License plate recognition accuracy decreased',
            timestamp: '10 minutes ago',
            component: 'ANPR AI Engine',
            location: 'AI Server',
            confidence: 95,
            acknowledged: false,
            resolved: false,
            impact: 'medium',
            metadata: {
                accuracyRate: '78% (normal: 95%)',
                errorCode: 'MODEL_DRIFT',
                cameraAngles: 'Gate cameras affected',
                retrainingStatus: 'New model queued'
            }
        },
        {
            id: '17',
            category: 'ai-engine',
            type: 'AI Engine Error',
            severity: 'low',
            title: 'AI Inference Slowing',
            description: 'AI inference speed below threshold',
            timestamp: '22 minutes ago',
            component: 'Multiple AI Models',
            location: 'AI Server',
            confidence: 92,
            acknowledged: true,
            resolved: false,
            impact: 'low',
            metadata: {
                averageLatency: '450ms (normal: 150ms)',
                bottleneck: 'CPU overload',
                processes: '8 models running',
                optimization: 'Reduce parallel processes'
            }
        },

        // NETWORK ERROR ALERTS
        {
            id: '18',
            category: 'network',
            type: 'Network Error',
            severity: 'critical',
            title: 'Core Switch Failure',
            description: 'Core network switch offline - major connectivity loss',
            timestamp: '30 seconds ago',
            component: 'Core Switch 01',
            location: 'Network Room - Rack 1',
            duration: '30 seconds',
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'critical',
            affectedSystems: ['All Systems', 'Cameras 1-48', 'Access Control'],
            metadata: {
                deviceModel: 'Cisco Catalyst 9500',
                ipAddress: '10.0.0.1',
                errorCode: 'HARDWARE_FAILURE',
                redundantPath: 'Core Switch 02 - Active',
                affectedVLANs: '10,20,30,40',
                technicians: 'Dispatched'
            }
        },
        {
            id: '19',
            category: 'network',
            type: 'Network Error',
            severity: 'high',
            title: 'High Network Latency',
            description: 'Network latency exceeding threshold on backbone',
            timestamp: '2 minutes ago',
            component: 'Network Backbone',
            location: 'Data Center',
            currentValue: '450ms',
            threshold: '100ms',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            affectedSystems: ['Video Streaming', 'AI Analytics', 'Remote Access'],
            metadata: {
                linkType: '10Gb Fiber',
                source: 'Core Switch 01',
                destination: 'Core Switch 02',
                packetLoss: '3.5%',
                bandwidthUsage: '92%',
                suspectedIssue: 'Fiber degradation'
            }
        },
        {
            id: '20',
            category: 'network',
            type: 'Network Error',
            severity: 'medium',
            title: 'Wi-Fi Network Degraded',
            description: 'Wi-Fi performance degraded in Building B',
            timestamp: '5 minutes ago',
            component: 'Wireless Controller',
            location: 'Building B',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            impact: 'medium',
            metadata: {
                accessPointsAffected: '8 APs',
                channelInterference: 'High',
                clientCount: '245 clients',
                errorRate: '12%',
                recommendation: 'Change channels'
            }
        },
        {
            id: '21',
            category: 'network',
            type: 'Network Error',
            severity: 'low',
            title: 'DNS Resolution Slow',
            description: 'DNS response time increased',
            timestamp: '12 minutes ago',
            component: 'DNS Server',
            location: 'Server Room',
            currentValue: '850ms',
            threshold: '200ms',
            confidence: 95,
            acknowledged: true,
            resolved: false,
            impact: 'low',
            metadata: {
                serverIP: '10.0.0.10',
                queriesPerSecond: '1250',
                cacheHitRate: '72%',
                recommendation: 'Increase cache size'
            }
        },

        // LOW DISK SPACE ALERTS
        {
            id: '22',
            category: 'storage',
            type: 'Low Disk Space',
            severity: 'high',
            title: 'System Drive Low Space',
            description: 'OS drive on Recording Server critically low',
            timestamp: '3 minutes ago',
            component: 'C: Drive - Recording Server 1',
            location: 'Server Room',
            currentValue: '4.2 GB',
            totalValue: '120 GB',
            percentage: 3.5,
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            metadata: {
                filesystem: '/dev/sda1',
                mount: '/',
                growthRate: '500MB/hour',
                mainContributor: 'Log files',
                estimatedFull: '8 hours',
                cleanupAction: 'Log rotation triggered'
            }
        },
        {
            id: '23',
            category: 'storage',
            type: 'Low Disk Space',
            severity: 'medium',
            title: 'Database Drive Low Space',
            description: 'Recording database drive at 88% capacity',
            timestamp: '8 minutes ago',
            component: 'D: Drive - Database Server',
            location: 'Server Room',
            currentValue: '1.2 TB',
            totalValue: '1.36 TB',
            percentage: 88,
            confidence: 99,
            acknowledged: false,
            resolved: false,
            impact: 'medium',
            metadata: {
                database: 'Recording Metadata',
                tableSize: '800GB',
                indexSize: '400GB',
                growthRate: '20GB/day',
                estimatedFull: '6 days',
                maintenance: 'Index rebuild scheduled'
            }
        },
        {
            id: '24',
            category: 'storage',
            type: 'Low Disk Space',
            severity: 'low',
            title: 'Temp Directory Low Space',
            description: 'Temporary storage space running low',
            timestamp: '15 minutes ago',
            component: 'T: Drive - Temp Storage',
            location: 'AI Server',
            currentValue: '45 GB',
            totalValue: '100 GB',
            percentage: 45,
            confidence: 96,
            acknowledged: true,
            resolved: true,
            impact: 'low',
            metadata: {
                tempFiles: 'Processing queue',
                oldestFile: '2 hours',
                cleanupJob: 'Ran - 25GB cleared'
            }
        },

        // LICENSE EXPIRING ALERTS
        {
            id: '25',
            category: 'license',
            type: 'License Expiring',
            severity: 'critical',
            title: 'AI Analytics License Expired',
            description: 'AI analytics license has expired - services degraded',
            timestamp: '1 hour ago',
            component: 'AI Analytics Suite',
            location: 'AI Server',
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'critical',
            affectedSystems: ['All AI Features', 'Object Detection', 'Face Recognition'],
            metadata: {
                licenseKey: 'AI-2024-7890-XYZ',
                expirationDate: '2024-03-15',
                status: 'Expired',
                gracePeriod: '7 days remaining',
                vendor: 'AI Vision Inc',
                renewalContact: 'licensing@aivision.com',
                temporaryFix: 'Emergency license requested'
            }
        },
        {
            id: '26',
            category: 'license',
            type: 'License Expiring',
            severity: 'high',
            title: 'VMS License Expiring Soon',
            description: 'Video management system license expires in 5 days',
            timestamp: '2 hours ago',
            component: 'VMS Core',
            location: 'Recording Server',
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            metadata: {
                licenseKey: 'VMS-2024-1234-ABCD',
                expirationDate: '2024-03-20',
                daysRemaining: 5,
                autoRenew: 'Disabled',
                cost: '$12,500/year',
                actionRequired: 'Process renewal PO'
            }
        },
        {
            id: '27',
            category: 'license',
            type: 'License Expiring',
            severity: 'medium',
            title: 'Camera License Limit Reached',
            description: 'Camera license count at 95% of capacity',
            timestamp: '1 day ago',
            component: 'Camera Licensing',
            location: 'VMS',
            currentValue: '237',
            totalValue: '250',
            percentage: 95,
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'medium',
            metadata: {
                licenseType: 'Per-camera license',
                licensedCameras: 250,
                activeCameras: 237,
                available: 13,
                newCamerasPending: '8 cameras awaiting license',
                recommendation: 'Purchase 20 additional licenses'
            }
        },
        {
            id: '28',
            category: 'license',
            type: 'License Expiring',
            severity: 'low',
            title: 'Maintenance Contract Expiring',
            description: 'Annual maintenance contract expires in 30 days',
            timestamp: '1 day ago',
            component: 'System Maintenance',
            location: 'All Systems',
            confidence: 100,
            acknowledged: true,
            resolved: false,
            impact: 'low',
            metadata: {
                contractNumber: 'MAINT-2023-789',
                expirationDate: '2024-04-15',
                vendor: 'TechSupport Pro',
                renewalAmount: '$8,400',
                includedServices: '24/7 support, updates'
            }
        },

        // Additional System Alerts
        {
            id: '29',
            category: 'system',
            type: 'Power Supply Failure',
            severity: 'critical',
            title: 'UPS Power Supply Failure',
            description: 'UPS unit in Server Room A has failed',
            timestamp: '4 minutes ago',
            component: 'UPS 01 - 20kVA',
            location: 'Server Room A',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            impact: 'critical',
            affectedSystems: ['Server Room A Equipment'],
            metadata: {
                model: 'APC Symmetra LX',
                batteryStatus: 'Failed',
                runtimeRemaining: 'On bypass - 0 minutes',
                load: '65%',
                criticalSystems: 'Recording servers, Network core',
                actionRequired: 'Immediate replacement'
            }
        },
        {
            id: '30',
            category: 'system',
            type: 'High Temperature',
            severity: 'high',
            title: 'Server Room Temperature High',
            description: 'Server Room A temperature above threshold',
            timestamp: '6 minutes ago',
            component: 'HVAC System',
            location: 'Server Room A',
            currentValue: '32°C',
            threshold: '25°C',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            metadata: {
                temperature: '32.5°C',
                humidity: '58%',
                hvacStatus: 'CRAC Unit 2 failed',
                backupCooling: 'Active - CRAC Unit 1 at 100%',
                timeToCritical: '45 minutes'
            }
        },
        {
            id: '31',
            category: 'system',
            type: 'Database Connection Failed',
            severity: 'critical',
            title: 'Recording Database Connection Lost',
            description: 'Cannot connect to recording database',
            timestamp: '2 minutes ago',
            component: 'PostgreSQL Database',
            location: 'Database Server',
            confidence: 100,
            acknowledged: false,
            resolved: false,
            impact: 'critical',
            metadata: {
                database: 'recordings_db',
                errorCode: 'CONNECTION_REFUSED',
                lastBackup: '1 hour ago',
                serviceStatus: 'Down',
                recoveryAction: 'Restarting database service'
            }
        },
        {
            id: '32',
            category: 'system',
            type: 'Service Unavailable',
            severity: 'high',
            title: 'Web Interface Unavailable',
            description: 'VMS web interface not responding',
            timestamp: '3 minutes ago',
            component: 'Web Server',
            location: 'Application Server',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            impact: 'high',
            metadata: {
                service: 'nginx',
                errorCode: 'HTTP 503',
                activeSessions: '124 before failure',
                restartAttempts: '2',
                fallback: 'Mobile app still functional'
            }
        }
    ]);

    const categories = [
        { value: 'all', label: 'All System Alerts', icon: Activity },
        { value: 'camera', label: 'Camera Issues', icon: Camera },
        { value: 'storage', label: 'Storage Alerts', icon: HardDrive },
        { value: 'network', label: 'Network Errors', icon: Network },
        { value: 'ai-engine', label: 'AI Engine', icon: Cpu },
        { value: 'license', label: 'License Management', icon: Key },
        { value: 'system', label: 'System Health', icon: Server }
    ];

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-100 text-red-800 border-red-200';
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'warning': return 'bg-purple-100 text-purple-800 border-purple-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'camera': return <Camera className="w-4 h-4" />;
            case 'storage': return <HardDrive className="w-4 h-4" />;
            case 'network': return <Network className="w-4 h-4" />;
            case 'ai-engine': return <Cpu className="w-4 h-4" />;
            case 'license': return <Key className="w-4 h-4" />;
            case 'system': return <Server className="w-4 h-4" />;
            default: return <Activity className="w-4 h-4" />;
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'critical': return 'bg-red-50 text-red-700';
            case 'high': return 'bg-orange-50 text-orange-700';
            case 'medium': return 'bg-yellow-50 text-yellow-700';
            case 'low': return 'bg-blue-50 text-blue-700';
            default: return 'bg-gray-50 text-gray-700';
        }
    };

    const getPercentageColor = (percentage: number) => {
        if (percentage >= 95) return 'text-red-600';
        if (percentage >= 85) return 'text-orange-600';
        if (percentage >= 70) return 'text-yellow-600';
        return 'text-green-600';
    };

    const getStatusIcon = (type: string) => {
        if (type.includes('Offline')) return <WifiOff className="w-4 h-4 text-red-500" />;
        if (type.includes('Tampered')) return <AlertOctagon className="w-4 h-4 text-orange-500" />;
        if (type.includes('Full') || type.includes('Low')) return <HardDriveIcon className="w-4 h-4 text-red-500" />;
        if (type.includes('Failed')) return <XCircle className="w-4 h-4 text-red-500" />;
        if (type.includes('Error')) return <AlertCircle className="w-4 h-4 text-orange-500" />;
        if (type.includes('Expiring')) return <Calendar className="w-4 h-4 text-yellow-500" />;
        return <Info className="w-4 h-4 text-blue-500" />;
    };

    const filteredAlerts = alerts.filter(alert => {
        if (selectedCategory !== 'all' && alert.category !== selectedCategory) return false;
        if (selectedSeverity !== 'all' && alert.severity !== selectedSeverity) return false;
        if (selectedImpact !== 'all' && alert.impact !== selectedImpact) return false;
        if (!showAcknowledged && alert.acknowledged) return false;
        if (!showResolved && alert.resolved) return false;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                alert.title.toLowerCase().includes(searchLower) ||
                alert.description.toLowerCase().includes(searchLower) ||
                alert.type.toLowerCase().includes(searchLower) ||
                alert.component.toLowerCase().includes(searchLower) ||
                alert.location?.toLowerCase().includes(searchLower) ||
                alert.metadata?.some(m => String(m).toLowerCase().includes(searchLower))
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
        const warning = alerts.filter(a => a.severity === 'warning' && !a.resolved).length;

        const byCategory = categories.filter(c => c.value !== 'all').map(cat => ({
            ...cat,
            count: alerts.filter(a => a.category === cat.value && !a.resolved).length
        }));

        const byImpact = {
            critical: alerts.filter(a => a.impact === 'critical' && !a.resolved).length,
            high: alerts.filter(a => a.impact === 'high' && !a.resolved).length,
            medium: alerts.filter(a => a.impact === 'medium' && !a.resolved).length,
            low: alerts.filter(a => a.impact === 'low' && !a.resolved).length
        };

        return { active, critical, high, medium, low, warning, byCategory, byImpact };
    };

    const stats = getStats();

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">System Alerts</h1>
                    <p className="text-sm text-gray-500 mt-1">Monitor system health, infrastructure, and service status</p>
                </div>
                <div className="flex gap-2">
                    <select
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                    >
                        <option value="1h">Last Hour</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700">
                        <Settings className="w-4 h-4" />
                        Configure Alerts
                    </button>
                </div>
            </div>

            {/* System Health Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">System Health</p>
                            <p className="text-2xl font-bold text-green-600">87%</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-full">
                            <Activity className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">13 systems affected</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Active Alerts</p>
                            <p className="text-2xl font-bold">{stats.active}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-full">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                    <p className="text-xs text-red-400 mt-2">{stats.critical} critical</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Affected Systems</p>
                            <p className="text-2xl font-bold text-orange-600">23</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-full">
                            <Server className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-xs text-orange-400 mt-2">15 with high impact</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Avg Resolution</p>
                            <p className="text-2xl font-bold text-blue-600">24m</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-full">
                            <Clock className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-xs text-blue-400 mt-2">↑ 5m from yesterday</p>
                </div>
            </div>

            {/* Category Stats */}
            <div className="grid grid-cols-7 gap-3">
                {stats.byCategory.map(cat => (
                    <div key={cat.value} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2">
                            <cat.icon className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600 truncate">{cat.label}</span>
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
                                placeholder="Search system alerts..."
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
                        <option value="warning">Warning</option>
                    </select>

                    <select
                        className="px-3 py-2 border border-gray-300 rounded-lg min-w-[150px]"
                        value={selectedImpact}
                        onChange={(e) => setSelectedImpact(e.target.value)}
                    >
                        <option value="all">All Impact Levels</option>
                        <option value="critical">Critical Impact</option>
                        <option value="high">High Impact</option>
                        <option value="medium">Medium Impact</option>
                        <option value="low">Low Impact</option>
                    </select>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="showAcknowledgedSystem"
                                checked={showAcknowledged}
                                onChange={(e) => setShowAcknowledged(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            <label htmlFor="showAcknowledgedSystem" className="text-sm text-gray-700 whitespace-nowrap">
                                Show Acknowledged
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="showResolvedSystem"
                                checked={showResolved}
                                onChange={(e) => setShowResolved(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            <label htmlFor="showResolvedSystem" className="text-sm text-gray-700 whitespace-nowrap">
                                Show Resolved
                            </label>
                        </div>
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
            {/* System Health Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Alert Distribution</h3>
                        <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <BarChart3 className="w-4 h-4" />
                            Analytics
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

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Impact Analysis</h3>
                        <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            Trends
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Critical Impact</span>
                            <span className="font-medium text-red-600">{stats.byImpact.critical}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">High Impact</span>
                            <span className="font-medium text-orange-600">{stats.byImpact.high}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Medium Impact</span>
                            <span className="font-medium text-yellow-600">{stats.byImpact.medium}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Low Impact</span>
                            <span className="font-medium text-blue-600">{stats.byImpact.low}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">System Status</h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm text-gray-600">Cameras Online</span>
                            </div>
                            <span className="font-medium">118/124</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm text-gray-600">Storage Health</span>
                            </div>
                            <span className="font-medium">87%</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <span className="text-sm text-gray-600">Network Stability</span>
                            </div>
                            <span className="font-medium">94%</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm text-gray-600">AI Services</span>
                            </div>
                            <span className="font-medium">7/8</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-3">
                    <button className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Restart Failed Services
                    </button>
                    <button className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 flex items-center gap-2">
                        <HardDrive className="w-4 h-4" />
                        Run Storage Cleanup
                    </button>
                    <button className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 flex items-center gap-2">
                        <Network className="w-4 h-4" />
                        Test Network Connectivity
                    </button>
                    <button className="px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Check License Status
                    </button>
                    <button className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        System Diagnostics
                    </button>
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
                                            alert.severity === 'low' ? 'border-l-blue-500' :
                                                'border-l-purple-500'
                                } border border-gray-200 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className={`p-2 rounded-lg ${alert.severity === 'critical' ? 'bg-red-50' :
                                            alert.severity === 'high' ? 'bg-orange-50' :
                                                alert.severity === 'medium' ? 'bg-yellow-50' :
                                                    alert.severity === 'low' ? 'bg-blue-50' :
                                                        'bg-purple-50'
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

                                {/* Component Info */}
                                <div className="flex items-center gap-2 mb-2 text-xs">
                                    <Server className="w-3 h-3 text-gray-400" />
                                    <span className="text-gray-600 truncate">{alert.component}</span>
                                </div>

                                {/* Storage Percentage Bar */}
                                {alert.percentage !== undefined && (
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-gray-500">Usage</span>
                                            <span className={`font-medium ${getPercentageColor(alert.percentage)}`}>
                                                {alert.percentage}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full">
                                            <div
                                                className={`h-full rounded-full ${alert.percentage >= 95 ? 'bg-red-600' :
                                                        alert.percentage >= 85 ? 'bg-orange-500' :
                                                            alert.percentage >= 70 ? 'bg-yellow-500' :
                                                                'bg-green-500'
                                                    }`}
                                                style={{ width: `${alert.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {/* Impact Badge */}
                                <div className="mb-3">
                                    <span className={`text-xs px-2 py-1 rounded-full ${getImpactColor(alert.impact)}`}>
                                        Impact: {alert.impact}
                                    </span>
                                </div>

                                {/* Location and Time */}
                                <div className="space-y-1 mb-3 text-xs text-gray-500">
                                    {alert.location && (
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate">{alert.location}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{alert.timestamp}</span>
                                    </div>
                                    {alert.duration && (
                                        <div className="flex items-center gap-1">
                                            <Activity className="w-3 h-3" />
                                            <span>Duration: {alert.duration}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Affected Systems */}
                                {alert.affectedSystems && (
                                    <div className="mb-3">
                                        <p className="text-xs text-gray-500 mb-1">Affected:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {alert.affectedSystems.slice(0, 2).map(system => (
                                                <span key={system} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                                    {system}
                                                </span>
                                            ))}
                                            {alert.affectedSystems.length > 2 && (
                                                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                                    +{alert.affectedSystems.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

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

                                {/* Metadata Indicator */}
                                {alert.metadata && (
                                    <div className="mt-2 text-right">
                                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                            {Object.keys(alert.metadata).length} details
                                        </span>
                                    </div>
                                )}
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
                                            alert.severity === 'low' ? 'border-l-blue-500' :
                                                'border-l-purple-500'
                                } border border-gray-200 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            <div className="p-4">
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={`p-3 rounded-lg ${alert.severity === 'critical' ? 'bg-red-50' :
                                            alert.severity === 'high' ? 'bg-orange-50' :
                                                alert.severity === 'medium' ? 'bg-yellow-50' :
                                                    alert.severity === 'low' ? 'bg-blue-50' :
                                                        'bg-purple-50'
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
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${getImpactColor(alert.impact)}`}>
                                                Impact: {alert.impact}
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
                                            {alert.resolved && (
                                                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                                                    RESOLVED
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-600 mb-2">{alert.description}</p>

                                        {/* Component and Location */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                                            <span className="flex items-center gap-1">
                                                <Server className="w-3 h-3" />
                                                {alert.component}
                                            </span>
                                            {alert.location && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {alert.location}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Storage/Usage Bar if applicable */}
                                        {alert.percentage !== undefined && (
                                            <div className="mb-2 max-w-md">
                                                <div className="flex items-center gap-2">
                                                    <HardDrive className="w-3 h-3 text-gray-400" />
                                                    <div className="flex-1 h-2 bg-gray-200 rounded-full">
                                                        <div
                                                            className={`h-full rounded-full ${alert.percentage >= 95 ? 'bg-red-600' :
                                                                    alert.percentage >= 85 ? 'bg-orange-500' :
                                                                        alert.percentage >= 70 ? 'bg-yellow-500' :
                                                                            'bg-green-500'
                                                                }`}
                                                            style={{ width: `${alert.percentage}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className={`text-xs font-medium ${getPercentageColor(alert.percentage)}`}>
                                                        {alert.currentValue}/{alert.totalValue}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Time and Duration */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {alert.timestamp}
                                            </span>
                                            {alert.duration && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Activity className="w-3 h-3" />
                                                        Duration: {alert.duration}
                                                    </span>
                                                </>
                                            )}
                                            {alert.estimatedResolution && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1 text-orange-600">
                                                        <Zap className="w-3 h-3" />
                                                        ETA: {alert.estimatedResolution}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Affected Systems */}
                                        {alert.affectedSystems && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                <span className="text-xs text-gray-500">Affected:</span>
                                                {alert.affectedSystems.map(system => (
                                                    <span key={system} className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                                                        {system}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Metadata Summary */}
                                        {alert.metadata && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {Object.entries(alert.metadata).slice(0, 3).map(([key, value]) => (
                                                    <span key={key} className="text-xs bg-gray-50 px-2 py-1 rounded-full text-gray-600">
                                                        {key}: {String(value)}
                                                    </span>
                                                ))}
                                                {Object.keys(alert.metadata).length > 3 && (
                                                    <span className="text-xs bg-gray-50 px-2 py-1 rounded-full text-gray-600">
                                                        +{Object.keys(alert.metadata).length - 3} more
                                                    </span>
                                                )}
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
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No System Alerts Found</h3>
                    <p className="text-gray-500">No alerts match your current filter criteria.</p>
                    <button
                        onClick={() => {
                            setSelectedCategory('all');
                            setSelectedSeverity('all');
                            setSelectedImpact('all');
                            setSearchTerm('');
                            setShowAcknowledged(true);
                            setShowResolved(false);
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

export default SystemAlerts;