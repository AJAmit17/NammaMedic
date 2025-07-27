export interface HealthData {
    steps: number;
    heartRate: number;
    distance: number;
    weight: number;
    height: number;
    bloodPressure: { systolic: number; diastolic: number } | null;
    bodyTemperature: number;
    hydration: number;
    timestamp: string;
}

export interface WeeklyHealthData {
    steps: DailyHealthMetric[];
    heartRate: DailyHealthMetric[];
    water: DailyHealthMetric[];
    temperature: DailyHealthMetric[];
}

export interface DailyHealthMetric {
    date: string;
    value: number;
    unit: string;
}

export interface HealthPermissionStatus {
    granted: boolean;
    permissions: string[];
}

export interface HealthDataRange {
    startDate: Date;
    endDate: Date;
}

export interface HealthMetrics {
    steps: number;
    flights: number;
    distance: number;
    heartRate: number;
    bodyTemperature: number;
    hydration: number;
}
