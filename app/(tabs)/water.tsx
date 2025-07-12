import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions, Animated } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import {
    initialize,
    insertRecords,
    deleteRecordsByUuids,
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
                    <Text style={styles.intakeNumber}>{intake}</Text>
                    <Text style={styles.intakeUnit}>/ {goal} glasses</Text>
                    <Text style={styles.intakePercentage}>{Math.round(progress * 100)}%</Text>
                </View>
            </View>
        </View>
    )
}

export default function WaterScreen() {
    const [waterIntake, setWaterIntake] = useState(0)
    const [dailyGoal] = useState(8) // 8 glasses per day
    const [nextReminderTime, setNextReminderTime] = useState<Date | null>(null)
    const [animatedValue] = useState(new Animated.Value(0))
    const [isHealthConnectInitialized, setIsHealthConnectInitialized] = useState(false)
    const [healthPermissions, setHealthPermissions] = useState<any[]>([])
    const [waterRecordIds, setWaterRecordIds] = useState<string[]>([])
    const WATER_GLASS_ML = 250 // Each glass represents 250ml of water

    // Get today's date string for storage key
    const getTodayKey = () => {
        const today = new Date()
        return `water_${today.getFullYear()}_${today.getMonth()}_${today.getDate()}`
    }

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

    // Add water intake
    const addWater = async () => {
        const newIntake = waterIntake + 1
        setWaterIntake(newIntake)
        saveWaterIntake(newIntake)

        // Also save to Health Connect if available and permitted
        if (isHealthConnectInitialized && canWriteHydration()) {
            try {
                await saveToHealthConnect(WATER_GLASS_ML) // Add 250ml to Health Connect
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
        if (newIntake == dailyGoal) {
            Alert.alert("🎉 Goal Achieved!", "Congratulations! You've reached your daily water intake goal!", [
                { text: "Awesome!", style: "default" },
            ])
        }
    }

    // Remove water intake
    const removeWater = async () => {
        if (waterIntake > 0) {
            const newIntake = waterIntake - 1
            setWaterIntake(newIntake)
            saveWaterIntake(newIntake)
            
            // Remove from Health Connect if possible
            if (isHealthConnectInitialized && canWriteHydration() && waterRecordIds.length > 0) {
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
                    
                    console.log('Removed one glass (250ml) from Health Connect tracking');
                } catch (error) {
                    console.error('Error removing water record from Health Connect:', error);
                }
            }
        }
    }

    useEffect(() => {
        loadWaterIntake()
        setupWaterReminders()
        initializeHealthConnect()
        loadWaterRecordIds()
    }, [])

    const progress = Math.min(waterIntake / dailyGoal, 1)
    const remainingGlasses = Math.max(dailyGoal - waterIntake, 0)

    const getMotivationalMessage = () => {
        if (waterIntake >= dailyGoal) {
            return "🎉 Perfectly hydrated! Keep it up!"
        } else if (waterIntake >= dailyGoal * 0.75) {
            return "💪 Almost there! Just a few more glasses!"
        } else if (waterIntake >= dailyGoal * 0.5) {
            return "🌊 Great progress! Halfway to your goal!"
        } else if (waterIntake > 0) {
            return "💧 Good start! Keep drinking water!"
        } else {
            return "🌟 Start your hydration journey!"
        }
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={["#0288D1", "#0277BD", "#01579B"]} style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.headerTop}>
                        <View style={{ width: 40 }} />
                        <Text style={styles.greeting}>Daily Hydration</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <WaterBottle intake={waterIntake} goal={dailyGoal} />
                    <Text style={styles.motivationalText}>{getMotivationalMessage()}</Text>
                </View>
            </LinearGradient>

            <View style={styles.content}>
                {/* Quick Actions */}
                <View style={styles.actionsContainer}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={[styles.actionButton, styles.addButton]} onPress={addWater} activeOpacity={0.8}>
                            <Ionicons name="add" size={28} color="white" />
                            <Text style={styles.buttonText}>Add Glass</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.removeButton]}
                            onPress={removeWater}
                            disabled={waterIntake === 0}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="remove" size={28} color={waterIntake === 0 ? "#ccc" : "#666"} />
                            <Text style={[styles.buttonText, styles.removeButtonText, waterIntake === 0 && styles.disabledText]}>
                                Remove Glass
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

                {/* Progress Stats */}
                <View style={styles.statsContainer}>
                    <Text style={styles.sectionTitle}>Today's Progress</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{waterIntake}</Text>
                                    <Text style={styles.statLabel}>Glasses</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="water" size={24} color="#0288D1" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{remainingGlasses}</Text>
                                    <Text style={styles.statLabel}>Remaining</Text>
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
                                    <Text style={styles.statNumber}>{waterIntake * WATER_GLASS_ML}</Text>
                                    <Text style={styles.statLabel}>ml Consumed</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="flask" size={24} color="#03A9F4" />
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
                        <Text style={styles.infoTitle}>Glass Size Guide</Text>
                        <Text style={styles.infoText}>
                            Each glass should contain at least 250ml of water to count towards your daily goal. This ensures you're getting adequate hydration with each serving.
                        </Text>
                    </View>
                </View>
            </View>
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
})