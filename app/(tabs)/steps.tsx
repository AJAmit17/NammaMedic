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
    Modal,
    TextInput,
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
    aggregateGroupByPeriod,
    aggregateGroupByDuration
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

interface WeeklyStepData {
    date: string;
    dayName: string;
    steps: number;
    isToday: boolean;
}

interface DayDetailData {
    date: string;
    steps: number;
    distance: number;
    calories: number;
    hourlyData: Array<{
        hour: number;
        steps: number;
    }>;
}

export default function StepsScreen() {
    const [currentSteps, setCurrentSteps] = useState(0);
    const [stepGoal, setStepGoal] = useState(10000);
    const [isHealthConnectAvailable, setIsHealthConnectAvailable] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [permissions, setPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [weeklyStepsData, setWeeklyStepsData] = useState<WeeklyStepData[]>([]);
    const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
    const [goalInputValue, setGoalInputValue] = useState('');
    const [isDayDetailModalVisible, setIsDayDetailModalVisible] = useState(false);
    const [selectedDayData, setSelectedDayData] = useState<DayDetailData | null>(null);
    const [loadingDayDetail, setLoadingDayDetail] = useState(false);

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
        setLoading(true);
        try {
            // Get current local time and create proper date range for today
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const currentDate = now.getDate();

            const today = new Date(currentYear, currentMonth, currentDate, 0, 0, 0, 0);
            const endOfDay = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);

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

            // Load weekly data
            await loadWeeklyStepsData();
        } catch (error) {
            console.error('Error loading steps data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadWeeklyStepsData = async () => {
        try {
            // Get current local time and create proper date range
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const currentDate = now.getDate();
            // const today = new Date(currentYear, currentMonth, currentDate);

            const endDate = new Date(currentYear, currentMonth, currentDate, 23, 59, 59, 999);
            const startDate = new Date(currentYear, currentMonth, currentDate - 6, 0, 0, 0, 0);

            // Use aggregateGroupByPeriod to get daily step counts
            const weeklyData = await aggregateGroupByPeriod({
                recordType: 'Steps',
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                },
                timeRangeSlicer: {
                    period: 'DAYS',
                    length: 1,
                },
            });

            const weeklyStepsArray: WeeklyStepData[] = [];

            for (let i = 6; i >= 0; i--) {
                // Create date in local timezone
                const date = new Date(currentYear, currentMonth, currentDate - i);
                const dayName = getDayName(date);
                const isToday = i === 0;
                const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                let steps = 0;
                if (weeklyData && Array.isArray(weeklyData)) {
                    const matchingData = weeklyData.find((item: any) => {
                        // Get the date part of the startTime in YYYY-MM-DD format
                        const itemDateString = item.startTime.split('T')[0];
                        return itemDateString === dateString;
                    });

                    if (matchingData && matchingData.result && matchingData.result.COUNT_TOTAL !== undefined) {
                        steps = matchingData.result.COUNT_TOTAL;
                    }
                }

                weeklyStepsArray.push({
                    date: dateString,
                    dayName,
                    steps,
                    isToday,
                });
            }

            setWeeklyStepsData(weeklyStepsArray);
        } catch (error) {
            console.error('Error loading weekly steps data:', error);
            // Fallback: create empty data for the past 7 days using same date logic
            const fallbackData: WeeklyStepData[] = [];

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const currentDate = now.getDate();

            for (let i = 6; i >= 0; i--) {
                const date = new Date(currentYear, currentMonth, currentDate - i);
                const isToday = i === 0; // i === 0 means today
                const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                fallbackData.push({
                    date: dateString,
                    dayName: getDayName(date),
                    steps: 0,
                    isToday,
                });
            }

            setWeeklyStepsData(fallbackData);
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

    const openGoalModal = () => {
        setGoalInputValue(stepGoal.toString());
        setIsGoalModalVisible(true);
    };

    const closeGoalModal = () => {
        setIsGoalModalVisible(false);
        setGoalInputValue('');
    };

    const saveStepGoal = async () => {
        try {
            const newGoal = parseInt(goalInputValue);

            if (isNaN(newGoal) || newGoal < 1000 || newGoal > 50000) {
                Alert.alert(
                    'Invalid Goal',
                    'Please enter a valid goal between 1,000 and 50,000 steps.'
                );
                return;
            }

            await AsyncStorage.setItem('stepsGoal', newGoal.toString());
            setStepGoal(newGoal);

            closeGoalModal();

            Alert.alert(
                'Goal Updated',
                `Your daily step goal has been updated to ${newGoal.toLocaleString()} steps.`,
                [{ text: 'OK' }]
            );

        } catch (error) {
            console.error('Error saving step goal:', error);
            Alert.alert('Error', 'Failed to save step goal. Please try again.');
        }
    };

    const loadDayDetailData = async (selectedDate: string) => {
        setLoadingDayDetail(true);
        try {
            const date = new Date(selectedDate);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            // Get hourly step data using aggregateGroupByDuration
            const hourlyData = await aggregateGroupByDuration({
                recordType: 'Steps',
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startOfDay.toISOString(),
                    endTime: endOfDay.toISOString(),
                },
                timeRangeSlicer: {
                    duration: 'HOURS',
                    length: 1,
                },
            });

            // Process hourly data
            const hourlySteps: Array<{ hour: number; steps: number }> = [];
            let totalSteps = 0;

            for (let hour = 0; hour < 24; hour++) {
                let hourSteps = 0;

                if (hourlyData && Array.isArray(hourlyData)) {
                    const targetDateString = selectedDate; // Already in YYYY-MM-DD format

                    const hourData = hourlyData.find((item: any) => {
                        const itemDate = new Date(item.startTime);
                        const itemDateString = item.startTime.split('T')[0]; // YYYY-MM-DD format
                        return itemDate.getHours() === hour && itemDateString === targetDateString;
                    });

                    if (hourData && hourData.result && hourData.result.COUNT_TOTAL !== undefined) {
                        hourSteps = hourData.result.COUNT_TOTAL;
                    }
                }

                hourlySteps.push({ hour, steps: hourSteps });
                totalSteps += hourSteps;
            }

            // Calculate derived metrics
            const distance = (totalSteps * 0.0008); // km
            const calories = Math.round((totalSteps / 1000) * 20);

            const dayDetailData: DayDetailData = {
                date: selectedDate,
                steps: totalSteps,
                distance,
                calories,
                hourlyData: hourlySteps,
            };

            setSelectedDayData(dayDetailData);
            setIsDayDetailModalVisible(true);

        } catch (error) {
            console.error('Error loading day detail data:', error);
            Alert.alert('Error', 'Failed to load detailed step data for this day.');
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
                    return;
                }
            }

            const currentPermissions = await checkPermissionStatus();
            setPermissions(currentPermissions);

            await loadStepGoal();

            if (currentPermissions.length > 0) {
                await loadStepsData(); // This will also load weekly data
            } else {
                setCurrentSteps(0);
                setWeeklyStepsData([]);
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
                    <TouchableOpacity style={styles.goalDisplay} onPress={openGoalModal}>
                        <Text style={styles.goalText}>Goal: {stepGoal.toLocaleString()}</Text>
                        <Ionicons name="create-outline" size={12} color="rgba(255, 255, 255, 0.8)" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>
                <StepCounter steps={totalSteps} goal={stepGoal} />
                <Text style={styles.motivationalText}>{getMotivationalMessage()}</Text>
            </View>
        </LinearGradient>

        <View style={styles.content}>
            {permissions.length === 0 && (
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

            {/* Weekly Progress Section */}
            <View style={styles.statsContainer}>
                <View style={styles.sectionHeaderWithHint}>
                    <Text style={styles.sectionTitle}>Weekly Progress</Text>
                    {/* <Text style={styles.sectionHint}>Tap any day for detailed view</Text> */}
                </View>
                <View style={styles.weeklyProgressCard}>
                    <View style={styles.weeklyChart}>
                        {weeklyStepsData.map((dayData, index) => {
                            const progressPercent = Math.min((dayData.steps / stepGoal) * 100, 100);
                            const maxHeight = 120;
                            const barHeight = Math.max((progressPercent / 100) * maxHeight, 4);

                            return (
                                <TouchableOpacity
                                    key={dayData.date}
                                    style={styles.chartBar}
                                    onPress={() => loadDayDetailData(dayData.date)}
                                    disabled={loadingDayDetail}
                                >
                                    <View style={[styles.barContainer, { height: maxHeight }]}>
                                        <View
                                            style={[
                                                styles.bar,
                                                {
                                                    height: barHeight,
                                                    backgroundColor: dayData.isToday ? '#0288D1' : progressPercent >= 100 ? '#52C41A' : '#9E9E9E'
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.dayLabel, dayData.isToday && styles.todayLabel]}>
                                        {dayData.isToday ? 'TODAY' : dayData.dayName}
                                    </Text>
                                    <Text style={styles.dateLabel}>
                                        {formatDate(dayData.date)}
                                    </Text>
                                    <Text style={[styles.stepsCountLabel, dayData.isToday && styles.todayStepsLabel]}>
                                        {dayData.steps > 999 ? `${(dayData.steps / 1000).toFixed(1)}k` : dayData.steps.toString()}
                                    </Text>
                                    {dayData.isToday && (
                                        <View style={styles.todayBadge}>
                                            <Text style={styles.todayBadgeText}>•</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.weeklyStats}>
                        <View style={styles.weeklyStatItem}>
                            <Text style={styles.weeklyStatValue}>
                                {weeklyStepsData.reduce((sum, day) => sum + day.steps, 0).toLocaleString()}
                            </Text>
                            <Text style={styles.weeklyStatLabel}>Total Steps</Text>
                        </View>
                        <View style={styles.weeklyStatItem}>
                            <Text style={styles.weeklyStatValue}>
                                {Math.round(weeklyStepsData.reduce((sum, day) => sum + day.steps, 0) / 7).toLocaleString()}
                            </Text>
                            <Text style={styles.weeklyStatLabel}>Daily Average</Text>
                        </View>
                        <View style={styles.weeklyStatItem}>
                            <Text style={styles.weeklyStatValue}>
                                {weeklyStepsData.filter(day => day.steps >= stepGoal).length}/7
                            </Text>
                            <Text style={styles.weeklyStatLabel}>Goals Met</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <View style={styles.tipsCard}>
                    <Text style={styles.tipsTitle}>💡 Daily Tips</Text>
                    <Text style={styles.tipText}>• Take the stairs instead of elevators</Text>
                    <Text style={styles.tipText}>• Park farther away from entrances</Text>
                    <Text style={styles.tipText}>• Take walking breaks every hour</Text>
                    <Text style={styles.tipText}>• Walk while talking on the phone</Text>
                </View>

                <View style={styles.infoCard}>
                    <Ionicons name="information-circle-outline" size={20} color="#1976D2" />
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>Custom Step Goal</Text>
                        <Text style={styles.infoText}>
                            Tap on your goal at the top to customize it. Your goal is stored locally and helps track your daily progress.
                        </Text>
                    </View>
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

        {/* Goal Setting Modal */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={isGoalModalVisible}
            onRequestClose={closeGoalModal}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Set Daily Step Goal</Text>
                        <TouchableOpacity onPress={closeGoalModal} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.modalDescription}>
                        Choose a realistic daily step goal. Most health experts recommend 8,000-10,000 steps per day.
                    </Text>

                    <TextInput
                        style={styles.editInput}
                        value={goalInputValue}
                        onChangeText={setGoalInputValue}
                        placeholder="Enter step goal (e.g., 8000)"
                        keyboardType="numeric"
                        maxLength={5}
                        selectTextOnFocus
                    />

                    <View style={styles.presetGoals}>
                        <Text style={styles.presetTitle}>Quick Select:</Text>
                        <View style={styles.presetButtons}>
                            {[5000, 8000, 10000, 12000, 15000].map((goal) => (
                                <TouchableOpacity
                                    key={goal}
                                    style={[
                                        styles.presetButton,
                                        goalInputValue === goal.toString() && styles.presetButtonSelected
                                    ]}
                                    onPress={() => setGoalInputValue(goal.toString())}
                                >
                                    <Text style={[
                                        styles.presetButtonText,
                                        goalInputValue === goal.toString() && styles.presetButtonTextSelected
                                    ]}>
                                        {goal.toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton]}
                            onPress={closeGoalModal}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.saveButton]}
                            onPress={saveStepGoal}
                        >
                            <Text style={styles.saveButtonText}>Save Goal</Text>
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
                                        <Ionicons name="footsteps-outline" size={24} color="#4A90E2" />
                                        <Text style={styles.summaryValue}>{selectedDayData.steps.toLocaleString()}</Text>
                                        <Text style={styles.summaryLabel}>Steps</Text>
                                    </View>
                                    <View style={styles.summaryItem}>
                                        <Ionicons name="map-outline" size={24} color="#52C41A" />
                                        <Text style={styles.summaryValue}>{selectedDayData.distance.toFixed(1)}</Text>
                                        <Text style={styles.summaryLabel}>km</Text>
                                    </View>
                                    <View style={styles.summaryItem}>
                                        <Ionicons name="flame-outline" size={24} color="#FF6B35" />
                                        <Text style={styles.summaryValue}>{selectedDayData.calories}</Text>
                                        <Text style={styles.summaryLabel}>Calories</Text>
                                    </View>
                                </View>

                                {/* Goal Progress */}
                                <View style={styles.goalProgressSection}>
                                    <Text style={styles.goalProgressTitle}>Goal Progress</Text>
                                    <View style={styles.goalProgressBar}>
                                        <View style={[
                                            styles.goalProgressFill,
                                            { width: `${Math.min((selectedDayData.steps / stepGoal) * 100, 100)}%` }
                                        ]} />
                                    </View>
                                    <Text style={styles.goalProgressText}>
                                        {selectedDayData.steps >= stepGoal
                                            ? `🎉 Goal achieved! +${(selectedDayData.steps - stepGoal).toLocaleString()} extra steps`
                                            : `${(stepGoal - selectedDayData.steps).toLocaleString()} steps remaining`
                                        }
                                    </Text>
                                </View>
                            </View>

                            {/* Hourly Breakdown */}
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
                                            const maxStepsInHour = Math.max(...selectedDayData.hourlyData.map(h => h.steps));
                                            const barHeight = maxStepsInHour > 0 ? (hourData.steps / maxStepsInHour) * 110 : 0;
                                            // Show step counts for all bars with steps > 0 since we have more space now
                                            const showSteps = hourData.steps > 0; return (
                                                <View key={hourData.hour} style={styles.hourlyBarContainer}>
                                                    {/* Step count above bar */}
                                                    {showSteps && (
                                                        <Text style={styles.hourSteps}>
                                                            {hourData.steps > 999 ? `${(hourData.steps / 1000).toFixed(1)}k` : hourData.steps}
                                                        </Text>
                                                    )}
                                                    <View style={styles.hourlyBar}>
                                                        <View style={[
                                                            styles.hourlyBarFill,
                                                            {
                                                                height: Math.max(barHeight, 4),
                                                                backgroundColor: hourData.steps > 0 ? '#4A90E2' : '#E0E0E0'
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
                                    <Text style={styles.hourlyLegendText}>Peak Activity: {
                                        (() => {
                                            const peakHour = selectedDayData.hourlyData.reduce((prev, current) =>
                                                prev.steps > current.steps ? prev : current
                                            );
                                            return peakHour.steps > 0 ? `${formatHourRange(peakHour.hour)} (${peakHour.steps.toLocaleString()} steps)` : 'No activity recorded';
                                        })()
                                    }</Text>
                                </View>
                            </View>
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
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.3)",
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
        marginBottom: 10,
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
    // Weekly Progress Styles
    weeklyProgressCard: {
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
    weeklyChart: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    chartBar: {
        alignItems: "center",
        flex: 1,
        marginHorizontal: 2,
    },
    barContainer: {
        justifyContent: "flex-end",
        alignItems: "center",
        marginBottom: 8,
    },
    bar: {
        width: 24,
        borderRadius: 12,
        minHeight: 4,
    },
    dayLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#666",
        marginTop: 4,
    },
    todayLabel: {
        color: "#0288D1",
        fontWeight: "700",
    },
    dateLabel: {
        fontSize: 10,
        color: "#999",
        marginTop: 2,
    },
    stepsCountLabel: {
        fontSize: 10,
        color: "#999",
        marginTop: 2,
        fontWeight: "500",
    },
    todayStepsLabel: {
        color: "#0288D1",
        fontWeight: "600",
    },
    weeklyStats: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
    },
    weeklyStatItem: {
        alignItems: "center",
    },
    weeklyStatValue: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
    },
    weeklyStatLabel: {
        fontSize: 12,
        color: "#666",
        marginTop: 4,
    },
    // Goal Modal Styles
    modalDescription: {
        fontSize: 14,
        color: "#666",
        lineHeight: 20,
        marginBottom: 20,
        textAlign: "center",
    },
    presetGoals: {
        marginBottom: 20,
    },
    presetTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#333",
        marginBottom: 10,
    },
    presetButtons: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    presetButton: {
        backgroundColor: "#f0f0f0",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    presetButtonSelected: {
        backgroundColor: "#0288D1",
        borderColor: "#0288D1",
    },
    presetButtonText: {
        fontSize: 12,
        color: "#666",
        fontWeight: "500",
    },
    presetButtonTextSelected: {
        color: "white",
        fontWeight: "600",
    },
    // Section Header Styles
    sectionHeaderWithHint: {
        marginBottom: 15,
    },
    sectionHint: {
        fontSize: 12,
        color: "#999",
        marginTop: 4,
        textAlign: "center",
        fontStyle: "italic",
    },
    // Day Detail Modal Styles
    dayDetailModalContent: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        width: width * 0.95,
        maxHeight: "90%",
    },
    loadingContainer: {
        padding: 40,
        alignItems: "center",
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
        justifyContent: "space-around",
        marginBottom: 16,
    },
    summaryItem: {
        alignItems: "center",
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
        backgroundColor: "#4A90E2",
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
    // Today Badge Styles
    todayBadge: {
        position: "absolute",
        bottom: -8,
        left: "50%",
        marginLeft: -4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#0288D1",
        justifyContent: "center",
        alignItems: "center",
    },
    todayBadgeText: {
        fontSize: 12,
        color: "#0288D1",
        fontWeight: "bold",
    },
});
