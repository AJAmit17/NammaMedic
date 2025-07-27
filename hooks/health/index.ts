// Main health hook
export { useHealthData } from './useHealthData';

// Platform-specific providers
export { AndroidHealthProvider } from './AndroidHealthProvider';
export { IOSHealthProvider } from './IOSHealthProvider';

// Interfaces and types
export type { IHealthProvider } from './IHealthProvider';
export type {
    HealthData,
    WeeklyHealthData,
    DailyHealthMetric,
    HealthPermissionStatus,
    HealthDataRange,
    HealthMetrics
} from './types';

// Import types for utility functions
import { DailyHealthMetric } from './types';

// Utility functions for health data
export const getWeekRange = (weeksAgo: number = 0): { startDate: Date; endDate: Date } => {
    const today = new Date();
    const endDate = new Date(today.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000);
    const startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);

    // Set to start of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
};

export const formatHealthValue = (value: number, unit: string, decimals: number = 1): string => {
    if (value === 0) return `0 ${unit}`;

    if (value >= 1000 && unit === 'steps') {
        return `${(value / 1000).toFixed(decimals)}k ${unit}`;
    }

    if (value >= 1000 && unit === 'm') {
        return `${(value / 1000).toFixed(decimals)} km`;
    }

    return `${value.toFixed(decimals)} ${unit}`;
};

export const getHealthScoreColor = (value: number, max: number): string => {
    const percentage = (value / max) * 100;

    if (percentage >= 80) return '#4CAF50'; // Green
    if (percentage >= 60) return '#FF9800'; // Orange  
    if (percentage >= 40) return '#FFC107'; // Yellow
    return '#F44336'; // Red
};

export const calculateWeeklyAverage = (data: DailyHealthMetric[]): number => {
    if (data.length === 0) return 0;

    const sum = data.reduce((acc, day) => acc + day.value, 0);
    return Math.round(sum / data.length);
};

export const getWeeklyTrend = (data: DailyHealthMetric[]): 'up' | 'down' | 'stable' => {
    if (data.length < 2) return 'stable';

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstAvg = calculateWeeklyAverage(firstHalf);
    const secondAvg = calculateWeeklyAverage(secondHalf);

    const difference = secondAvg - firstAvg;
    const threshold = firstAvg * 0.1; // 10% change threshold

    if (Math.abs(difference) < threshold) return 'stable';
    return difference > 0 ? 'up' : 'down';
};
