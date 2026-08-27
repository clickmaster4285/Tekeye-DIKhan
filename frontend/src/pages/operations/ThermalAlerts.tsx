import React, { useState } from 'react';
import {
    Thermometer,
    AlertTriangle,
    Camera,
    Flame,
    Gauge,
    Activity,
    Filter,
    Download,
    Eye,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    Zap,
    TrendingUp,
    TrendingDown,
    Droplets,
    Wind,
    Bell,
    Search,
    ChevronDown,
    Calendar,
    RefreshCw,
    BarChart3,
    LineChart,
    AlertCircle
} from 'lucide-react';

interface ThermalAlert {
    id: string;
    category: 'temperature' | 'fever' | 'fire' | 'equipment' | 'gas';
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    timestamp: string;
    camera: string;
    zone: string;
    temperature?: number;
    threshold?: number;
    unit: '°C' | '°F' | 'ppm' | '%';
    confidence: number;
    acknowledged: boolean;
    resolved: boolean;
    trend?: 'rising' | 'falling' | 'stable';
    metadata?: Record<string, any>;
}

const ThermalAlerts: React.FC = () => {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showAcknowledged, setShowAcknowledged] = useState<boolean>(true);
    const [timeRange, setTimeRange] = useState<string>('24h');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Comprehensive thermal alerts dummy data
    const [alerts, setAlerts] = useState<ThermalAlert[]>([
        // HIGH TEMPERATURE ALERTS
        {
            id: '1',
            category: 'temperature',
            type: 'High Temperature',
            severity: 'high',
            title: 'Critical Temperature - Server Room',
            description: 'Server rack A-7 temperature exceeds safe operating range',
            timestamp: '2 minutes ago',
            camera: 'Thermal Camera 03 - Server Room',
            zone: 'Data Center - Zone A',
            temperature: 42.5,
            threshold: 35.0,
            unit: '°C',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                rackId: 'RACK-A7',
                equipment: 'Dell PowerEdge Servers (8 units)',
                humidity: '45%',
                coolingStatus: 'CRAC Unit 3 at 100% capacity',
                recommendation: 'Immediate inspection required'
            }
        },
        {
            id: '2',
            category: 'temperature',
            type: 'High Temperature',
            severity: 'medium',
            title: 'Elevated Temperature - Electrical Room',
            description: 'Electrical panel temperature above normal range',
            timestamp: '5 minutes ago',
            camera: 'Thermal Camera 07 - Electrical',
            zone: 'Utility Room B',
            temperature: 58.2,
            threshold: 50.0,
            unit: '°C',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                panelId: 'PANEL-MAIN-B',
                load: '78%',
                ambientTemp: '28°C',
                lastMaintenance: '2024-02-15'
            }
        },
        {
            id: '3',
            category: 'temperature',
            type: 'High Temperature',
            severity: 'critical',
            title: 'Critical - Battery Room Overheat',
            description: 'UPS battery bank temperature critical - risk of thermal runaway',
            timestamp: '1 minute ago',
            camera: 'Thermal Camera 12 - Battery Room',
            zone: 'Power Room',
            temperature: 48.7,
            threshold: 35.0,
            unit: '°C',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                batteryType: 'VRLA - 48V Bank',
                voltage: '52.3V',
                chargeRate: 'High',
                riskLevel: 'Critical - Possible thermal runaway'
            }
        },

        // LOW TEMPERATURE ALERTS
        {
            id: '4',
            category: 'temperature',
            type: 'Low Temperature',
            severity: 'high',
            title: 'Low Temperature - Cold Storage',
            description: 'Freezer temperature below minimum threshold',
            timestamp: '3 minutes ago',
            camera: 'Thermal Camera 15 - Cold Storage',
            zone: 'Warehouse - Frozen Foods',
            temperature: -28.5,
            threshold: -22.0,
            unit: '°C',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            trend: 'falling',
            metadata: {
                storageType: 'Frozen Foods (-22°C target)',
                productValue: '$125,000',
                timeBelowThreshold: '8 minutes',
                compressorStatus: 'Running continuously'
            }
        },
        {
            id: '5',
            category: 'temperature',
            type: 'Low Temperature',
            severity: 'medium',
            title: 'Low Temperature - Server Room',
            description: 'Temperature dropping rapidly in server room',
            timestamp: '7 minutes ago',
            camera: 'Thermal Camera 04 - Server Room',
            zone: 'Data Center - Zone B',
            temperature: 16.2,
            threshold: 20.0,
            unit: '°C',
            confidence: 96,
            acknowledged: true,
            resolved: false,
            trend: 'falling',
            metadata: {
                hvacStatus: 'Cooling at 100%',
                outsideTemp: '-5°C',
                humidity: '32%',
                risk: 'Potential condensation'
            }
        },
        {
            id: '6',
            category: 'temperature',
            type: 'Low Temperature',
            severity: 'low',
            title: 'Low Temperature - Office Area',
            description: 'Temperature below comfort level in north wing',
            timestamp: '15 minutes ago',
            camera: 'Thermal Camera 21 - Office',
            zone: 'Admin Building - North Wing',
            temperature: 18.3,
            threshold: 21.0,
            unit: '°C',
            confidence: 94,
            acknowledged: true,
            resolved: true,
            trend: 'stable',
            metadata: {
                zone: 'Open office',
                occupancy: '12 people',
                hvacZone: 'HVAC-Z4',
                complaintCount: '3'
            }
        },

        // FEVER DETECTED ALERTS
        {
            id: '7',
            category: 'fever',
            type: 'Fever Detected',
            severity: 'high',
            title: 'Elevated Temperature - Entry Screening',
            description: 'Individual detected with fever at main entrance',
            timestamp: '30 seconds ago',
            camera: 'Thermal Camera 01 - Main Entrance',
            zone: 'Security Checkpoint A',
            temperature: 38.4,
            threshold: 37.5,
            unit: '°C',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                personId: 'TEMP-2024-0892',
                secondaryScan: 'Pending',
                maskWorn: 'Yes',
                action: 'Direct to medical screening'
            }
        },
        {
            id: '8',
            category: 'fever',
            type: 'Fever Detected',
            severity: 'high',
            title: 'Multiple Fever Detections - Employee Entrance',
            description: 'Two individuals with elevated temperature detected',
            timestamp: '2 minutes ago',
            camera: 'Thermal Camera 02 - Employee Entrance',
            zone: 'Security Checkpoint B',
            temperature: 38.1,
            threshold: 37.5,
            unit: '°C',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            metadata: {
                individuals: '2 persons',
                temperatures: '38.1°C, 37.9°C',
                employeeIds: 'EMP-1234, EMP-5678',
                department: 'Operations, Finance'
            }
        },
        {
            id: '9',
            category: 'fever',
            type: 'Fever Detected',
            severity: 'medium',
            title: 'Borderline Temperature - Visitor',
            description: 'Visitor with borderline temperature reading',
            timestamp: '5 minutes ago',
            camera: 'Thermal Camera 01 - Main Entrance',
            zone: 'Security Checkpoint A',
            temperature: 37.6,
            threshold: 37.5,
            unit: '°C',
            confidence: 92,
            acknowledged: true,
            resolved: false,
            metadata: {
                visitorId: 'VIS-7890',
                company: 'Tech Solutions Inc',
                retestRecommended: 'Yes',
                recentActivity: 'Walking briskly'
            }
        },

        // FIRE DETECTED ALERTS (Thermal)
        {
            id: '10',
            category: 'fire',
            type: 'Fire Detected',
            severity: 'critical',
            title: 'FIRE DETECTED - Warehouse',
            description: 'Thermal signature indicates fire in storage area',
            timestamp: '45 seconds ago',
            camera: 'Thermal Camera 31 - Warehouse',
            zone: 'Storage Zone C - Aisle 12',
            temperature: 342.8,
            threshold: 80.0,
            unit: '°C',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                fireSize: 'Approx 3 sq meters',
                materials: 'Cardboard, Pallets, Packaging',
                sprinklerStatus: 'Activated',
                nearbyHazards: 'Aerosol cans'
            }
        },
        {
            id: '11',
            category: 'fire',
            type: 'Fire Detected',
            severity: 'critical',
            title: 'Electrical Fire - Server Room',
            description: 'Thermal hotspot detected in server rack - possible electrical fire',
            timestamp: '1 minute ago',
            camera: 'Thermal Camera 05 - Server Room',
            zone: 'Data Center - Rack C-12',
            temperature: 187.3,
            threshold: 70.0,
            unit: '°C',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                source: 'Power supply unit',
                affectedEquipment: 'Network switch stack',
                fireSuppression: 'FM-200 released',
                criticality: 'Core network equipment'
            }
        },
        {
            id: '12',
            category: 'fire',
            type: 'Fire Detected',
            severity: 'critical',
            title: 'Vehicle Fire - Parking Lot',
            description: 'Thermal signature indicates vehicle fire in parking structure',
            timestamp: '2 minutes ago',
            camera: 'Thermal Camera 18 - Parking',
            zone: 'Parking Structure - Level 2',
            temperature: 412.5,
            threshold: 100.0,
            unit: '°C',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                vehicleType: 'SUV - Ford Explorer',
                licensePlate: 'ABC-1234',
                nearbyVehicles: '8 vehicles within 10m',
                evacuationStatus: 'Level 2 being evacuated'
            }
        },

        // EQUIPMENT OVERHEATING ALERTS
        {
            id: '13',
            category: 'equipment',
            type: 'Equipment Overheating',
            severity: 'critical',
            title: 'Generator Overheating - Emergency Power',
            description: 'Backup generator temperature critical - possible failure',
            timestamp: '30 seconds ago',
            camera: 'Thermal Camera 09 - Generator Room',
            zone: 'Utility - Backup Power',
            temperature: 118.5,
            threshold: 95.0,
            unit: '°C',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                generatorId: 'GEN-02',
                runtime: '24 hours continuous',
                load: '85%',
                coolantLevel: 'Low',
                oilPressure: 'Dropping'
            }
        },
        {
            id: '14',
            category: 'equipment',
            type: 'Equipment Overheating',
            severity: 'high',
            title: 'Motor Overheat - HVAC Unit 3',
            description: 'HVAC blower motor temperature exceeding limits',
            timestamp: '3 minutes ago',
            camera: 'Thermal Camera 14 - Mechanical Room',
            zone: 'HVAC Systems',
            temperature: 87.3,
            threshold: 75.0,
            unit: '°C',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                equipmentId: 'AHU-03',
                motorType: '15kW induction motor',
                bearingTemp: '62°C',
                vibration: 'Elevated',
                lastMaintenance: '2024-02-28'
            }
        },
        {
            id: '15',
            category: 'equipment',
            type: 'Equipment Overheating',
            severity: 'high',
            title: 'Transformer Overheat - Substation',
            description: 'Main power transformer temperature above threshold',
            timestamp: '4 minutes ago',
            camera: 'Thermal Camera 22 - Electrical Substation',
            zone: 'Power Distribution',
            temperature: 92.8,
            threshold: 85.0,
            unit: '°C',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                transformerId: 'TX-01 - 2.5MVA',
                load: '92%',
                oilTemp: '78°C',
                coolingFans: 'Running at 100%'
            }
        },
        {
            id: '16',
            category: 'equipment',
            type: 'Equipment Overheating',
            severity: 'medium',
            title: 'Conveyor Motor Overheat',
            description: 'Main conveyor drive motor temperature elevated',
            timestamp: '8 minutes ago',
            camera: 'Thermal Camera 27 - Warehouse',
            zone: 'Shipping Department',
            temperature: 68.4,
            threshold: 60.0,
            unit: '°C',
            confidence: 96,
            acknowledged: true,
            resolved: false,
            trend: 'stable',
            metadata: {
                motorId: 'CONV-01-MAIN',
                runtime: '16 hours',
                beltSpeed: '2.5 m/s',
                materialLoad: 'Heavy'
            }
        },

        // TEMPERATURE SPIKE ALERTS
        {
            id: '17',
            category: 'temperature',
            type: 'Temperature Spike',
            severity: 'high',
            title: 'Rapid Temperature Spike - Cold Storage',
            description: 'Temperature increased 8°C in 2 minutes - Door可能 open',
            timestamp: '2 minutes ago',
            camera: 'Thermal Camera 16 - Cold Storage',
            zone: 'Cold Storage - Zone B',
            temperature: -12.5,
            threshold: -22.0,
            unit: '°C',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                previousTemp: '-20.5°C',
                rateOfChange: '+4°C per minute',
                doorStatus: 'Unknown',
                inventory: 'Vaccines, Biological samples',
                action: 'Immediate inspection required'
            }
        },
        {
            id: '18',
            category: 'temperature',
            type: 'Temperature Spike',
            severity: 'critical',
            title: 'Critical Spike - Laboratory Freezer',
            description: 'Ultra-low freezer temperature rising rapidly',
            timestamp: '1 minute ago',
            camera: 'Thermal Camera 33 - Laboratory',
            zone: 'Research Lab - Cryo Storage',
            temperature: -48.3,
            threshold: -80.0,
            unit: '°C',
            confidence: 99,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                freezerId: 'CRYO-07',
                samples: '1500+ biological samples',
                studyValue: '$2.5M research value',
                backupStatus: 'LN2 backup activated',
                timeToCritical: '12 minutes'
            }
        },
        {
            id: '19',
            category: 'temperature',
            type: 'Temperature Spike',
            severity: 'medium',
            title: 'Temperature Spike - Data Center',
            description: 'Sudden temperature increase in hot aisle',
            timestamp: '5 minutes ago',
            camera: 'Thermal Camera 06 - Data Center',
            zone: 'Server Row D',
            temperature: 29.8,
            threshold: 25.0,
            unit: '°C',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                previousTemp: '24.2°C',
                affectedRacks: 'D1-D8',
                coolingStatus: 'CRAC Unit 2 failed',
                serversAtRisk: '24'
            }
        },

        // TEMPERATURE DROP ALERTS
        {
            id: '20',
            category: 'temperature',
            type: 'Temperature Drop',
            severity: 'high',
            title: 'Rapid Temperature Drop - Incubator',
            description: 'Laboratory incubator temperature dropping rapidly',
            timestamp: '3 minutes ago',
            camera: 'Thermal Camera 34 - Laboratory',
            zone: 'Research Lab - Cell Culture',
            temperature: 32.1,
            threshold: 37.0,
            unit: '°C',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            trend: 'falling',
            metadata: {
                incubatorId: 'INC-04',
                cultures: 'Cell lines, Primary cultures',
                experimentId: 'EXP-2024-089',
                doorSwitch: 'Closed',
                heaterStatus: 'Failed'
            }
        },
        {
            id: '21',
            category: 'temperature',
            type: 'Temperature Drop',
            severity: 'medium',
            title: 'Temperature Drop - Greenhouse',
            description: 'Night temperature dropping below safe range for tropical plants',
            timestamp: '10 minutes ago',
            camera: 'Thermal Camera 41 - Greenhouse',
            zone: 'Botanical Garden - Tropical Zone',
            temperature: 15.3,
            threshold: 18.0,
            unit: '°C',
            confidence: 95,
            acknowledged: true,
            resolved: false,
            trend: 'falling',
            metadata: {
                plantTypes: 'Orchids, Tropical ferns',
                value: '$45,000',
                heatingStatus: 'Heaters at 80%',
                outsideTemp: '4°C'
            }
        },
        {
            id: '22',
            category: 'temperature',
            type: 'Temperature Drop',
            severity: 'low',
            title: 'Temperature Drop - Office Area',
            description: 'Gradual temperature decrease in west wing',
            timestamp: '25 minutes ago',
            camera: 'Thermal Camera 23 - Office',
            zone: 'Admin - West Wing',
            temperature: 19.2,
            threshold: 21.0,
            unit: '°C',
            confidence: 92,
            acknowledged: true,
            resolved: true,
            trend: 'stable',
            metadata: {
                hvacIssue: 'Damper stuck open',
                repairStatus: 'Maintenance dispatched'
            }
        },

        // GAS LEAK ALERTS (Thermal imaging can detect某些气体)
        {
            id: '23',
            category: 'gas',
            type: 'Gas Leak Detected',
            severity: 'critical',
            title: 'Refrigerant Gas Leak - Cold Storage',
            description: 'Thermal signature indicates refrigerant leak in cooling system',
            timestamp: '30 seconds ago',
            camera: 'Thermal Camera 17 - Mechanical Room',
            zone: 'Cold Storage - Refrigeration Unit',
            temperature: -35.2,
            unit: '°C',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            metadata: {
                gasType: 'R-404A Refrigerant',
                leakLocation: 'Compressor discharge line',
                pressure: 'Dropping rapidly',
                environmentalRisk: 'High GWP gas',
                actionRequired: 'Evacuate area, contain leak'
            }
        },
        {
            id: '24',
            category: 'gas',
            type: 'Gas Leak Detected',
            severity: 'critical',
            title: 'Natural Gas Leak - Boiler Room',
            description: 'Possible natural gas leak detected near boilers',
            timestamp: '1 minute ago',
            camera: 'Thermal Camera 19 - Boiler Room',
            zone: 'Utility - Heating Plant',
            temperature: 22.8,
            unit: '°C',
            confidence: 96,
            acknowledged: false,
            resolved: false,
            metadata: {
                gasType: 'Natural gas (Methane)',
                concentration: '15% LEL',
                source: 'Valve train - Boiler 2',
                ventilation: 'Explosion-proof fans activated',
                action: 'Evacuate, call gas company'
            }
        },
        {
            id: '25',
            category: 'gas',
            type: 'Gas Leak Detected',
            severity: 'high',
            title: 'Ammonia Leak - Ice Rink',
            description: 'Thermal anomaly indicates possible ammonia refrigerant leak',
            timestamp: '3 minutes ago',
            camera: 'Thermal Camera 44 - Ice Rink',
            zone: 'Recreation - Mechanical Room',
            temperature: -12.5,
            unit: '°C',
            confidence: 95,
            acknowledged: false,
            resolved: false,
            metadata: {
                gasType: 'Anhydrous Ammonia',
                odorDetected: 'Yes - Pungent smell',
                areaStatus: 'Evacuating public',
                ventilation: 'Emergency purge active',
                hazmatResponse: 'En route'
            }
        },
        {
            id: '26',
            category: 'gas',
            type: 'Gas Leak Detected',
            severity: 'high',
            title: 'CO2 Leak - Fire Suppression',
            description: 'CO2 release detected in server room',
            timestamp: '4 minutes ago',
            camera: 'Thermal Camera 08 - Server Room',
            zone: 'Data Center',
            temperature: 19.8,
            unit: '°C',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            metadata: {
                gasType: 'CO2 - Fire suppression',
                concentration: '34%',
                preAlert: 'No fire detected',
                cause: 'False discharge',
                action: 'Evacuate, ventilate'
            }
        },
        {
            id: '27',
            category: 'gas',
            type: 'Gas Leak Detected',
            severity: 'medium',
            title: 'Small Refrigerant Leak - HVAC',
            description: 'Minor refrigerant leak detected in AC system',
            timestamp: '12 minutes ago',
            camera: 'Thermal Camera 25 - Roof',
            zone: 'HVAC Unit 7',
            temperature: 8.3,
            unit: '°C',
            confidence: 92,
            acknowledged: true,
            resolved: false,
            metadata: {
                gasType: 'R-410A',
                leakRate: 'Slow',
                systemPressure: 'Dropping slowly',
                repairPriority: 'Medium'
            }
        },

        // Additional Thermal Alerts
        {
            id: '28',
            category: 'temperature',
            type: 'High Temperature',
            severity: 'medium',
            title: 'High Temperature - Kitchen',
            description: 'Kitchen cooking equipment temperature elevated',
            timestamp: '6 minutes ago',
            camera: 'Thermal Camera 37 - Kitchen',
            zone: 'Cafeteria',
            temperature: 68.5,
            threshold: 50.0,
            unit: '°C',
            confidence: 96,
            acknowledged: false,
            resolved: false,
            trend: 'stable',
            metadata: {
                equipment: 'Deep fryer',
                ventilation: 'Operating',
                fireSuppression: 'Standby',
                greaseLevel: 'Normal'
            }
        },
        {
            id: '29',
            category: 'equipment',
            type: 'Equipment Overheating',
            severity: 'high',
            title: 'UPS System Overheating',
            description: 'UPS battery temperature high - potential failure risk',
            timestamp: '3 minutes ago',
            camera: 'Thermal Camera 11 - Electrical Room',
            zone: 'UPS Room',
            temperature: 41.2,
            threshold: 35.0,
            unit: '°C',
            confidence: 98,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                upsId: 'UPS-MAIN-01',
                load: '68%',
                batteryAge: '3 years',
                runtimeRemaining: '24 minutes at full load',
                alarmStatus: 'High temp warning'
            }
        },
        {
            id: '30',
            category: 'fire',
            type: 'Fire Detected',
            severity: 'critical',
            title: 'Smoldering Fire - Trash Compactor',
            description: 'Thermal hotspot detected in trash compactor - possible smoldering fire',
            timestamp: '2 minutes ago',
            camera: 'Thermal Camera 39 - Loading Dock',
            zone: 'Waste Management Area',
            temperature: 156.7,
            threshold: 60.0,
            unit: '°C',
            confidence: 97,
            acknowledged: false,
            resolved: false,
            trend: 'rising',
            metadata: {
                material: 'Mixed waste, cardboard',
                oxygenLevel: '15%',
                suppressionStatus: 'Water spray activated',
                spreadRisk: 'Low - contained'
            }
        }
    ]);

    const categories = [
        { value: 'all', label: 'All Thermal Alerts', icon: Thermometer },
        { value: 'temperature', label: 'Temperature', icon: Gauge },
        { value: 'fever', label: 'Fever Detection', icon: Activity },
        { value: 'fire', label: 'Fire Detection', icon: Flame },
        { value: 'equipment', label: 'Equipment Overheating', icon: Zap },
        { value: 'gas', label: 'Gas Leaks', icon: Wind }
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
            case 'temperature': return <Gauge className="w-4 h-4" />;
            case 'fever': return <Activity className="w-4 h-4" />;
            case 'fire': return <Flame className="w-4 h-4" />;
            case 'equipment': return <Zap className="w-4 h-4" />;
            case 'gas': return <Wind className="w-4 h-4" />;
            default: return <Thermometer className="w-4 h-4" />;
        }
    };

    const getTrendIcon = (trend?: string) => {
        switch (trend) {
            case 'rising': return <TrendingUp className="w-3 h-3 text-red-500" />;
            case 'falling': return <TrendingDown className="w-3 h-3 text-blue-500" />;
            default: return null;
        }
    };

    const getTemperatureColor = (temp: number, threshold?: number, type?: string) => {
        if (!threshold) return 'text-gray-600';
        if (type === 'fire') {
            if (temp > 200) return 'text-red-600 font-bold';
            if (temp > 100) return 'text-orange-600';
            return 'text-yellow-600';
        }
        if (temp > threshold * 1.2) return 'text-red-600 font-bold';
        if (temp > threshold) return 'text-orange-600';
        if (temp < threshold * 0.8) return 'text-blue-600';
        return 'text-green-600';
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
        const byCategory = categories.filter(c => c.value !== 'all').map(cat => ({
            ...cat,
            count: alerts.filter(a => a.category === cat.value && !a.resolved).length
        }));
        return { active, critical, high, medium, low, byCategory };
    };

    const stats = getStats();

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Thermal Alerts</h1>
                    <p className="text-sm text-gray-500 mt-1">Real-time thermal imaging and temperature monitoring system</p>
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
                        <Bell className="w-4 h-4" />
                        Configure Thresholds
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
                            <Flame className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                    <p className="text-xs text-red-400 mt-2">Immediate action required</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">High Temp</p>
                            <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-full">
                            <TrendingUp className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-xs text-orange-400 mt-2">Above threshold</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Fire Detected</p>
                            <p className="text-2xl font-bold text-yellow-600">
                                {alerts.filter(a => a.category === 'fire' && !a.resolved).length}
                            </p>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-full">
                            <Flame className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                    <p className="text-xs text-yellow-400 mt-2">Active fire alerts</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Gas Leaks</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {alerts.filter(a => a.category === 'gas' && !a.resolved).length}
                            </p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-full">
                            <Wind className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <p className="text-xs text-purple-400 mt-2">Active gas alerts</p>
                </div>
            </div>

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
                                placeholder="Search thermal alerts..."
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
                            id="showAcknowledgedThermal"
                            checked={showAcknowledged}
                            onChange={(e) => setShowAcknowledged(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="showAcknowledgedThermal" className="text-sm text-gray-700">
                            Show Acknowledged
                        </label>
                    </div>

                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                        <button
                            className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                            onClick={() => setViewMode('grid')}
                        >
                            Grid
                        </button>
                        <button
                            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                            onClick={() => setViewMode('list')}
                        >
                            List
                        </button>
                    </div>

                    <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50">
                        <Filter className="w-4 h-4" />
                        More Filters
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Temperature Scale Legend */}
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700">Temperature Legend:</span>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded"></div>
                            <span className="text-xs text-gray-600">Below threshold</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded"></div>
                            <span className="text-xs text-gray-600">Normal range</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-500 rounded"></div>
                            <span className="text-xs text-gray-600">Above threshold</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded"></div>
                            <span className="text-xs text-gray-600">Critical</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700">Units:</span>
                        <button className="text-sm text-blue-600 font-medium">°C</button>
                        <span className="text-gray-300">|</span>
                        <button className="text-sm text-gray-500">°F</button>
                    </div>
                </div>
            </div>
            {/* Thermal Analytics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Temperature Trends</h3>
                        <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <LineChart className="w-4 h-4" />
                            View Details
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Average Temperature</span>
                            <span className="font-medium">23.4°C</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Peak Temperature (24h)</span>
                            <span className="font-medium text-red-600">412.5°C (Fire event)</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Lowest Temperature</span>
                            <span className="font-medium text-blue-600">-48.3°C</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Zones with Alerts</span>
                            <span className="font-medium">15 zones</span>
                        </div>
                    </div>
                </div>

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

                                {/* Temperature Display */}
                                {alert.temperature !== undefined && (
                                    <div className="bg-gray-50 p-3 rounded-lg mb-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500">Temperature:</span>
                                            <span className={`text-lg font-bold ${getTemperatureColor(alert.temperature, alert.threshold, alert.category)}`}>
                                                {alert.temperature}{alert.unit}
                                            </span>
                                        </div>
                                        {alert.threshold && (
                                            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                                                <span>Threshold:</span>
                                                <span>{alert.threshold}{alert.unit}</span>
                                            </div>
                                        )}
                                        {alert.trend && (
                                            <div className="flex items-center justify-between text-xs mt-1">
                                                <span className="text-gray-500">Trend:</span>
                                                <span className="flex items-center gap-1">
                                                    {getTrendIcon(alert.trend)}
                                                    <span className="capitalize">{alert.trend}</span>
                                                </span>
                                            </div>
                                        )}
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

                                        {/* Temperature Info */}
                                        {alert.temperature !== undefined && (
                                            <div className="flex items-center gap-4 mb-2 text-sm">
                                                <div className="flex items-center gap-1">
                                                    <Thermometer className="w-4 h-4 text-gray-400" />
                                                    <span className={`font-medium ${getTemperatureColor(alert.temperature, alert.threshold, alert.category)}`}>
                                                        {alert.temperature}{alert.unit}
                                                    </span>
                                                </div>
                                                {alert.threshold && (
                                                    <div className="flex items-center gap-1 text-gray-500">
                                                        <span>Threshold:</span>
                                                        <span>{alert.threshold}{alert.unit}</span>
                                                    </div>
                                                )}
                                                {alert.trend && (
                                                    <div className="flex items-center gap-1">
                                                        {getTrendIcon(alert.trend)}
                                                        <span className="text-xs capitalize text-gray-500">{alert.trend}</span>
                                                    </div>
                                                )}
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
                    <Thermometer className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Thermal Alerts Found</h3>
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

export default ThermalAlerts;