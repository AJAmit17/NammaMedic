import AsyncStorage from '@react-native-async-storage/async-storage';
import { readRecords, getSdkStatus, SdkAvailabilityStatus } from 'react-native-health-connect';

export interface WidgetStepsData {
    steps: number;
    goal: number;
}

export interface WidgetHydrationData {
    intake: number; // in ml
    goal: number; // in ml
}

/**
 * Get today's storage key for water intake (same format as water.tsx)
 */
export function getTodayWaterKey(): string {
    const today = new Date();
    return `water_${today.getFullYear()}_${today.getMonth()}_${today.getDate()}`;
}

/**
 * Get current steps data for widget display
 */
export async function getStepsDataForWidget(): Promise<WidgetStepsData> {
    try {
        console.log('🚶 Getting steps data for widget...');
        
        // Check if Health Connect is available
        const status = await getSdkStatus();
        console.log('Health Connect status:', status);
        
        if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
            // Fall back to stored data or defaults (using same keys as main app)
            const storedSteps = await AsyncStorage.getItem('widgetSteps');
            const storedGoal = await AsyncStorage.getItem('stepsGoal'); // Use same key as app
            
            console.log('Steps fallback data - stored steps:', storedSteps, 'stored goal:', storedGoal);
            
            return {
                steps: storedSteps ? parseInt(storedSteps) : 0,
                goal: storedGoal ? parseInt(storedGoal) : 10000,
            };
        }

        // Get today's date range
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        // Read steps data from Health Connect
        const stepsData = await readRecords('Steps', {
            timeRangeFilter: {
                operator: 'between',
                startTime: today.toISOString(),
                endTime: endOfDay.toISOString(),
            },
        });

        // Calculate total steps
        let totalSteps = 0;
        if (stepsData && stepsData.records && stepsData.records.length > 0) {
            totalSteps = stepsData.records.reduce((sum: number, record: any) => {
                return sum + (record.count || 0);
            }, 0);
        }

        // Get goal from storage using the same key as the main app
        const storedGoal = await AsyncStorage.getItem('stepsGoal');
        const goal = storedGoal ? parseInt(storedGoal) : 10000;

        // Store current steps for fallback
        await AsyncStorage.setItem('widgetSteps', totalSteps.toString());

        console.log('Steps data from Health Connect - steps:', totalSteps, 'goal:', goal);

        return {
            steps: totalSteps,
            goal: goal,
        };
    } catch (error) {
        console.error('Error getting steps data for widget:', error);
        
        // Fall back to stored data or defaults
        const storedSteps = await AsyncStorage.getItem('widgetSteps');
        const storedGoal = await AsyncStorage.getItem('stepsGoal'); // Use same key as app
        
        return {
            steps: storedSteps ? parseInt(storedSteps) : 0,
            goal: storedGoal ? parseInt(storedGoal) : 10000,
        };
    }
}

/**
 * Get current hydration data for widget display
 */
export async function getHydrationDataForWidget(): Promise<WidgetHydrationData> {
    try {
        console.log('💧 Getting hydration data for widget...');
        
        // Get today's water intake key (same format as water.tsx)
        const todayKey = getTodayWaterKey();
        console.log('Using water key:', todayKey);
        
        // Check if Health Connect is available
        const status = await getSdkStatus();
        console.log('Health Connect status:', status);
        
        if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
            // Fall back to stored data from the main app using the correct keys
            const storedIntake = await AsyncStorage.getItem(todayKey); // Use today's key
            const storedGoal = await AsyncStorage.getItem('water_daily_goal'); // Use same key as app
            
            console.log('Hydration fallback data - stored intake:', storedIntake, 'stored goal:', storedGoal);
            
            return {
                intake: storedIntake ? parseInt(storedIntake) : 0,
                goal: storedGoal ? parseInt(storedGoal) : 2500,
            };
        }

        // Get today's date range
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        // Read hydration data from Health Connect
        const hydrationData = await readRecords('Hydration', {
            timeRangeFilter: {
                operator: 'between',
                startTime: today.toISOString(),
                endTime: endOfDay.toISOString(),
            },
        });

        // Calculate total hydration in ML
        let totalHydrationMl = 0;
        if (hydrationData && hydrationData.records && hydrationData.records.length > 0) {
            const totalHydrationLiters = hydrationData.records.reduce(
                (sum: number, record: any) => sum + (record.volume?.inLiters || 0),
                0
            );
            totalHydrationMl = Math.round(totalHydrationLiters * 1000);
        }

        // If no Health Connect data, try to get from AsyncStorage (app data)
        if (totalHydrationMl === 0) {
            const storedIntake = await AsyncStorage.getItem(todayKey);
            totalHydrationMl = storedIntake ? parseInt(storedIntake) : 0;
        }

        // Get goal from storage using the same key as the main app
        const storedGoal = await AsyncStorage.getItem('water_daily_goal');
        const goal = storedGoal ? parseInt(storedGoal) : 2500;

        console.log('Hydration data - intake:', totalHydrationMl, 'goal:', goal);

        return {
            intake: totalHydrationMl,
            goal: goal,
        };
    } catch (error) {
        console.error('Error getting hydration data for widget:', error);
        
        // Fall back to stored data from the main app using the correct keys
        const todayKey = getTodayWaterKey();
        const storedIntake = await AsyncStorage.getItem(todayKey);
        const storedGoal = await AsyncStorage.getItem('water_daily_goal');
        
        return {
            intake: storedIntake ? parseInt(storedIntake) : 0,
            goal: storedGoal ? parseInt(storedGoal) : 2500,
        };
    }
}

/**
 * Update widget data in storage when app data changes
 */
export async function updateWidgetStepsData(steps: number): Promise<void> {
    try {
        await AsyncStorage.setItem('widgetSteps', steps.toString());
    } catch (error) {
        console.error('Error updating widget steps data:', error);
    }
}

/**
 * Update widget hydration data in storage when app data changes
 */
export async function updateWidgetHydrationData(intake: number): Promise<void> {
    try {
        // Update using the same key format as the main app
        const todayKey = getTodayWaterKey();
        await AsyncStorage.setItem(todayKey, intake.toString());
    } catch (error) {
        console.error('Error updating widget hydration data:', error);
    }
}