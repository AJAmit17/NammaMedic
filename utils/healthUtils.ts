import {
    requestPermission,
    getGrantedPermissions,
    DeviceType,
} from 'react-native-health-connect';
import * as Device from 'expo-device';

export interface HealthPermission {
    accessType: 'read' | 'write';
    recordType: string;
}

export const ALL_HEALTH_PERMISSIONS: HealthPermission[] = [
    // Steps
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'write', recordType: 'Steps' },

    // Exercise
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'write', recordType: 'ExerciseSession' },

    // Heart Rate
    { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'write', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'RestingHeartRate' },
    { accessType: 'write', recordType: 'RestingHeartRate' },

    // Distance and Movement
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'write', recordType: 'Distance' },
    { accessType: 'read', recordType: 'Speed' },
    { accessType: 'write', recordType: 'Speed' },
    { accessType: 'read', recordType: 'Power' },
    { accessType: 'write', recordType: 'Power' },

    // Body Measurements
    { accessType: 'read', recordType: 'Weight' },
    { accessType: 'write', recordType: 'Weight' },
    { accessType: 'read', recordType: 'Height' },
    { accessType: 'write', recordType: 'Height' },
    { accessType: 'read', recordType: 'BodyFat' },
    { accessType: 'write', recordType: 'BodyFat' },
    { accessType: 'read', recordType: 'LeanBodyMass' },
    { accessType: 'write', recordType: 'LeanBodyMass' },
    { accessType: 'read', recordType: 'BoneMass' },
    { accessType: 'write', recordType: 'BoneMass' },

    // Vital Signs
    { accessType: 'read', recordType: 'BloodPressure' },
    { accessType: 'write', recordType: 'BloodPressure' },
    { accessType: 'read', recordType: 'BodyTemperature' },
    { accessType: 'write', recordType: 'BodyTemperature' },
    { accessType: 'read', recordType: 'BasalBodyTemperature' },
    { accessType: 'write', recordType: 'BasalBodyTemperature' },
    { accessType: 'read', recordType: 'RespiratoryRate' },
    { accessType: 'write', recordType: 'RespiratoryRate' },

    // Blood and Lab Results
    { accessType: 'read', recordType: 'BloodGlucose' },
    { accessType: 'write', recordType: 'BloodGlucose' },

    // Nutrition and Hydration
    { accessType: 'read', recordType: 'Hydration' },
    { accessType: 'write', recordType: 'Hydration' },
    { accessType: 'read', recordType: 'Nutrition' },
    { accessType: 'write', recordType: 'Nutrition' },

    // Sleep
    { accessType: 'read', recordType: 'SleepSession' },
    { accessType: 'write', recordType: 'SleepSession' },

    // Metabolic
    { accessType: 'read', recordType: 'BasalMetabolicRate' },
    { accessType: 'write', recordType: 'BasalMetabolicRate' },
    { accessType: 'read', recordType: 'Vo2Max' },
    { accessType: 'write', recordType: 'Vo2Max' },

    // Women's Health
    { accessType: 'read', recordType: 'MenstruationFlow' },
    { accessType: 'write', recordType: 'MenstruationFlow' },
    { accessType: 'read', recordType: 'MenstruationPeriod' },
    { accessType: 'write', recordType: 'MenstruationPeriod' },
    { accessType: 'read', recordType: 'OvulationTest' },
    { accessType: 'write', recordType: 'OvulationTest' },
    { accessType: 'read', recordType: 'CervicalMucus' },
    { accessType: 'write', recordType: 'CervicalMucus' },
    { accessType: 'read', recordType: 'SexualActivity' },
    { accessType: 'write', recordType: 'SexualActivity' },

    // Additional Movement
    { accessType: 'read', recordType: 'FloorsClimbed' },
    { accessType: 'write', recordType: 'FloorsClimbed' },
    { accessType: 'read', recordType: 'ElevationGained' },
    { accessType: 'write', recordType: 'ElevationGained' },
    { accessType: 'read', recordType: 'WheelchairPushes' },
    { accessType: 'write', recordType: 'WheelchairPushes' },

    // Cycling specific
    { accessType: 'read', recordType: 'CyclingPedalingCadence' },
    { accessType: 'write', recordType: 'CyclingPedalingCadence' },
];

export const ESSENTIAL_PERMISSIONS: HealthPermission[] = [
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'write', recordType: 'Steps' },
    { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'write', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'write', recordType: 'Distance' },
    { accessType: 'read', recordType: 'Weight' },
    { accessType: 'write', recordType: 'Weight' },
    { accessType: 'read', recordType: 'Height' },
    { accessType: 'write', recordType: 'Height' },
    { accessType: 'read', recordType: 'BloodPressure' },
    { accessType: 'write', recordType: 'BloodPressure' },
    { accessType: 'read', recordType: 'BodyTemperature' },
    { accessType: 'write', recordType: 'BodyTemperature' },
    { accessType: 'read', recordType: 'Hydration' },
    { accessType: 'write', recordType: 'Hydration' },
    { accessType: 'read', recordType: 'SleepSession' },
    { accessType: 'write', recordType: 'SleepSession' },
];

export const requestEssentialPermissions = async (): Promise<any[]> => {
    try {
        const granted = await requestPermission(ESSENTIAL_PERMISSIONS as any);
        // console.log('Essential permissions requested:', granted);
        return granted;
    } catch (error) {
        console.error('Error requesting essential permissions:', error);
        throw error;
    }
};

export const requestAllPermissions = async (): Promise<any[]> => {
    try {
        const granted = await requestPermission(ALL_HEALTH_PERMISSIONS as any);
        // console.log('All permissions requested:', granted);
        return granted;
    } catch (error) {
        console.error('Error requesting all permissions:', error);
        throw error;
    }
};

export const checkPermissionStatus = async (): Promise<any[]> => {
    try {
        const granted = await getGrantedPermissions();
        // console.log('Current granted permissions:', granted);
        return granted;
    } catch (error) {
        console.error('Error checking permissions:', error);
        throw error;
    }
};

export const getDeviceMetadata = () => {
    return {
        manufacturer: Device.manufacturer || 'Unknown',
        model: Device.modelName || Device.deviceName || 'Unknown',
        type: DeviceType.TYPE_PHONE
    };
};

export const getDateRange = (days: number = 1) => {
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - days);

    return {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
    };
};

export const getTodayDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    return {
        startTime: today.toISOString(),
        endTime: endOfDay.toISOString(),
    };
};

export const formatHealthValue = (value: number, type: string): string => {
    if (value <= 0) return '--';

    switch (type) {
        case 'steps':
            return value.toLocaleString();
        case 'heartRate':
            return Math.round(value).toString();
        case 'distance':
            return (Math.round(value * 100) / 100).toString();
        case 'weight':
            return (Math.round(value * 10) / 10).toString();
        case 'height':
            return Math.round(value).toString();
        case 'bodyTemp':
            return (Math.round(value * 10) / 10).toString();
        case 'hydration':
            return Math.round(value).toString();
        case 'sleepHours':
            return (Math.round(value * 10) / 10).toString();
        default:
            return Math.round(value).toString();
    }
};
