import { HealthData, HealthPermissionStatus, HealthDataRange, WeeklyHealthData } from './types';

export interface IHealthProvider {
    // Initialization
    initialize(): Promise<boolean>;

    // Permission management
    requestPermissions(): Promise<HealthPermissionStatus>;
    checkPermissions(): Promise<HealthPermissionStatus>;

    // Data reading
    readDailyData(date: Date): Promise<HealthData>;
    readWeeklyData(range: HealthDataRange): Promise<WeeklyHealthData>;

    // Data writing
    writeHealthData(data: Partial<HealthData>): Promise<boolean>;

    // Utility methods
    isAvailable(): Promise<boolean>;
    openSettings(): Promise<void>;
}
