import React, { useState, useEffect } from 'react';
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
import { useHealthData, getWeekRange, formatHealthValue } from '../../hooks/health';
import { WeeklyHealthDataManager } from '../../lib/weeklyHealthdata';

const { width } = Dimensions.get('window');

interface StepCounterProps {
    steps: number;
    goal: number;
}

export interface WeeklyStepData {
    date: string;
    dayName: string;
    steps: number;
    isToday: boolean;
}

function StepCounter({ steps, goal }: StepCounterProps) {
    const percentage = Math.min((steps / goal) * 100, 100);
    const circumference = 2 * Math.PI * 90;
    const strokeDashoffset = circumference - (circumference * percentage) / 100;

    return (
        <View style={styles.stepCounter}>
            <LinearGradient
                colors={['#4CAF50', '#388E3C']}
                style={styles.stepCounterGradient}
            >
                <View style={styles.stepCounterContent}>
                    <Svg width={200} height={200} style={styles.progressRing}>
                        <Circle
                            cx={100}
                            cy={100}
                            r={90}
                            stroke="rgba(255, 255, 255, 0.3)"
                            strokeWidth={12}
                            fill="none"
                        />
                        <Circle
                            cx={100}
                            cy={100}
                            r={90}
                            stroke="white"
                            strokeWidth={12}
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            transform="rotate(-90 100 100)"
                        />
                    </Svg>
                    <View style={styles.stepCounterText}>
                        <Text style={styles.stepCount}>{steps.toLocaleString()}</Text>
                        <Text style={styles.stepLabel}>steps</Text>
                        <Text style={styles.stepGoal}>Goal: {goal.toLocaleString()}</Text>
                        <Text style={styles.stepPercentage}>{Math.round(percentage)}%</Text>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
}

export default function StepsScreen() {
    const [stepGoal, setStepGoal] = useState(10000);
    const [goalModalVisible, setGoalModalVisible] = useState(false);
    const [newGoal, setNewGoal] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const {
        hasPermissions,
        dailyData,
        weeklyData,
        loadDailyData,
        loadWeeklyData,
        requestPermissions,
        isLoading
    } = useHealthData();

    const todaySteps = dailyData?.steps || 0;

    useFocusEffect(
        React.useCallback(() => {
            loadStepGoal();
            loadTodaysData();
        }, [])
    );

    useEffect(() => {
        if (hasPermissions) {
            loadWeeklyStepsData();
        }
    }, [hasPermissions]);

    const loadStepGoal = async () => {
        try {
            const savedGoal = await AsyncStorage.getItem('stepGoal');
            if (savedGoal) {
                setStepGoal(parseInt(savedGoal));
            }
        } catch (error) {
            console.error('Error loading step goal:', error);
        }
    };

    const saveStepGoal = async (goal: number) => {
        try {
            await AsyncStorage.setItem('stepGoal', goal.toString());
            setStepGoal(goal);
        } catch (error) {
            console.error('Error saving step goal:', error);
        }
    };

    const loadTodaysData = async () => {
        if (!hasPermissions) {
            await requestPermissions();
            return;
        }
        
        try {
            await loadDailyData();
        } catch (error) {
            console.error('Error loading today\'s steps:', error);
        }
    };

    const loadWeeklyStepsData = async () => {
        try {
            const weekRange = getWeekRange(0);
            const data = await loadWeeklyData(weekRange);
            
            if (data) {
                await WeeklyHealthDataManager.saveWeeklyData(
                    data,
                    weekRange.startDate,
                    weekRange.endDate
                );
            }
        } catch (error) {
            console.error('Error loading weekly steps data:', error);
        }
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await loadTodaysData();
            if (hasPermissions) {
                await loadWeeklyStepsData();
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setRefreshing(false);
        }
    }, [hasPermissions]);

    const handleSetGoal = () => {
        const goal = parseInt(newGoal);
        if (isNaN(goal) || goal <= 0) {
            Alert.alert('Invalid Goal', 'Please enter a valid step goal');
            return;
        }
        
        saveStepGoal(goal);
        setGoalModalVisible(false);
        setNewGoal('');
    };

    const getMotivationalMessage = () => {
        const percentage = (todaySteps / stepGoal) * 100;
        
        if (percentage >= 100) return "🎉 Goal achieved! You're crushing it!";
        if (percentage >= 75) return "💪 Almost there! Keep it up!";
        if (percentage >= 50) return "🚶‍♂️ Halfway there! You're doing great!";
        if (percentage >= 25) return "👍 Good start! Let's keep moving!";
        return "🌟 Every step counts! Let's get started!";
    };

    const renderPermissionPrompt = () => (
        <View style={styles.permissionContainer}>
            <Ionicons name="footsteps" size={80} color="#ccc" />
            <Text style={styles.permissionTitle}>Enable Step Tracking</Text>
            <Text style={styles.permissionText}>
                Allow access to your health data to track your daily steps and monitor your progress
            </Text>
            <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermissions}
            >
                <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.permissionGradient}>
                    <Ionicons name="medical" size={20} color="white" />
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    if (!hasPermissions) {
        return (
            <ScrollView 
                style={styles.container}
                contentContainerStyle={styles.centerContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {renderPermissionPrompt()}
            </ScrollView>
        );
    }

    return (
        <ScrollView 
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header with step counter */}
            <View style={styles.header}>
                <StepCounter steps={todaySteps} goal={stepGoal} />
                
                <TouchableOpacity
                    style={styles.goalButton}
                    onPress={() => {
                        setNewGoal(stepGoal.toString());
                        setGoalModalVisible(true);
                    }}
                >
                    <Ionicons name="settings-outline" size={20} color="#4CAF50" />
                    <Text style={styles.goalButtonText}>Set Goal</Text>
                </TouchableOpacity>
            </View>

            {/* Motivational message */}
            <View style={styles.motivationCard}>
                <Text style={styles.motivationMessage}>{getMotivationalMessage()}</Text>
            </View>

            {/* Quick Stats */}
            <View style={styles.statsContainer}>
                {/* <HealthMetricCard
                    title="Distance"
                    value={formatHealthValue(dailyData?.distance || 0, 'm')}
                    unit=""
                    icon="location"
                    gradient={['#2196F3', '#1976D2']}
                />
                <HealthMetricCard
                    title="Daily Goal"
                    value={Math.round(((todaySteps / stepGoal) * 100))}
                    unit="%"
                    icon="trophy"
                    gradient={['#FF9800', '#F57C00']}
                    progress={(todaySteps / stepGoal) * 100}
                /> */}
            </View>

            {/* Weekly Chart */}
            {weeklyData && (
                // <HealthWeeklyChart
                //     data={weeklyData.steps}
                //     title="Weekly Step Progress"
                //     color="#4CAF50"
                //     unit="steps"
                // />
                <Text>Hello</Text>
            )}

            {/* Achievement Section */}
            <View style={styles.achievementSection}>
                <Text style={styles.sectionTitle}>This Week</Text>
                {weeklyData && (
                    <View style={styles.weeklyStats}>
                        <View style={styles.weeklyStatItem}>
                            <Text style={styles.weeklyStatNumber}>
                                {weeklyData.steps.reduce((sum, day) => sum + day.value, 0).toLocaleString()}
                            </Text>
                            <Text style={styles.weeklyStatLabel}>Total Steps</Text>
                        </View>
                        <View style={styles.weeklyStatItem}>
                            <Text style={styles.weeklyStatNumber}>
                                {Math.round(weeklyData.steps.reduce((sum, day) => sum + day.value, 0) / 7).toLocaleString()}
                            </Text>
                            <Text style={styles.weeklyStatLabel}>Daily Average</Text>
                        </View>
                        <View style={styles.weeklyStatItem}>
                            <Text style={styles.weeklyStatNumber}>
                                {weeklyData.steps.filter(day => day.value >= stepGoal).length}
                            </Text>
                            <Text style={styles.weeklyStatLabel}>Goals Met</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Goal Setting Modal */}
            <Modal
                visible={goalModalVisible}
                animationType="slide"
                transparent
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Set Daily Step Goal</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newGoal}
                            onChangeText={setNewGoal}
                            placeholder="Enter step goal"
                            keyboardType="numeric"
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setGoalModalVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSaveButton}
                                onPress={handleSetGoal}
                            >
                                <Text style={styles.modalSaveText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    centerContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: 'white',
    },
    stepCounter: {
        alignItems: 'center',
        marginBottom: 20,
    },
    stepCounterGradient: {
        borderRadius: 120,
        padding: 20,
    },
    stepCounterContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressRing: {
        position: 'absolute',
    },
    stepCounterText: {
        alignItems: 'center',
        marginTop: 20,
    },
    stepCount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
    },
    stepLabel: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 8,
    },
    stepGoal: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    stepPercentage: {
        fontSize: 18,
        fontWeight: '600',
        color: 'white',
        marginTop: 4,
    },
    goalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    goalButtonText: {
        marginLeft: 8,
        color: '#4CAF50',
        fontWeight: '600',
    },
    motivationCard: {
        backgroundColor: 'white',
        margin: 16,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    motivationMessage: {
        fontSize: 18,
        textAlign: 'center',
        color: '#333',
        fontWeight: '500',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
    },
    achievementSection: {
        backgroundColor: 'white',
        margin: 16,
        padding: 20,
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    weeklyStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    weeklyStatItem: {
        alignItems: 'center',
    },
    weeklyStatNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    weeklyStatLabel: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    permissionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 20,
        marginBottom: 16,
    },
    permissionText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    permissionButton: {
        borderRadius: 25,
        overflow: 'hidden',
    },
    permissionGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    permissionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 16,
        width: width * 0.9,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalCancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        marginRight: 8,
        backgroundColor: '#f5f5f5',
    },
    modalSaveButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        marginLeft: 8,
        backgroundColor: '#4CAF50',
    },
    modalCancelText: {
        textAlign: 'center',
        fontSize: 16,
        color: '#666',
    },
    modalSaveText: {
        textAlign: 'center',
        fontSize: 16,
        color: 'white',
        fontWeight: '600',
    },
});
