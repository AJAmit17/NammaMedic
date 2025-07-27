import { Platform } from 'react-native';
import { initialize, requestPermission, readRecords, insertRecords, getSdkStatus, SdkAvailabilityStatus } from 'react-native-health-connect';
import { IHealthProvider } from './IHealthProvider';
import { HealthData, HealthPermissionStatus, HealthDataRange, WeeklyHealthData, DailyHealthMetric } from './types';

export class AndroidHealthProvider implements IHealthProvider {
    private isInitialized = false;

    async initialize(): Promise<boolean> {
        if (this.isInitialized) {
            console.log('Health Connect already initialized');
            return true;
        }

        try {
            console.log('Initializing Android Health Connect...');
            
            // First check if Health Connect is available
            const status = await getSdkStatus();
            console.log('Health Connect SDK status:', status);
            
            if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
                console.log('Health Connect SDK not available. Status:', status);
                return false;
            }

            // Initialize the client
            this.isInitialized = await initialize();
            console.log('Health Connect initialized successfully:', this.isInitialized);
            return this.isInitialized;
        } catch (error) {
            console.error('Error initializing Health Connect:', error);
            this.isInitialized = false;
            return false;
        }
    }

    async requestPermissions(): Promise<HealthPermissionStatus> {
        try {
            if (!await this.initialize()) {
                return { granted: false, permissions: [] };
            }

            const permissions = [
                { accessType: 'read' as const, recordType: 'Steps' as const },
                { accessType: 'read' as const, recordType: 'Distance' as const },
                { accessType: 'read' as const, recordType: 'FloorsClimbed' as const },
                { accessType: 'read' as const, recordType: 'HeartRate' as const },
                { accessType: 'read' as const, recordType: 'BodyTemperature' as const },
                { accessType: 'read' as const, recordType: 'Hydration' as const },
                { accessType: 'read' as const, recordType: 'Weight' as const },
                { accessType: 'read' as const, recordType: 'Height' as const },
                { accessType: 'read' as const, recordType: 'BloodPressure' as const },
                { accessType: 'write' as const, recordType: 'Steps' as const },
                { accessType: 'write' as const, recordType: 'HeartRate' as const },
                { accessType: 'write' as const, recordType: 'BodyTemperature' as const },
                { accessType: 'write' as const, recordType: 'Hydration' as const },
            ];

            await requestPermission(permissions);

            return {
                granted: true,
                permissions: permissions.map(p => `${p.accessType}:${p.recordType}`)
            };
        } catch (error) {
            console.error('Error requesting Android health permissions:', error);
            return { granted: false, permissions: [] };
        }
    }

    async checkPermissions(): Promise<HealthPermissionStatus> {
        try {
            // Try to initialize if not already done
            if (!await this.initialize()) {
                return { granted: false, permissions: [] };
            }

            const status = await getSdkStatus();
            return {
                granted: status === SdkAvailabilityStatus.SDK_AVAILABLE && this.isInitialized,
                permissions: []
            };
        } catch (error) {
            console.error('Error checking permissions:', error);
            return { granted: false, permissions: [] };
        }
    }

    async readDailyData(date: Date): Promise<HealthData> {
        // Ensure client is initialized before reading data
        if (!await this.initialize()) {
            console.log('Health Connect client could not be initialized');
            return this.getEmptyHealthData();
        }

        const timeRangeFilter = {
            operator: 'between' as const,
            startTime: new Date(date.setHours(0, 0, 0, 0)).toISOString(),
            endTime: new Date(date.setHours(23, 59, 59, 999)).toISOString(),
        };

        try {
            console.log('Reading health data for date:', date.toISOString().split('T')[0]);
            
            // Read steps
            const stepsRecords = await readRecords('Steps', { timeRangeFilter });
            const totalSteps = stepsRecords.records?.reduce((sum: number, record: any) => sum + record.count, 0) || 0;
            console.log('Steps records found:', stepsRecords.records?.length || 0, 'Total steps:', totalSteps);

            // Read distance
            const distanceRecords = await readRecords('Distance', { timeRangeFilter });
            const totalDistance = distanceRecords.records?.reduce((sum: number, record: any) => sum + record.distance.inMeters, 0) || 0;

            // Read heart rate
            const heartRateRecords = await readRecords('HeartRate', { timeRangeFilter });
            const averageHeartRate = heartRateRecords.records && heartRateRecords.records.length > 0
                ? heartRateRecords.records.reduce((sum: number, record: any) => sum + record.beatsPerMinute, 0) / heartRateRecords.records.length
                : 0;

            // Read body temperature
            const tempRecords = await readRecords('BodyTemperature', { timeRangeFilter });
            const averageTemp = tempRecords.records && tempRecords.records.length > 0
                ? tempRecords.records.reduce((sum: number, record: any) => sum + record.temperature.inCelsius, 0) / tempRecords.records.length
                : 0;

            // Read hydration
            const hydrationRecords = await readRecords('Hydration', { timeRangeFilter });
            const totalHydration = hydrationRecords.records?.reduce((sum: number, record: any) => sum + record.volume.inLiters, 0) || 0;

            // Read weight
            const weightRecords = await readRecords('Weight', { timeRangeFilter });
            const latestWeight = weightRecords.records && weightRecords.records.length > 0
                ? weightRecords.records[weightRecords.records.length - 1].weight.inKilograms
                : 0;

            // Read height
            const heightRecords = await readRecords('Height', { timeRangeFilter });
            const latestHeight = heightRecords.records && heightRecords.records.length > 0
                ? heightRecords.records[heightRecords.records.length - 1].height.inMeters
                : 0;

            // Read blood pressure
            const bpRecords = await readRecords('BloodPressure', { timeRangeFilter });
            const latestBP = bpRecords.records && bpRecords.records.length > 0
                ? {
                    systolic: bpRecords.records[bpRecords.records.length - 1].systolic.inMillimetersOfMercury,
                    diastolic: bpRecords.records[bpRecords.records.length - 1].diastolic.inMillimetersOfMercury
                }
                : null;

            return {
                steps: totalSteps,
                heartRate: Math.round(averageHeartRate),
                distance: totalDistance,
                weight: latestWeight,
                height: latestHeight,
                bloodPressure: latestBP,
                bodyTemperature: averageTemp,
                hydration: totalHydration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error reading Android health data:', error);
            return this.getEmptyHealthData();
        }
    }

    async readWeeklyData(range: HealthDataRange): Promise<WeeklyHealthData> {
        const weeklyData: WeeklyHealthData = {
            steps: [],
            heartRate: [],
            water: [],
            temperature: []
        };

        const currentDate = new Date(range.startDate);

        while (currentDate <= range.endDate) {
            const dailyData = await this.readDailyData(new Date(currentDate));
            const dateStr = currentDate.toISOString().split('T')[0];

            weeklyData.steps.push({
                date: dateStr,
                value: dailyData.steps,
                unit: 'steps'
            });

            weeklyData.heartRate.push({
                date: dateStr,
                value: dailyData.heartRate,
                unit: 'bpm'
            });

            weeklyData.water.push({
                date: dateStr,
                value: dailyData.hydration,
                unit: 'L'
            });

            weeklyData.temperature.push({
                date: dateStr,
                value: dailyData.bodyTemperature,
                unit: '°C'
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return weeklyData;
    }

    async writeHealthData(data: Partial<HealthData>): Promise<boolean> {
        // Ensure client is initialized before writing data
        if (!await this.initialize()) {
            console.log('Health Connect client could not be initialized for writing');
            return false;
        }

        try {
            const records: any[] = [];
            const now = new Date().toISOString();

            if (data.steps !== undefined) {
                records.push({
                    recordType: 'Steps' as const,
                    count: data.steps,
                    startTime: now,
                    endTime: now,
                });
            }

            if (data.heartRate !== undefined) {
                records.push({
                    recordType: 'HeartRate' as const,
                    beatsPerMinute: data.heartRate,
                    time: now,
                });
            }

            if (data.bodyTemperature !== undefined) {
                records.push({
                    recordType: 'BodyTemperature' as const,
                    temperature: { inCelsius: data.bodyTemperature },
                    time: now,
                });
            }

            if (data.hydration !== undefined) {
                records.push({
                    recordType: 'Hydration' as const,
                    volume: { inLiters: data.hydration },
                    startTime: now,
                    endTime: now,
                });
            }

            if (records.length > 0) {
                await insertRecords(records);
            }

            return true;
        } catch (error) {
            console.error('Error writing Android health data:', error);
            return false;
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const status = await getSdkStatus();
            return status === SdkAvailabilityStatus.SDK_AVAILABLE;
        } catch (error) {
            return false;
        }
    }

    async openSettings(): Promise<void> {
        // Implementation would depend on the health connect library
        console.log('Opening Android Health Connect settings');
    }

    private getEmptyHealthData(): HealthData {
        return {
            steps: 0,
            heartRate: 0,
            distance: 0,
            weight: 0,
            height: 0,
            bloodPressure: null,
            bodyTemperature: 0,
            hydration: 0,
            timestamp: new Date().toISOString()
        };
    }
}
