import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { AndroidHealthProvider } from './AndroidHealthProvider';
import { IOSHealthProvider } from './IOSHealthProvider';
import { IHealthProvider } from './IHealthProvider';
import { HealthData, WeeklyHealthData, HealthDataRange } from './types';

export const useHealthData = () => {
    const [hasPermissions, setHasPermissions] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [dailyData, setDailyData] = useState<HealthData | null>(null);
    const [weeklyData, setWeeklyData] = useState<WeeklyHealthData | null>(null);

    const healthProvider = useRef<IHealthProvider>(
        Platform.OS === 'android' ? new AndroidHealthProvider() : new IOSHealthProvider()
    );

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);

            const result = await healthProvider.current.requestPermissions();
            setHasPermissions(result.granted);

            if (!result.granted) {
                setError('Health permissions not granted');
            }

            return result.granted;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to request permissions';
            setError(errorMessage);
            console.error('Error requesting health permissions:', err);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const checkPermissions = useCallback(async (): Promise<boolean> => {
        try {
            const result = await healthProvider.current.checkPermissions();
            setHasPermissions(result.granted);
            return result.granted;
        } catch (err) {
            console.error('Error checking health permissions:', err);
            setHasPermissions(false);
            return false;
        }
    }, []);

    const loadDailyData = useCallback(async (date: Date = new Date()): Promise<HealthData | null> => {
        try {
            setIsLoading(true);
            setError(null);

            if (!hasPermissions) {
                const permissionGranted = await requestPermissions();
                if (!permissionGranted) {
                    throw new Error('Health permissions required');
                }
            }

            const data = await healthProvider.current.readDailyData(date);
            setDailyData(data);
            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load daily health data';
            
            // Handle permission denied errors specifically
            if (errorMessage === 'PERMISSION_DENIED') {
                setError('Health permissions denied');
                
                // Show alert with option to open settings
                Alert.alert(
                    'Health Permissions Required',
                    'This app needs access to your health data to function properly. Please grant permissions in Health Connect settings.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                            text: 'Open Settings', 
                            onPress: async () => {
                                try {
                                    await healthProvider.current.openSettings();
                                } catch (settingsError) {
                                    console.error('Error opening health settings:', settingsError);
                                }
                            }
                        }
                    ]
                );
            } else {
                setError(errorMessage);
            }
            
            console.error('Error loading daily health data:', err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [hasPermissions, requestPermissions]);

    const loadWeeklyData = useCallback(async (range?: HealthDataRange): Promise<WeeklyHealthData | null> => {
        try {
            setIsLoading(true);
            setError(null);

            if (!hasPermissions) {
                const permissionGranted = await requestPermissions();
                if (!permissionGranted) {
                    throw new Error('Health permissions required');
                }
            }

            const dataRange = range || {
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                endDate: new Date()
            };

            const data = await healthProvider.current.readWeeklyData(dataRange);
            setWeeklyData(data);
            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load weekly health data';
            setError(errorMessage);
            console.error('Error loading weekly health data:', err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [hasPermissions, requestPermissions]);

    const writeHealthData = useCallback(async (data: Partial<HealthData>): Promise<boolean> => {
        try {
            if (!hasPermissions) {
                const permissionGranted = await requestPermissions();
                if (!permissionGranted) {
                    throw new Error('Health permissions required');
                }
            }

            const success = await healthProvider.current.writeHealthData(data);
            if (success) {
                // Refresh current data
                await loadDailyData();
            }
            return success;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to write health data';
            setError(errorMessage);
            console.error('Error writing health data:', err);
            return false;
        }
    }, [hasPermissions, requestPermissions, loadDailyData]);

    const openHealthSettings = useCallback(async (): Promise<void> => {
        try {
            await healthProvider.current.openSettings();
        } catch (err) {
            console.error('Error opening health settings:', err);
        }
    }, []);

    const isHealthAvailable = useCallback(async (): Promise<boolean> => {
        try {
            return await healthProvider.current.isAvailable();
        } catch (err) {
            console.error('Error checking health availability:', err);
            return false;
        }
    }, []);

    // Initialize permissions check on mount
    useEffect(() => {
        const initializeHealth = async () => {
            setIsLoading(true);
            setError(null);
            try {
                console.log('Initializing health provider...');

                // First initialize the provider
                const initialized = await healthProvider.current.initialize();
                if (!initialized) {
                    throw new Error('Failed to initialize health provider');
                }

                const available = await isHealthAvailable();
                if (available) {
                    await checkPermissions();
                } else {
                    setError('Health platform not available');
                }
            } catch (err) {
                console.error('Error initializing health:', err);
                setError('Failed to initialize health platform');
            } finally {
                setIsLoading(false);
            }
        };

        initializeHealth();
    }, [checkPermissions, isHealthAvailable]);

    return {
        // State
        hasPermissions,
        isLoading,
        error,
        dailyData,
        weeklyData,

        // Actions
        requestPermissions,
        checkPermissions,
        loadDailyData,
        loadWeeklyData,
        writeHealthData,
        openHealthSettings,
        isHealthAvailable,

        // Platform info
        platform: Platform.OS,
    };
};
