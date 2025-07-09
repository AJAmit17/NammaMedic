import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    Dimensions,
    TouchableOpacity,
    RefreshControl,
    Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    initialize,
    readRecords,
    getSdkStatus,
    SdkAvailabilityStatus,
} from 'react-native-health-connect';
import {
    requestEssentialPermissions,
    checkPermissionStatus,
} from '@/utils/healthUtils';

const { width } = Dimensions.get('window');

interface StepCounterProps {
    steps: number;
    goal: number;
}

function StepCounter({ steps, goal }: StepCounterProps) {
    const progress = Math.min(steps / goal, 1);
    const size = width * 0.55;
    const strokeWidth = 15;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <View style={styles.progressContainer}>
            <View style={styles.progressTextContainer}>
                <Text style={styles.stepsNumber}>{steps.toLocaleString()}</Text>
                <Text style={styles.stepsLabel}>Steps</Text>
                <Text style={styles.goalText}>Goal: {goal.toLocaleString()}</Text>
            </View>
            <Svg width={size} height={size} style={styles.progressRing}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="white"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
        </View>
    );
}

export default function StepsScreen() {
    const [currentSteps, setCurrentSteps] = useState(0);
    const [stepGoal, setStepGoal] = useState(10000);
    const [isHealthConnectAvailable, setIsHealthConnectAvailable] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const requestPermissions = async () => {
        try {
            setLoading(true);

            await requestEssentialPermissions();
            await new Promise(resolve => setTimeout(resolve, 1000));

            const newPermissions = await checkPermissionStatus();
            setPermissions(newPermissions);

            if (newPermissions.length > 0) {
                await loadStepGoal();
                await loadStepsData();
            } else {
                Alert.alert(
                    'Permissions Required',
                    'Please grant Health Connect permissions to track your steps.',
                );
            }
        } catch (error) {
            console.error('Error requesting permissions:', error);
            Alert.alert('Error', 'Failed to request permissions');
        } finally {
            setLoading(false);
        }
    };

    const canReadSteps = () => {
        if (!permissions || permissions.length === 0) {
            console.log('canReadSteps: No permissions array or empty array');
            return false;
        }

        const hasStepsRead = permissions.some((perm: any) => {
            const recordType = perm.recordType || perm.dataType || perm.type || perm.permission;
            const accessType = perm.accessType || perm.access || perm.mode;

            const isStepsPermission = recordType === 'Steps' ||
                recordType === 'STEPS' ||
                recordType === 'steps' ||
                recordType?.toLowerCase?.() === 'steps';

            const isReadPermission = accessType === 'read' ||
                accessType === 'READ' ||
                accessType?.toLowerCase?.() === 'read' ||
                accessType?.includes?.('read') ||
                accessType?.includes?.('READ');

            const result = isStepsPermission && isReadPermission;

            return result;
        });
        return hasStepsRead;
    };

    const loadStepGoal = async () => {
        try {
            const savedGoal = await AsyncStorage.getItem('stepsGoal');
            if (savedGoal) {
                setStepGoal(Number(savedGoal));
            }
        } catch (error) {
            console.error('Error loading step goal:', error);
        }
    };

    const loadStepsData = async () => {
        if (!canReadSteps()) {
            console.log('No permission to read steps data');
            return;
        }

        setLoading(true);
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const stepsData = await readRecords('Steps', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: today.toISOString(),
                    endTime: endOfDay.toISOString(),
                },
            });

            let totalSteps = 0;
            if (stepsData && stepsData.records && stepsData.records.length > 0) {
                totalSteps = stepsData.records.reduce((sum: number, record: any) => {
                    return sum + (record.count || 0);
                }, 0);
            }

            setCurrentSteps(totalSteps);
        } catch (error) {
            console.error('Error loading steps data:', error);
            Alert.alert('Debug', `Error loading steps: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);

        try {
            const status = await getSdkStatus();
            if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
                setIsHealthConnectAvailable(false);
                return;
            }

            if (!isInitialized) {
                const result = await initialize();
                setIsInitialized(result);
                setIsHealthConnectAvailable(true);

                if (!result) {
                    console.log('Failed to initialize Health Connect during refresh');
                    return;
                }
            }

            const currentPermissions = await checkPermissionStatus();
            setPermissions(currentPermissions);

            await loadStepGoal();

            if (currentPermissions.length > 0) {
                await loadStepsData();
            } else {
                setCurrentSteps(0);
                console.log('No permissions - steps reset to 0');
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const initializeAndRefresh = useCallback(async () => {
        try {
            const status = await getSdkStatus();
            if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
                setIsHealthConnectAvailable(false);
                return;
            }

            if (!isInitialized) {
                const result = await initialize();
                setIsInitialized(result);
                setIsHealthConnectAvailable(true);

                if (!result) {
                    console.log('Failed to initialize Health Connect');
                    return;
                }
            }

            const currentPermissions = await checkPermissionStatus();
            setPermissions(currentPermissions);

            await loadStepGoal();

            if (currentPermissions.length > 0) {
                await loadStepsData();
            } else {
                console.log('No permissions found - user needs to grant permissions');
                setCurrentSteps(0);
            }
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }, []); 

    useFocusEffect(
        useCallback(() => {
            initializeAndRefresh();
        }, [initializeAndRefresh])
    );

    const totalSteps = currentSteps;
    const progressPercentage = Math.min((totalSteps / stepGoal) * 100, 100);
    const remainingSteps = Math.max(stepGoal - totalSteps, 0);

    const distanceKm = (totalSteps * 0.0008).toFixed(1);

    const caloriesBurned = Math.round((totalSteps / 1000) * 20);

    const getMotivationalMessage = () => {
        if (totalSteps >= stepGoal) {
            return "🎉 Goal achieved! Great job!";
        } else if (totalSteps >= stepGoal * 0.75) {
            return "💪 Almost there! Keep going!";
        } else if (totalSteps >= stepGoal * 0.5) {
            return "🚶 Halfway to your goal!";
        } else if (totalSteps > 0) {
            return "👟 Good start! Keep walking!";
        } else {
            return "🌟 Start your walking journey!";
        }
    };

    if (!isInitialized) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.centerTitle}>Daily Steps</Text>
                <Text style={styles.centerSubtitle}>Initializing Health Connect...</Text>
                <TouchableOpacity style={styles.button} onPress={initializeAndRefresh}>
                    <Text style={styles.buttonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (<ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
    >
        <LinearGradient colors={["#0288D1", "#0277BD", "#01579B"]} style={styles.header}>
            <View style={styles.headerContent}>
                <View style={styles.headerTop}>
                    <Text style={styles.greeting}>Daily Steps</Text>
                    {(loading || refreshing) && (
                        <View style={styles.loadingIndicator}>
                            <Text style={styles.loadingText}>•••</Text>
                        </View>
                    )}
                    <View style={styles.goalDisplay}>
                        <Text style={styles.goalText}>Goal: {stepGoal.toLocaleString()}</Text>
                    </View>
                </View>
                <StepCounter steps={totalSteps} goal={stepGoal} />
                <Text style={styles.motivationalText}>{getMotivationalMessage()}</Text>
            </View>
        </LinearGradient>

        <View style={styles.content}>
            {!canReadSteps() && permissions.length === 0 && (
                <View style={styles.permissionCard}>
                    <Ionicons name="warning-outline" size={24} color="#FF6B35" />
                    <View style={styles.permissionContent}>
                        <Text style={styles.permissionTitle}>Permissions Required</Text>
                        <Text style={styles.permissionText}>
                            Health Connect permissions are needed to track your steps.
                        </Text>
                        <TouchableOpacity
                            style={styles.permissionButton}
                            onPress={requestPermissions}
                            disabled={loading}
                        >
                            <Text style={styles.permissionButtonText}>
                                {loading ? 'Requesting...' : 'Grant Permissions'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {permissions.length > 0 && !canReadSteps() && (
                <View style={styles.permissionCard}>
                    <Ionicons name="information-circle-outline" size={24} color="#4A90E2" />
                    <View style={styles.permissionContent}>
                        <Text style={styles.permissionTitle}>Permission Status</Text>
                        <Text style={styles.permissionText}>
                            Some permissions are granted but steps reading permission might be missing.
                            Try refreshing or re-granting permissions.
                        </Text>
                        <TouchableOpacity
                            style={styles.permissionButton}
                            onPress={requestPermissions}
                            disabled={loading}
                        >
                            <Text style={styles.permissionButtonText}>
                                {loading ? 'Requesting...' : 'Update Permissions'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <View style={styles.statsContainer}>
                <Text style={styles.sectionTitle}>Today's Statistics</Text>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <View style={styles.statContent}>
                            <View style={styles.statTextContainer}>
                                <Text style={styles.statNumber}>{totalSteps.toLocaleString()}</Text>
                                <Text style={styles.statLabel}>Steps</Text>
                            </View>
                            <View style={styles.statIcon}>
                                <Ionicons name="footsteps-outline" size={24} color="#4A90E2" />
                            </View>
                        </View>
                    </View>

                    <View style={styles.statCard}>
                        <View style={styles.statContent}>
                            <View style={styles.statTextContainer}>
                                <Text style={styles.statNumber}>{distanceKm}</Text>
                                <Text style={styles.statLabel}>Kilometers</Text>
                            </View>
                            <View style={styles.statIcon}>
                                <Ionicons name="map-outline" size={24} color="#52C41A" />
                            </View>
                        </View>
                    </View>

                    <View style={styles.statCard}>
                        <View style={styles.statContent}>
                            <View style={styles.statTextContainer}>
                                <Text style={styles.statNumber}>{caloriesBurned}</Text>
                                <Text style={styles.statLabel}>Calories</Text>
                            </View>
                            <View style={styles.statIcon}>
                                <Ionicons name="flame-outline" size={24} color="#FF6B35" />
                            </View>
                        </View>
                    </View>

                    <View style={styles.statCard}>
                        <View style={styles.statContent}>
                            <View style={styles.statTextContainer}>
                                <Text style={styles.statNumber}>{Math.round(progressPercentage)}</Text>
                                <Text style={styles.statLabel}>% Goal</Text>
                            </View>
                            <View style={styles.statIcon}>
                                <Ionicons name="trophy-outline" size={24} color="#9C27B0" />
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Progress Details</Text>

                <View style={styles.progressCard}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressTitle}>Steps Remaining</Text>
                        <Text style={styles.progressValue}>{remainingSteps.toLocaleString()}</Text>
                    </View>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progressPercentage}%` }
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>
                        {progressPercentage.toFixed(1)}% of daily goal completed
                    </Text>
                </View>

                <View style={styles.tipsCard}>
                    <Text style={styles.tipsTitle}>💡 Daily Tips</Text>
                    <Text style={styles.tipText}>• Take the stairs instead of elevators</Text>
                    <Text style={styles.tipText}>• Park farther away from entrances</Text>
                    <Text style={styles.tipText}>• Take walking breaks every hour</Text>
                    <Text style={styles.tipText}>• Walk while talking on the phone</Text>
                </View>
            </View>

            {!isHealthConnectAvailable && (
                <View style={styles.errorCard}>
                    <Ionicons name="warning-outline" size={32} color="#FF6B35" />
                    <Text style={styles.errorText}>
                        Health Connect is not available on this device
                    </Text>
                </View>
            )}
        </View>
    </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        backgroundColor: "#f8f9fa",
    },
    centerTitle: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#333",
        textAlign: "center",
        marginBottom: 10,
    },
    centerSubtitle: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 22,
    },
    button: {
        backgroundColor: "#0288D1",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 120,
    },
    buttonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
    header: {
        paddingTop: 50,
        paddingBottom: 15,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerContent: {
        alignItems: "center",
        paddingHorizontal: 20,
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        marginBottom: 5,
        position: "relative",
    },
    goalButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        justifyContent: "center",
        alignItems: "center",
        position: "absolute",
        right: 0,
        zIndex: 1,
    },
    goalDisplay: {
        position: "absolute",
        right: 0,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    loadingIndicator: {
        position: "absolute",
        right: 120,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: "white",
        fontSize: 12,
        fontWeight: "bold",
    },
    greeting: {
        fontSize: 24,
        fontWeight: "700",
        color: "white",
        textAlign: "center",
    },
    motivationalText: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.9)",
        marginTop: 10,
        textAlign: "center",
    },
    content: {
        flex: 1,
        paddingTop: 20,
    },
    progressContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 30,
        marginVertical: 0,
    },
    progressTextContainer: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    stepsNumber: {
        fontSize: 28,
        fontWeight: "bold",
        color: "white",
    },
    stepsLabel: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.9)",
        marginTop: 4,
    },
    goalText: {
        fontSize: 12,
        color: "rgba(255, 255, 255, 0.7)",
        marginTop: 2,
    },
    progressRing: {
        transform: [{ rotate: "-90deg" }],
    },
    statsContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1a1a1a",
        marginBottom: 15,
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
        padding: 15,
        alignItems: "center",
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
    },
    actionButton: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 15,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginLeft: 12,
    },
    progressCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 20,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    progressHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    progressTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
    },
    progressValue: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#4A90E2",
    },
    progressBar: {
        height: 8,
        backgroundColor: "#f0f0f0",
        borderRadius: 4,
        marginBottom: 8,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: "#4A90E2",
        borderRadius: 4,
    },
    progressText: {
        fontSize: 12,
        color: "#666",
        textAlign: "center",
    },
    tipsCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 20,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    tipsTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
        marginBottom: 12,
    },
    tipText: {
        fontSize: 14,
        color: "#666",
        marginBottom: 6,
        lineHeight: 20,
    },
    errorCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 30,
        margin: 20,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    errorText: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginTop: 10,
    },
    infoCard: {
        backgroundColor: "#E3F2FD",
        borderRadius: 16,
        padding: 15,
        marginTop: 15,
        flexDirection: "row",
        alignItems: "flex-start",
    },
    infoContent: {
        flex: 1,
        marginLeft: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1976D2",
        marginBottom: 6,
    },
    infoText: {
        fontSize: 14,
        color: "#424242",
        lineHeight: 20,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        width: width * 0.9,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    closeButton: {
        padding: 5,
    },
    editInput: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: "row",
        gap: 10,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
    },
    cancelButton: {
        backgroundColor: "#f0f0f0",
    },
    saveButton: {
        backgroundColor: "#0288D1",
    },
    cancelButtonText: {
        color: "#666",
        fontWeight: "600",
    },
    saveButtonText: {
        color: "white",
        fontWeight: "600",
    },
    // Permission styles
    permissionCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 20,
        margin: 20,
        flexDirection: "row",
        alignItems: "flex-start",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    permissionContent: {
        flex: 1,
        marginLeft: 12,
    },
    permissionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
        marginBottom: 8,
    },
    permissionText: {
        fontSize: 14,
        color: "#666",
        lineHeight: 20,
        marginBottom: 12,
    },
    permissionButton: {
        backgroundColor: "#0288D1",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        alignSelf: "flex-start",
    },
    permissionButtonText: {
        color: "white",
        fontSize: 14,
        fontWeight: "600",
    },
});
