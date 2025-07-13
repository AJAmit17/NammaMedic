import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions, Animated, Modal, TextInput, RefreshControl } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import {
    initialize,
    insertRecords,
    deleteRecordsByUuids,
    readRecords,
    getSdkStatus,
    SdkAvailabilityStatus,
    RecordingMethod,
    DeviceType,
} from "react-native-health-connect"
import { scheduleWaterReminders, isWaterRemindersSetup } from "@/utils/notifications"
import {
    checkPermissionStatus,
    requestEssentialPermissionsWithSettings
} from "@/utils/healthUtils"

const { width, height } = Dimensions.get("window")

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
})

interface WaterIntakeProps {
    intake: number
    goal: number
}

interface WeeklyWaterData {
    date: string;
    dayName: string;
    intake: number;
    isToday: boolean;
}

interface DayDetailData {
    date: string;
    intake: number;
    goal: number;
    percentage: number;
    hourlyData: Array<{
        hour: number;
        intake: number;
    }>;
    hourlyIntake: Array<{
        hour: number;
        intake: number;
    }>;
}

function WaterBottle({ intake, goal }: WaterIntakeProps) {
    const [fillAnimation] = useState(new Animated.Value(0))
    const [waveAnimation] = useState(new Animated.Value(0))

    const progress = Math.min(intake / goal, 1)
    const bottleHeight = height * 0.25 // Further reduced from 0.3 to make bottle more compact
    const bottleWidth = width * 0.4

    useEffect(() => {
        // Set initial fill level immediately
        fillAnimation.setValue(progress)

        // Animate fill level
        Animated.timing(fillAnimation, {
            toValue: progress,
            duration: 800,
            useNativeDriver: false,
        }).start()

        // Continuous wave animation only if there's water
        if (progress > 0) {
            const waveLoop = Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnimation, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(waveAnimation, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ]),
            )
            waveLoop.start()

            return () => waveLoop.stop()
        }
    }, [progress])

    const fillHeight = fillAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, bottleHeight * 0.68], // Match the bottle outline height
        extrapolate: "clamp",
    })

    const waveTranslateY = waveAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8],
    })

    return (
        <View style={styles.bottleContainer}>
            <View style={[styles.bottle, { width: bottleWidth, height: bottleHeight }]}>
                {/* Bottle cap */}
                <View style={styles.bottleCap} />

                {/* Bottle outline */}
                <View style={styles.bottleOutline} />

                {/* Water fill - positioned to align with bottle outline */}
                <Animated.View
                    style={[
                        styles.waterFill,
                        {
                            height: fillHeight,
                            width: bottleWidth * 0.72, // Match bottle outline width
                            bottom: 55, // Adjusted for smaller bottle height
                        },
                    ]}
                >
                    <LinearGradient colors={["#4FC3F7", "#29B6F6", "#0288D1"]} style={styles.waterGradient} />
                    {progress > 0 && (
                        <Animated.View
                            style={[
                                styles.wave,
                                {
                                    transform: [{ translateY: waveTranslateY }],
                                },
                            ]}
                        />
                    )}
                </Animated.View>

                {/* Progress text overlay */}
                <View style={styles.bottleTextOverlay}>
                    <Text style={styles.intakeNumber}>{Math.round(intake)}</Text>
                    <Text style={styles.intakeUnit}>/ {goal} ml</Text>
                    <Text style={styles.intakePercentage}>{Math.round(progress * 100)}%</Text>
                </View>
            </View>
        </View>
    )
}

export default function WaterScreen() {
    const [waterIntake, setWaterIntake] = useState(0) // Now in ML
    const [dailyGoal, setDailyGoal] = useState(2500) // 2500ml (2.5 liters) per day - standard recommendation
    const [nextReminderTime, setNextReminderTime] = useState<Date | null>(null)
    const [animatedValue] = useState(new Animated.Value(0))
    const [isHealthConnectInitialized, setIsHealthConnectInitialized] = useState(false)
    const [healthPermissions, setHealthPermissions] = useState<any[]>([])
    const [waterRecordIds, setWaterRecordIds] = useState<string[]>([])

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false)
    const [customAmount, setCustomAmount] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    // Goal setting modal states
    const [showGoalModal, setShowGoalModal] = useState(false)
    const [newGoal, setNewGoal] = useState("")
    const [isSavingGoal, setIsSavingGoal] = useState(false)

    // Refresh control state
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Weekly data states
    const [weeklyWaterData, setWeeklyWaterData] = useState<WeeklyWaterData[]>([])
    const [isDayDetailModalVisible, setIsDayDetailModalVisible] = useState(false)
    const [selectedDayData, setSelectedDayData] = useState<DayDetailData | null>(null)
    const [loadingDayDetail, setLoadingDayDetail] = useState(false)

    // Get today's date string for storage key
    const getTodayKey = () => {
        const today = new Date()
        return `water_${today.getFullYear()}_${today.getMonth()}_${today.getDate()}`
    }

    // Sync water data with Google Health Connect
    const syncWithHealthConnect = async () => {
        if (!isHealthConnectInitialized || !canWriteHydration()) {
            return false;
        }

        try {
            // Get today's date range
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

            // Read hydration data from Health Connect for today
            const hydrationData = await readRecords("Hydration", {
                timeRangeFilter: {
                    operator: "between",
                    startTime: startOfDay.toISOString(),
                    endTime: endOfDay.toISOString(),
                },
            });

            // Calculate total hydration in ML
            const totalHydrationLiters = hydrationData.records.reduce(
                (sum: number, record: any) => sum + (record.volume?.inLiters || 0),
                0
            );
            const totalHydrationMl = Math.round(totalHydrationLiters * 1000);

            // Update local state and storage
            setWaterIntake(totalHydrationMl);
            await saveWaterIntake(totalHydrationMl);

            return true;
        } catch (error) {
            console.error('Error syncing with Health Connect:', error);
            return false;
        }
    }

    // Handle pull-to-refresh
    const onRefresh = async () => {
        setIsRefreshing(true);
        try {
            if (isHealthConnectInitialized && canWriteHydration()) {
                const syncSuccess = await syncWithHealthConnect();
                if (syncSuccess) {
                    // Also load weekly data after successful sync
                    await loadWeeklyWaterData();
                } else {
                    Alert.alert("Sync Failed", "Unable to sync with Google Health. Please try again.");
                }
            } else {
                Alert.alert("Health Connect", "Health Connect is not available or permissions not granted.");
            }
        } catch (error) {
            console.error('Error during refresh:', error);
            Alert.alert("Error", "An error occurred while syncing data.");
        } finally {
            setIsRefreshing(false);
        }
    }

    // Load weekly water data
    const loadWeeklyWaterData = async () => {
        try {
            if (!isHealthConnectInitialized || !canWriteHydration()) {
                // Fallback: create empty data for the past 7 days
                const fallbackData: WeeklyWaterData[] = [];
                const today = new Date();

                for (let i = 6; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format

                    fallbackData.push({
                        date: dateString,
                        dayName: getDayName(date),
                        intake: 0,
                        isToday: i === 0,
                    });
                }

                setWeeklyWaterData(fallbackData);
                return;
            }

            // Use the same approach as health-dashboard.tsx
            const hydrationData = await readRecords('Hydration', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    endTime: new Date().toISOString(),
                },
            });

            const weeklyWaterArray: WeeklyWaterData[] = [];
            const today = new Date();

            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format

                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date);
                dayEnd.setHours(23, 59, 59, 999);

                const dayHydration = hydrationData.records
                    .filter((record: any) => {
                        const recordDate = new Date(record.startTime);
                        return recordDate >= dayStart && recordDate <= dayEnd;
                    })
                    .reduce((sum: number, record: any) => sum + (record.volume?.inLiters || 0), 0);

                weeklyWaterArray.push({
                    date: dateString,
                    dayName: getDayName(date),
                    intake: Math.round(dayHydration * 1000), // Convert to ml
                    isToday: i === 0,
                });
            }

            setWeeklyWaterData(weeklyWaterArray);
        } catch (error) {
            console.error('Error loading weekly water data:', error);
            // Fallback: create empty data for the past 7 days using same date logic
            const fallbackData: WeeklyWaterData[] = [];
            const today = new Date();

            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format

                fallbackData.push({
                    date: dateString,
                    dayName: getDayName(date),
                    intake: 0,
                    isToday: i === 0,
                });
            }

            setWeeklyWaterData(fallbackData);
        }
    };

    const getDayName = (date: Date): string => {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return dayNames[date.getDay()];
    };

    const formatDate = (dateString: string): string => {
        // Parse YYYY-MM-DD format directly to avoid timezone issues
        const [year, month, day] = dateString.split('-').map(Number);
        return `${month}/${day}`;
    };

    const loadDayDetailData = async (selectedDate: string) => {
        setLoadingDayDetail(true);
        try {
            const date = new Date(selectedDate);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const dayHydrationData = await readRecords('Hydration', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startOfDay.toISOString(),
                    endTime: endOfDay.toISOString(),
                },
            });

            // Process hourly data by manually filtering records
            const hourlyIntake: Array<{ hour: number; intake: number }> = [];
            let totalIntake = 0;

            for (let hour = 0; hour < 24; hour++) {
                const hourStart = new Date(date);
                hourStart.setHours(hour, 0, 0, 0);
                const hourEnd = new Date(date);
                hourEnd.setHours(hour, 59, 59, 999);

                const hourData = dayHydrationData.records.filter((record: any) => {
                    const recordDate = new Date(record.startTime);
                    return recordDate >= hourStart && recordDate <= hourEnd;
                });

                const hourIntakeValue = hourData.reduce((sum: number, record: any) => sum + (record.volume?.inLiters || 0), 0);
                const hourIntakeMl = Math.round(hourIntakeValue * 1000);

                hourlyIntake.push({ hour, intake: hourIntakeMl });
                totalIntake += hourIntakeMl;
            }

            const percentage = Math.min((totalIntake / dailyGoal) * 100, 100);

            const dayDetailData: DayDetailData = {
                date: selectedDate,
                intake: totalIntake,
                goal: dailyGoal,
                percentage,
                hourlyData: hourlyIntake,
                hourlyIntake: hourlyIntake,
            };

            setSelectedDayData(dayDetailData);
            setIsDayDetailModalVisible(true);
        } catch (error) {
            console.error('Error loading day detail data:', error);
            Alert.alert('Error', 'Failed to load detailed data for the selected day.');
        } finally {
            setLoadingDayDetail(false);
        }
    };

    const closeDayDetailModal = () => {
        setIsDayDetailModalVisible(false);
        setSelectedDayData(null);
    };

    const formatHourRange = (hour: number): string => {
        const nextHour = (hour + 1) % 24;
        return `${hour.toString().padStart(2, '0')}:00 - ${nextHour.toString().padStart(2, '0')}:00`;
    };

    const getFullDateString = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Load saved water intake for today
    const loadWaterIntake = async () => {
        try {
            const todayKey = getTodayKey()
            const savedIntake = await AsyncStorage.getItem(todayKey)
            if (savedIntake) {
                setWaterIntake(Number.parseInt(savedIntake, 10))
            }
        } catch (error) {
            console.error("Error loading water intake:", error)
        }
    }

    // Load saved daily goal
    const loadDailyGoal = async () => {
        try {
            const savedGoal = await AsyncStorage.getItem('water_daily_goal')
            if (savedGoal) {
                setDailyGoal(Number.parseInt(savedGoal, 10))
            }
        } catch (error) {
            console.error("Error loading daily goal:", error)
        }
    }

    // Save daily goal
    const saveDailyGoal = async (goal: number) => {
        try {
            await AsyncStorage.setItem('water_daily_goal', goal.toString())
        } catch (error) {
            console.error("Error saving daily goal:", error)
        }
    }

    // Save water intake
    const saveWaterIntake = async (intake: number) => {
        try {
            const todayKey = getTodayKey()
            await AsyncStorage.setItem(todayKey, intake.toString())
        } catch (error) {
            console.error("Error saving water intake:", error)
        }
    }

    // Schedule water reminder notifications
    const setupWaterReminders = async () => {
        try {
            // Check if water reminders are already set up
            const alreadySetup = await isWaterRemindersSetup()

            if (alreadySetup) {
                console.log("Water reminders already configured")
                // Just calculate next reminder time without scheduling again
                calculateNextReminderTime()
                return
            }

            // Schedule recurring water reminders using the notification utility
            const identifiers = await scheduleWaterReminders()

            if (identifiers.length > 0) {
                calculateNextReminderTime()
                console.log(`Water reminders scheduled: ${identifiers.length} notifications`)
            }
        } catch (error) {
            console.error("Error setting up water reminders:", error)
            Alert.alert("Error", "Failed to set up water reminders. Please try again.")
        }
    }

    // Calculate next reminder time helper function
    const calculateNextReminderTime = () => {
        const now = new Date()
        const currentHour = now.getHours()
        let nextHour = 8 // Start from 8 AM

        // Find the next reminder time
        const reminderHours = [8, 10, 12, 14, 16, 18, 20, 22]
        for (const hour of reminderHours) {
            if (hour > currentHour) {
                nextHour = hour
                break
            }
        }

        // If no reminder today, set for 8 AM tomorrow
        if (nextHour <= currentHour) {
            nextHour = 8
            const nextReminder = new Date()
            nextReminder.setDate(nextReminder.getDate() + 1)
            nextReminder.setHours(nextHour, 0, 0, 0)
            setNextReminderTime(nextReminder)
        } else {
            const nextReminder = new Date()
            nextReminder.setHours(nextHour, 0, 0, 0)
            setNextReminderTime(nextReminder)
        }
    }

    // Initialize Health Connect
    const initializeHealthConnect = async () => {
        try {
            const status = await getSdkStatus();
            if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
                console.log('Health Connect is not available on this device');
                return;
            }

            const result = await initialize();
            setIsHealthConnectInitialized(result);

            if (result) {
                await checkHealthPermissions();
            }
        } catch (error) {
            console.error('Error initializing Health Connect:', error);
        }
    };

    // Check Health Connect permissions
    const checkHealthPermissions = async () => {
        try {
            const granted = await checkPermissionStatus();
            setHealthPermissions(granted);
        } catch (error) {
            console.error('Error checking health permissions:', error);
        }
    };

    // Request Health Connect permissions
    const requestHealthPermissions = async () => {
        try {
            await requestEssentialPermissionsWithSettings();
            // After requesting permissions, check what was granted
            await checkHealthPermissions();
        } catch (error) {
            console.error('Error requesting health permissions:', error);
        }
    };

    // Helper function to check if we can write hydration data
    const canWriteHydration = () => {
        return healthPermissions.some(
            (perm: any) => perm.recordType === 'Hydration' && perm.accessType === 'write'
        );
    };

    // Save water intake to Health Connect
    const saveToHealthConnect = async (volumeInMl: number) => {
        if (!isHealthConnectInitialized || !canWriteHydration()) {
            return;
        }

        try {
            const now = new Date().toISOString();
            const deviceInfo = getDeviceMetadata();

            // Convert milliliters to liters for Health Connect
            const volumeInLiters = volumeInMl / 1000;

            const record: any = {
                recordType: 'Hydration',
                volume: {
                    value: volumeInLiters,
                    unit: 'liters'
                },
                startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
                endTime: now,
                metadata: {
                    recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
                    device: deviceInfo,
                },
            };


            //@ts-ignore
            const recordIds = await insertRecords([record]);
            console.log('Water intake saved to Health Connect:', volumeInMl, 'ml');

            // Store the record ID for potential deletion later
            if (recordIds && recordIds.length > 0) {
                setWaterRecordIds(prevIds => [...prevIds, recordIds[0]]);
                // Also save to AsyncStorage to persist across app restarts
                try {
                    const storedIds = await AsyncStorage.getItem('water_record_ids') || '[]';
                    const idsArray = JSON.parse(storedIds);
                    await AsyncStorage.setItem('water_record_ids', JSON.stringify([...idsArray, recordIds[0]]));
                } catch (error) {
                    console.error('Error saving record ID:', error);
                }
            }
        } catch (error) {
            console.error('Error saving to Health Connect:', error);
            throw error;
        }
    };

    // Get device metadata for Health Connect
    const getDeviceMetadata = () => {
        return {
            manufacturer: Device.manufacturer || 'Unknown',
            model: Device.modelName || Device.deviceName || 'Unknown',
            type: DeviceType.TYPE_PHONE
        };
    };

    // Load saved water record IDs
    const loadWaterRecordIds = async () => {
        try {
            const storedIds = await AsyncStorage.getItem('water_record_ids');
            if (storedIds) {
                setWaterRecordIds(JSON.parse(storedIds));
            }
        } catch (error) {
            console.error('Error loading water record IDs:', error);
        }
    };

    // Add water intake in ML
    const addWater = async (amountMl: number) => {
        const newIntake = waterIntake + amountMl
        setWaterIntake(newIntake)
        saveWaterIntake(newIntake)

        // Also save to Health Connect if available and permitted
        if (isHealthConnectInitialized && canWriteHydration()) {
            try {
                await saveToHealthConnect(amountMl)
            } catch (error) {
                console.error('Failed to save water intake to Health Connect:', error)
            }
        }

        // Celebration animation
        Animated.sequence([
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(animatedValue, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start()

        // Check if goal achieved
        if (newIntake >= dailyGoal) {
            Alert.alert("🎉 Goal Achieved!", "Congratulations! You've reached your daily hydration goal!", [
                { text: "Awesome!", style: "default" },
            ])
        }
    }

    // Remove water intake (remove last entry)
    const removeWater = async () => {
        if (waterIntake > 0 && waterRecordIds.length > 0) {
            // Remove from Health Connect if possible
            if (isHealthConnectInitialized && canWriteHydration()) {
                try {
                    // Get the most recent record ID (last in the array)
                    const lastRecordId = waterRecordIds[waterRecordIds.length - 1];

                    // Delete the record from Health Connect
                    await deleteRecordsByUuids('Hydration', [lastRecordId], []);

                    // Update our tracked record IDs
                    const newRecordIds = [...waterRecordIds];
                    newRecordIds.pop();
                    setWaterRecordIds(newRecordIds);

                    // Also update AsyncStorage
                    await AsyncStorage.setItem('water_record_ids', JSON.stringify(newRecordIds));

                    // Remove the amount from local storage (we'll need to track individual amounts)
                    // For now, we'll just remove a reasonable amount (250ml)
                    const newIntake = Math.max(waterIntake - 250, 0);
                    setWaterIntake(newIntake);
                    saveWaterIntake(newIntake);

                    console.log('Removed recent water entry from Health Connect tracking');
                } catch (error) {
                    console.error('Error removing water record from Health Connect:', error);
                }
            } else {
                // If no Health Connect, just remove 250ml
                const newIntake = Math.max(waterIntake - 250, 0);
                setWaterIntake(newIntake);
                saveWaterIntake(newIntake);
            }
        }
    }

    // Quick add functions for common amounts
    const addQuickAmount = (amount: number) => {
        addWater(amount);
    }

    // Show modal for custom amount
    const showAddWaterModal = () => {
        setCustomAmount("");
        setShowAddModal(true);
    }

    // Handle custom amount submission
    const handleCustomAmountSubmit = async () => {
        const amount = parseFloat(customAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount in ML (e.g., 250, 500)");
            return;
        }
        if (amount > 2000) {
            Alert.alert("Large Amount", "That's a very large amount! Are you sure?", [
                { text: "Cancel", style: "cancel" },
                { text: "Yes", onPress: () => submitCustomAmount(amount) }
            ]);
            return;
        }
        submitCustomAmount(amount);
    }

    const submitCustomAmount = async (amount: number) => {
        setIsLoading(true);
        try {
            await addWater(amount);
            setShowAddModal(false);
            setCustomAmount("");
        } catch (error) {
            console.error('Error adding water:', error);
            Alert.alert("Error", "Failed to add water intake. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    // Goal setting functions
    const showGoalSettingModal = () => {
        setNewGoal(dailyGoal.toString());
        setShowGoalModal(true);
    }

    const handleGoalSubmit = async () => {
        const goal = parseFloat(newGoal);
        if (isNaN(goal) || goal <= 0) {
            Alert.alert("Invalid Goal", "Please enter a valid goal in ML (e.g., 2000, 2500, 3000)");
            return;
        }
        if (goal < 1000) {
            Alert.alert("Low Goal", "That seems quite low for daily water intake. The minimum recommended is 1500ml.", [
                { text: "Cancel", style: "cancel" },
                { text: "Set Anyway", onPress: () => submitGoal(goal) }
            ]);
            return;
        }
        if (goal > 5000) {
            Alert.alert("High Goal", "That's a very high daily goal! Are you sure?", [
                { text: "Cancel", style: "cancel" },
                { text: "Yes", onPress: () => submitGoal(goal) }
            ]);
            return;
        }
        submitGoal(goal);
    }

    const submitGoal = async (goal: number) => {
        setIsSavingGoal(true);
        try {
            setDailyGoal(goal);
            await saveDailyGoal(goal);
            setShowGoalModal(false);
            setNewGoal("");
            Alert.alert("Success", `Daily water goal set to ${goal}ml!`);
        } catch (error) {
            console.error('Error setting goal:', error);
            Alert.alert("Error", "Failed to save goal. Please try again.");
        } finally {
            setIsSavingGoal(false);
        }
    }

    useEffect(() => {
        loadWaterIntake()
        loadDailyGoal()
        setupWaterReminders()
        initializeHealthConnect()
        loadWaterRecordIds()
        loadWeeklyWaterData()
    }, [])

    const progress = Math.min(waterIntake / dailyGoal, 1)
    const remainingMl = Math.max(dailyGoal - waterIntake, 0)

    const getMotivationalMessage = () => {
        if (waterIntake >= dailyGoal) {
            return "🎉 Perfectly hydrated! Keep it up!"
        } else if (waterIntake >= dailyGoal * 0.75) {
            return "💪 Almost there! Just a little more!"
        } else if (waterIntake >= dailyGoal * 0.5) {
            return "🌊 Great progress! Halfway to your goal!"
        } else if (waterIntake > 0) {
            return "💧 Good start! Keep drinking water!"
        } else {
            return "🌟 Start your hydration journey!"
        }
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    colors={["#0288D1"]}
                    tintColor="#0288D1"
                    title="Syncing with Google Health..."
                    titleColor="#0288D1"
                />
            }
        >
            <LinearGradient colors={["#0288D1", "#0277BD", "#01579B"]} style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.headerTop}>
                        <View style={{ width: 40 }} />
                        <Text style={styles.greeting}>Daily Hydration</Text>
                        <TouchableOpacity
                            style={styles.goalButton}
                            onPress={showGoalSettingModal}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="settings" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                    <WaterBottle intake={waterIntake} goal={dailyGoal} />
                    <Text style={styles.motivationalText}>{getMotivationalMessage()}</Text>
                </View>
            </LinearGradient>

            <View style={styles.content}>
                {/* Quick Actions */}
                <View style={styles.actionsContainer}>
                    <Text style={styles.sectionTitle}>Quick Add</Text>

                    <View style={styles.quickAddRow}>
                        <TouchableOpacity
                            style={[styles.quickAddButton, { backgroundColor: "#0288D1" }]}
                            onPress={() => addQuickAmount(250)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.quickAddText}>250ml</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.quickAddButton, { backgroundColor: "#0288D1" }]}
                            onPress={() => addQuickAmount(500)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.quickAddText}>500ml</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.quickAddButton, { backgroundColor: "#0288D1" }]}
                            onPress={() => addQuickAmount(1000)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.quickAddText}>1000ml</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.quickAddButton, { backgroundColor: "#FF6B35" }]}
                            onPress={showAddWaterModal}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.quickAddText}>Custom</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.removeButton]}
                            onPress={removeWater}
                            disabled={waterIntake === 0}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="remove-circle" size={28} color={waterIntake === 0 ? "#ccc" : "#666"} />
                            <Text style={[styles.buttonText, styles.removeButtonText, waterIntake === 0 && styles.disabledText]}>
                                Remove Last Entry
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Health Connect Integration */}
                {isHealthConnectInitialized && !canWriteHydration() && (
                    <View style={styles.infoCard}>
                        <Ionicons name="heart-outline" size={24} color="#0277BD" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>Connect to Health App</Text>
                            <Text style={styles.infoText}>
                                Sync your water intake with your health data for better tracking and insights.
                            </Text>
                            <TouchableOpacity
                                style={[styles.actionButton, { marginTop: 10, backgroundColor: "#0277BD" }]}
                                onPress={requestHealthPermissions}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="link" size={20} color="white" />
                                <Text style={[styles.buttonText, { fontSize: 14 }]}>Grant Permissions</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Health Connect Sync Info */}
                {/* {isHealthConnectInitialized && canWriteHydration() && (
                    <View style={styles.infoCard}>
                        <Ionicons name="sync" size={24} color="#4CAF50" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>Google Health Sync</Text>
                            <Text style={styles.infoText}>
                                Your water intake is synced with Google Health. Pull down to refresh and sync the latest data from your health app.
                            </Text>
                        </View>
                    </View>
                )} */}

                {/* Progress Stats */}
                <View style={styles.statsContainer}>
                    <Text style={styles.sectionTitle}>Today's Progress</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{Math.round(waterIntake)}</Text>
                                    <Text style={styles.statLabel}>ML Consumed</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="water" size={24} color="#0288D1" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{Math.round(remainingMl)}</Text>
                                    <Text style={styles.statLabel}>ML Remaining</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="fitness" size={24} color="#4CAF50" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{Math.round(progress * 100)}</Text>
                                    <Text style={styles.statLabel}>% Complete</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="trending-up" size={24} color="#FF9800" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{nextReminderTime ? nextReminderTime.getHours().toString().padStart(2, "0") + ":00" : "--:--"}</Text>
                                    <Text style={styles.statLabel}>Next Reminder</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="time" size={24} color="#9C27B0" />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Weekly Progress */}
                <View style={styles.statsContainer}>
                    <View style={styles.weeklyProgressCard}>
                        <View style={styles.chartContainer}>
                            <Text style={styles.chartTitle}>Weekly Hydration</Text>
                            <View style={styles.weeklyChart}>
                                {weeklyWaterData.map((dayData, index) => {
                                    const maxIntake = Math.max(...weeklyWaterData.map(d => d.intake), dailyGoal);
                                    const barHeight = Math.max((dayData.intake / maxIntake) * 100, 4);
                                    const goalReached = dayData.intake >= dailyGoal;

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={styles.chartBar}
                                            onPress={() => loadDayDetailData(dayData.date)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.barContainer}>
                                                {dayData.intake > 0 && (
                                                    <Text style={[
                                                        styles.intakeCountLabel,
                                                        dayData.isToday && styles.todayIntakeLabel,
                                                        goalReached && styles.goalReachedIntakeLabel
                                                    ]}>
                                                        {Math.round(dayData.intake)}
                                                    </Text>
                                                )}
                                                <View
                                                    style={[
                                                        styles.bar,
                                                        {
                                                            height: `${barHeight}%`,
                                                            backgroundColor: goalReached
                                                                ? '#52C41A'
                                                                : dayData.isToday
                                                                    ? '#0288D1'
                                                                    : '#B3E5FC'
                                                        }
                                                    ]}
                                                />
                                            </View>
                                            <Text style={[
                                                styles.dayLabel,
                                                dayData.isToday && styles.todayLabel,
                                                goalReached && styles.goalReachedLabel
                                            ]}>
                                                {dayData.dayName}
                                            </Text>
                                            <Text style={[
                                                styles.dateLabel,
                                                dayData.isToday && styles.todayDateLabel
                                            ]}>
                                                {formatDate(dayData.date)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <View style={styles.weeklyStats}>
                                <View style={styles.weeklyStatItem}>
                                    <Text style={styles.weeklyStatValue}>
                                        {Math.round(weeklyWaterData.reduce((sum, day) => sum + day.intake, 0) / 1000 * 10) / 10}L
                                    </Text>
                                    <Text style={styles.weeklyStatLabel}>Total</Text>
                                </View>
                                <View style={styles.weeklyStatItem}>
                                    <Text style={styles.weeklyStatValue}>
                                        {Math.round(weeklyWaterData.reduce((sum, day) => sum + day.intake, 0) / weeklyWaterData.length)}ml
                                    </Text>
                                    <Text style={styles.weeklyStatLabel}>Daily Avg</Text>
                                </View>
                                <View style={styles.weeklyStatItem}>
                                    <Text style={styles.weeklyStatValue}>
                                        {weeklyWaterData.filter(day => day.intake >= dailyGoal).length}
                                    </Text>
                                    <Text style={styles.weeklyStatLabel}>Goals Met</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Daily Tips */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💡 Hydration Tips</Text>
                    <View style={styles.tipsCard}>
                        <Text style={styles.tipText}>• Start your day with a glass of water</Text>
                        <Text style={styles.tipText}>• Keep a water bottle with you</Text>
                        <Text style={styles.tipText}>• Drink water before, during, and after exercise</Text>
                        <Text style={styles.tipText}>• Eat water-rich foods like fruits and vegetables</Text>
                        <Text style={styles.tipText}>• Set reminders throughout the day</Text>
                    </View>
                </View>

                {/* Reminder Settings Info */}
                <View style={styles.infoCard}>
                    <Ionicons name="notifications" size={24} color="#0288D1" />
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>Smart Reminders</Text>
                        <Text style={styles.infoText}>
                            You'll receive gentle reminders every 2 hours from 8 AM to 10 PM to help you stay hydrated throughout the day.
                        </Text>
                    </View>
                </View>

                {/* Glass Size Info */}
                <View style={styles.infoCard}>
                    <Ionicons name="water" size={24} color="#4CAF50" />
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>Hydration Guidelines</Text>
                        <Text style={styles.infoText}>
                            Adults should aim for 2.5-3 liters (2500-3000ml) of water daily. Adjust based on activity level, climate, and individual needs.
                        </Text>
                    </View>
                </View>
            </View>

            {/* Custom Amount Modal */}
            <Modal
                visible={showAddModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Add Water Intake</Text>
                        <Text style={styles.modalSubtitle}>Enter amount in milliliters (ml)</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g., 250, 500, 750"
                            value={customAmount}
                            onChangeText={setCustomAmount}
                            keyboardType="numeric"
                            maxLength={4}
                            autoFocus={true}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => setShowAddModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalAddButton, isLoading && styles.modalButtonDisabled]}
                                onPress={handleCustomAmountSubmit}
                                disabled={isLoading}
                            >
                                <Text style={styles.modalAddText}>
                                    {isLoading ? "Adding..." : "Add Water"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Goal Setting Modal */}
            <Modal
                visible={showGoalModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowGoalModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Set Daily Goal</Text>
                        <Text style={styles.modalSubtitle}>Enter your daily water intake goal in milliliters (ml)</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g., 2000, 2500, 3000"
                            value={newGoal}
                            onChangeText={setNewGoal}
                            keyboardType="numeric"
                            maxLength={4}
                            autoFocus={true}
                        />

                        <View style={styles.goalSuggestions}>
                            <Text style={styles.suggestionsTitle}>Common Goals:</Text>
                            <View style={styles.suggestionButtons}>
                                <TouchableOpacity
                                    style={styles.suggestionButton}
                                    onPress={() => setNewGoal("2000")}
                                >
                                    <Text style={styles.suggestionText}>2000ml</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.suggestionButton}
                                    onPress={() => setNewGoal("2500")}
                                >
                                    <Text style={styles.suggestionText}>2500ml</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.suggestionButton}
                                    onPress={() => setNewGoal("3000")}
                                >
                                    <Text style={styles.suggestionText}>3000ml</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => setShowGoalModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalAddButton, isSavingGoal && styles.modalButtonDisabled]}
                                onPress={handleGoalSubmit}
                                disabled={isSavingGoal}
                            >
                                <Text style={styles.modalAddText}>
                                    {isSavingGoal ? "Saving..." : "Set Goal"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Day Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isDayDetailModalVisible}
                onRequestClose={closeDayDetailModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.dayDetailModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {selectedDayData ? getFullDateString(selectedDayData.date) : 'Day Details'}
                            </Text>
                            <TouchableOpacity onPress={closeDayDetailModal} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {loadingDayDetail ? (
                            <View style={styles.loadingContainer}>
                                <Text style={styles.loadingText}>Loading detailed data...</Text>
                            </View>
                        ) : selectedDayData ? (
                            <ScrollView style={styles.dayDetailContent} showsVerticalScrollIndicator={false}>
                                {/* Day Summary */}
                                <View style={styles.daySummaryCard}>
                                    <View style={styles.summaryRow}>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="water-outline" size={24} color="#0288D1" />
                                            <Text style={styles.summaryValue}>{Math.round(selectedDayData.intake)}</Text>
                                            <Text style={styles.summaryLabel}>ml</Text>
                                        </View>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="trophy-outline" size={24} color="#52C41A" />
                                            <Text style={styles.summaryValue}>{Math.round(selectedDayData.goal)}</Text>
                                            <Text style={styles.summaryLabel}>Goal</Text>
                                        </View>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="stats-chart-outline" size={24} color="#FF6B35" />
                                            <Text style={styles.summaryValue}>{Math.round((selectedDayData.intake / selectedDayData.goal) * 100)}</Text>
                                            <Text style={styles.summaryLabel}>% Progress</Text>
                                        </View>
                                    </View>

                                    {/* Goal Progress */}
                                    <View style={styles.goalProgressSection}>
                                        <Text style={styles.goalProgressTitle}>Hydration Goal Progress</Text>
                                        <View style={styles.goalProgressBar}>
                                            <View style={[
                                                styles.goalProgressFill,
                                                { width: `${Math.min((selectedDayData.intake / selectedDayData.goal) * 100, 100)}%` }
                                            ]} />
                                        </View>
                                        <Text style={styles.goalProgressText}>
                                            {selectedDayData.intake >= selectedDayData.goal
                                                ? `🎉 Goal achieved! +${Math.round(selectedDayData.intake - selectedDayData.goal)}ml extra intake`
                                                : `${Math.round(selectedDayData.goal - selectedDayData.intake)}ml remaining`
                                            }
                                        </Text>
                                    </View>
                                </View>

                                {/* Hourly Breakdown */}
                                {selectedDayData.hourlyData && selectedDayData.hourlyData.length > 0 && (
                                    <View style={styles.hourlyBreakdownCard}>
                                        <Text style={styles.hourlyTitle}>Hourly Breakdown</Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={true}
                                            style={styles.hourlyScrollContainer}
                                            contentContainerStyle={styles.hourlyScrollContent}
                                        >
                                            <View style={styles.hourlyChart}>
                                                {selectedDayData.hourlyData.map((hourData) => {
                                                    const maxIntakeInHour = Math.max(...selectedDayData.hourlyData.map(h => h.intake));
                                                    const barHeight = maxIntakeInHour > 0 ? (hourData.intake / maxIntakeInHour) * 110 : 0;
                                                    const showIntake = hourData.intake > 0;

                                                    return (
                                                        <View key={hourData.hour} style={styles.hourlyBarContainer}>
                                                            {/* Intake amount above bar */}
                                                            {showIntake && (
                                                                <Text style={styles.hourSteps}>
                                                                    {hourData.intake > 999 ? `${(hourData.intake / 1000).toFixed(1)}L` : `${Math.round(hourData.intake)}ml`}
                                                                </Text>
                                                            )}
                                                            <View style={styles.hourlyBar}>
                                                                <View style={[
                                                                    styles.hourlyBarFill,
                                                                    {
                                                                        height: Math.max(barHeight, 4),
                                                                        backgroundColor: hourData.intake > 0 ? '#0288D1' : '#E0E0E0'
                                                                    }
                                                                ]} />
                                                            </View>
                                                            <Text style={styles.hourLabel}>
                                                                {hourData.hour.toString().padStart(2, '0')}:00
                                                            </Text>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </ScrollView>
                                        <View style={styles.hourlyLegend}>
                                            <Text style={styles.hourlyLegendText}>Peak Intake: {
                                                (() => {
                                                    const peakHour = selectedDayData.hourlyData.reduce((prev, current) =>
                                                        prev.intake > current.intake ? prev : current
                                                    );
                                                    return peakHour.intake > 0 ? `${formatHourRange(peakHour.hour)} (${Math.round(peakHour.intake)}ml)` : 'No intake recorded';
                                                })()
                                            }</Text>
                                        </View>
                                    </View>
                                )}
                            </ScrollView>
                        ) : (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>No data available for this day</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
    },
    header: {
        paddingTop: 40, // Significantly reduced to move title closer to notch
        paddingBottom: 15, // Reduced from 25 to decrease gap
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        position: "relative",
    },
    headerContent: {
        alignItems: "center",
        paddingHorizontal: 0,
        paddingTop: 5, // Reduced from 20 to move title closer to top
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        paddingHorizontal: 20,
        position: "relative",
    },
    infoButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        justifyContent: "center",
        alignItems: "center",
    },
    greeting: {
        fontSize: 24,
        fontWeight: "700",
        color: "white",
        textAlign: "center",
        flex: 1,
    },
    motivationalText: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.9)",
        marginVertical: 0, // Removed margin to minimize gap
        marginTop: -20, // More negative margin to bring text closer to bottle
        textAlign: "center",
    },
    content: {
        flex: 1,
        marginVertical: 0,
        paddingTop: 20,
    },
    bottle: {
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 0, // Removed margin to minimize gap
    },
    bottleContainer: {
        marginTop: 30,
        alignItems: "center",
        marginVertical: 0,
        alignSelf: "center",
    },
    bottleOutline: {
        position: "absolute",
        top: 20,
        width: "72%",
        height: "68%",
        borderWidth: 3,
        borderColor: "rgba(255, 255, 255, 0.3)",
        borderRadius: 20,
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5,
        alignSelf: "center",
        borderBottomColor: "transparent",
    },
    waterFill: {
        position: "absolute",
        borderRadius: 17,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        overflow: "hidden",
        alignSelf: "center",
        backgroundColor: "rgba(255, 255, 255, 0.3)",
    },
    bottleCap: {
        position: "absolute",
        top: 0,
        width: "25%",
        height: 20,
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        borderRadius: 8,
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
        alignSelf: "center",
        shadowColor: "rgba(0, 0, 0, 0.2)",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
    },
    wave: {
        position: "absolute",
        top: -5,
        left: 0,
        right: 0,
        height: 10,
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        borderRadius: 5,
    },
    bottleTextOverlay: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
        top: "40%",
    },
    intakeNumber: {
        fontSize: 28,
        fontWeight: "bold",
        color: "white",
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    intakeUnit: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.9)",
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    intakePercentage: {
        fontSize: 12,
        color: "rgba(255, 255, 255, 0.8)",
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    actionsContainer: {
        paddingHorizontal: 20,
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1a1a1a",
        marginBottom: 15,
    },
    actionButtons: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
    },
    actionButton: {
        flex: 1,
        height: 60,
        borderRadius: 16,
        backgroundColor: "#0288D1",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        color: "white",
    },
    addButton: {
        backgroundColor: "#0288D1",
    },
    removeButton: {
        backgroundColor: "white",
        borderWidth: 2,
        borderColor: "#e0e0e0",
    },
    removeButtonText: {
        color: "#666",
    },
    disabledText: {
        color: "#ccc",
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "white",
    },
    statsContainer: {
        paddingHorizontal: 20,
        marginBottom: 20, // Reduced from 25
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    statCard: {
        width: (width - 52) / 2,
        backgroundColor: "white",
        borderRadius: 16,
        padding: 15, // Reduced from 20
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    statContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
    },
    statTextContainer: {
        flex: 1,
        alignItems: "flex-start",
    },
    statIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#f0f9ff",
        justifyContent: "center",
        alignItems: "center",
    },
    statNumber: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: "#666",
        textAlign: "left",
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    tipsCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    tipText: {
        fontSize: 14,
        color: "#666",
        marginBottom: 8,
    },
    infoCard: {
        backgroundColor: "#E1F5FE",
        borderRadius: 16,
        padding: 15,
        margin: 20,
        marginTop: 0,
        marginBottom: 6,
        flexDirection: "row",
        alignItems: "flex-start",
    },
    infoContent: {
        flex: 1,
        lineHeight: 20,
        marginLeft: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#0277BD",
        marginBottom: 6,
    },
    infoText: {
        fontSize: 14,
        color: "#424242",
        lineHeight: 20,
    },
    waterGradient: {
        flex: 1,
        width: "100%",
    },
    // Quick Add Styles
    quickAddRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 20,
    },
    quickAddButton: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    quickAddText: {
        fontSize: 16,
        fontWeight: "600",
        color: "white",
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContainer: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 24,
        width: "85%",
        maxWidth: 350,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 12,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#0288D1",
        textAlign: "center",
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
        marginBottom: 20,
    },
    modalInput: {
        borderWidth: 2,
        borderColor: "#E0E0E0",
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        textAlign: "center",
        marginBottom: 24,
        backgroundColor: "#F8F9FA",
    },
    modalButtons: {
        flexDirection: "row",
        gap: 12,
    },
    modalButton: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    modalCancelButton: {
        backgroundColor: "#F5F5F5",
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    modalAddButton: {
        backgroundColor: "#0288D1",
        shadowColor: "#0288D1",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    modalButtonDisabled: {
        backgroundColor: "#BDBDBD",
        shadowOpacity: 0,
        elevation: 0,
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#666",
    },
    modalAddText: {
        fontSize: 16,
        fontWeight: "600",
        color: "white",
    },
    // Goal Setting Styles
    goalButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        justifyContent: "center",
        alignItems: "center",
    },
    goalInfoContainer: {
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginTop: 10,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.2)",
    },
    goalInfoText: {
        fontSize: 12,
        color: "rgba(255, 255, 255, 0.9)",
        textAlign: "center",
        fontWeight: "500",
    },
    goalSuggestions: {
        marginBottom: 20,
    },
    suggestionsTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#666",
        marginBottom: 12,
        textAlign: "center",
    },
    suggestionButtons: {
        flexDirection: "row",
        gap: 8,
    },
    suggestionButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: "#F0F9FF",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#E0F2FE",
        alignItems: "center",
    },
    suggestionText: {
        fontSize: 14,
        fontWeight: "500",
        color: "#0288D1",
    },
    weeklyProgressCard: {
        backgroundColor: "white",
        borderRadius: 15,
        padding: 15,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    chartContainer: {
        width: "100%",
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
        marginBottom: 15,
        textAlign: "center",
    },
    weeklyChart: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        height: 120,
        marginBottom: 20,
        paddingHorizontal: 5,
    },
    chartBar: {
        flex: 1,
        alignItems: "center",
        marginHorizontal: 2,
    },
    barContainer: {
        width: "100%",
        height: 100,
        justifyContent: "flex-end",
        alignItems: "center",
        position: "relative",
    },
    bar: {
        width: "70%",
        borderRadius: 4,
        minHeight: 4,
    },
    intakeCountLabel: {
        fontSize: 10,
        fontWeight: "600",
        color: "#666",
        marginBottom: 2,
        textAlign: "center",
    },
    todayIntakeLabel: {
        color: "#0288D1",
        fontWeight: "700",
    },
    goalReachedIntakeLabel: {
        color: "#52C41A",
        fontWeight: "700",
    },
    dayLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#666",
        marginTop: 5,
        textAlign: "center",
    },
    todayLabel: {
        color: "#0288D1",
        fontWeight: "700",
    },
    goalReachedLabel: {
        color: "#52C41A",
    },
    dateLabel: {
        fontSize: 10,
        color: "#999",
        marginTop: 2,
        textAlign: "center",
    },
    todayDateLabel: {
        color: "#0288D1",
        fontWeight: "600",
    },
    todayBadge: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#0288D1",
        marginTop: 2,
    },
    weeklyStats: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
        paddingTop: 15,
    },
    weeklyStatItem: {
        alignItems: "center",
    },
    weeklyStatValue: {
        fontSize: 18,
        fontWeight: "700",
        color: "#0288D1",
        marginBottom: 4,
    },
    weeklyStatLabel: {
        fontSize: 12,
        color: "#666",
        fontWeight: "500",
    },
    // Day Detail Modal Styles
    dayDetailModalContent: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        width: width * 0.95,
        maxHeight: "90%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    closeButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "#f0f0f0",
        justifyContent: "center",
        alignItems: "center",
    },
    loadingContainer: {
        padding: 40,
        alignItems: "center",
    },
    loadingText: {
        fontSize: 16,
        color: "#666",
        fontWeight: "500",
    },
    dayDetailContent: {
        maxHeight: 500,
    },
    daySummaryCard: {
        backgroundColor: "#f8f9fa",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 16,
        paddingHorizontal: 10,
    },
    summaryItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginTop: 4,
    },
    summaryLabel: {
        fontSize: 12,
        color: "#666",
        marginTop: 2,
    },
    goalProgressSection: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: "#e0e0e0",
    },
    goalProgressTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#333",
        marginBottom: 8,
    },
    goalProgressBar: {
        height: 8,
        backgroundColor: "#e0e0e0",
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 8,
    },
    goalProgressFill: {
        height: "100%",
        backgroundColor: "#0288D1",
        borderRadius: 4,
    },
    goalProgressText: {
        fontSize: 12,
        color: "#666",
        textAlign: "center",
    },
    hourlyBreakdownCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        marginBottom: 8,
    },
    hourlyTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 16,
    },
    hourlyScrollContainer: {
        height: 180,
        marginBottom: 12,
    },
    hourlyScrollContent: {
        paddingHorizontal: 8,
        alignItems: 'flex-end',
    },
    hourlyChart: {
        flexDirection: "row",
        alignItems: "flex-end",
        height: 160,
        paddingTop: 20,
    },
    hourlyBarContainer: {
        alignItems: "center",
        marginHorizontal: 2,
        minWidth: 24,
    },
    hourlyBar: {
        height: 120,
        justifyContent: "flex-end",
        alignItems: "center",
        width: 16,
    },
    hourlyBarFill: {
        width: "100%",
        borderRadius: 2,
        minHeight: 2,
    },
    hourLabel: {
        fontSize: 9,
        color: "#666",
        marginTop: 8,
        fontWeight: "500",
        textAlign: "center",
        minWidth: 24,
    },
    hourSteps: {
        fontSize: 10,
        color: "#333",
        marginBottom: 4,
        fontWeight: "600",
        backgroundColor: "rgba(255,255,255,0.95)",
        paddingHorizontal: 3,
        paddingVertical: 1,
        borderRadius: 3,
        minWidth: 20,
        textAlign: "center",
        borderWidth: 0.5,
        borderColor: "rgba(0,0,0,0.1)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    hourlyLegend: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
    },
    hourlyLegendText: {
        fontSize: 12,
        color: "#666",
        textAlign: "center",
    },
    errorContainer: {
        padding: 40,
        alignItems: "center",
    },
    errorText: {
        fontSize: 16,
        color: "#666",
        fontWeight: "500",
    },
})