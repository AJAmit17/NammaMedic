import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions, Animated, Modal, TextInput, RefreshControl } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import AsyncStorage from "@react-native-async-storage/async-storage"
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
import * as Device from "expo-device"
import {
    checkPermissionStatus,
    requestEssentialPermissionsWithSettings
} from "@/utils/healthUtils"

const { width, height } = Dimensions.get("window")

interface BloodPressureProps {
    systolic: number
    diastolic: number
    pulse?: number
}

interface WeeklyBloodPressureData {
    date: string;
    dayName: string;
    systolic: number;
    diastolic: number;
    pulse?: number;
    isToday: boolean;
}

interface DayDetailData {
    date: string;
    systolic: number;
    diastolic: number;
    pulse?: number;
    category: string;
    hourlyData: Array<{
        hour: number;
        systolic: number;
        diastolic: number;
        pulse?: number;
    }>;
}

function BloodPressureGauge({ systolic, diastolic, pulse }: BloodPressureProps) {
    const [gaugeAnimation] = useState(new Animated.Value(0))
    
    const getBPCategory = (sys: number, dia: number) => {
        if (sys < 90 || dia < 60) return { category: "Low", color: "#4CAF50" }
        if (sys < 120 && dia < 80) return { category: "Normal", color: "#2196F3" }
        if (sys < 130 && dia < 80) return { category: "Elevated", color: "#FF9800" }
        if (sys < 140 || dia < 90) return { category: "Stage 1", color: "#FF5722" }
        if (sys < 180 || dia < 120) return { category: "Stage 2", color: "#F44336" }
        return { category: "Crisis", color: "#9C27B0" }
    }

    const bpInfo = getBPCategory(systolic, diastolic)
    const gaugeSize = width * 0.7

    useEffect(() => {
        Animated.timing(gaugeAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
        }).start()
    }, [systolic, diastolic])

    return (
        <View style={styles.gaugeContainer}>
            <View style={[styles.gauge, { width: gaugeSize, height: gaugeSize }]}>
                <View style={[styles.gaugeRing, { borderColor: bpInfo.color }]}>
                    <View style={styles.gaugeInner}>
                        <Text style={styles.systolicReading}>{systolic}</Text>
                        <Text style={styles.bpSeparator}>/</Text>
                        <Text style={styles.diastolicReading}>{diastolic}</Text>
                        <Text style={styles.bpUnit}>mmHg</Text>
                        {pulse && <Text style={styles.pulseReading}>♥ {pulse} bpm</Text>}
                    </View>
                </View>
                <View style={[styles.categoryBadge, { backgroundColor: bpInfo.color }]}>
                    <Text style={styles.categoryText}>{bpInfo.category}</Text>
                </View>
            </View>
        </View>
    )
}

export default function BloodPressureScreen() {
    const [systolicPressure, setSystolicPressure] = useState(120)
    const [diastolicPressure, setDiastolicPressure] = useState(80)
    const [pulse, setPulse] = useState(72)
    const [animatedValue] = useState(new Animated.Value(0))
    const [isHealthConnectInitialized, setIsHealthConnectInitialized] = useState(false)
    const [healthPermissions, setHealthPermissions] = useState<any[]>([])
    const [bpRecordIds, setBpRecordIds] = useState<string[]>([])

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false)
    const [newSystolic, setNewSystolic] = useState("")
    const [newDiastolic, setNewDiastolic] = useState("")
    const [newPulse, setNewPulse] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    // Refresh control state
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Weekly data states
    const [weeklyBPData, setWeeklyBPData] = useState<WeeklyBloodPressureData[]>([])
    const [isDayDetailModalVisible, setIsDayDetailModalVisible] = useState(false)
    const [selectedDayData, setSelectedDayData] = useState<DayDetailData | null>(null)
    const [loadingDayDetail, setLoadingDayDetail] = useState(false)

    // Get today's date string for storage key
    const getTodayKey = () => {
        const today = new Date()
        return `bp_${today.getFullYear()}_${today.getMonth()}_${today.getDate()}`
    }

    // Check if we can write blood pressure data
    const canWriteBloodPressure = (): boolean => {
        return healthPermissions.some(
            permission => permission.recordType === 'BloodPressure' && permission.accessType === 'write'
        )
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
                await checkCurrentPermissions();
            }
        } catch (error) {
            console.error('Error initializing Health Connect:', error);
        }
    }

    // Check current permissions
    const checkCurrentPermissions = async () => {
        try {
            const grantedPermissions = await checkPermissionStatus()
            setHealthPermissions(grantedPermissions)
            console.log("Current BP permissions:", grantedPermissions.filter(p => p.recordType === 'BloodPressure'))
        } catch (error) {
            console.error("Error checking permissions:", error)
        }
    }

    // Request health permissions
    const requestHealthPermissions = async () => {
        try {
            await requestEssentialPermissionsWithSettings()
            await checkCurrentPermissions()
        } catch (error) {
            console.error("Error requesting permissions:", error)
            Alert.alert("Error", "Failed to request health permissions. Please try again.")
        }
    }

    // Get device metadata for Health Connect
    const getDeviceMetadata = () => {
        return {
            manufacturer: Device.manufacturer || 'Unknown',
            model: Device.modelName || Device.deviceName || 'Unknown',
            type: DeviceType.TYPE_PHONE
        };
    };

    // Write blood pressure to Health Connect
    const writeBloodPressureToHealth = async (systolic: number, diastolic: number, pulseRate?: number) => {
        if (!isHealthConnectInitialized || !canWriteBloodPressure()) {
            return;
        }

        try {
            const now = new Date().toISOString();
            const deviceInfo = getDeviceMetadata();
            
            const record: any = {
                recordType: 'BloodPressure',
                systolic: {
                    inMillimetersOfMercury: systolic
                },
                diastolic: {
                    inMillimetersOfMercury: diastolic
                },
                bodyPosition: 1, // Sitting
                measurementLocation: 1, // Left upper arm
                startTime: now,
                endTime: now,
                metadata: {
                    recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
                    device: deviceInfo,
                },
            }

            //@ts-ignore
            const recordIds = await insertRecords([record])
            console.log("Blood pressure record created:", recordIds)
            
            // Store the record ID for potential deletion later
            if (recordIds && recordIds.length > 0) {
                setBpRecordIds(prevIds => [...prevIds, recordIds[0]]);
                // Also save to AsyncStorage to persist across app restarts
                try {
                    const storedIds = await AsyncStorage.getItem('bp_record_ids') || '[]';
                    const idsArray = JSON.parse(storedIds);
                    await AsyncStorage.setItem('bp_record_ids', JSON.stringify([...idsArray, recordIds[0]]));
                } catch (error) {
                    console.error('Error saving record ID:', error);
                }
            }
            
            return recordIds?.[0] || null;
        } catch (error) {
            console.error("Error writing blood pressure to Health Connect:", error)
            throw error
        }
    }

    // Add blood pressure measurement
    const addBloodPressure = async (systolic: number, diastolic: number, pulseRate?: number) => {
        if (systolic < 60 || systolic > 250 || diastolic < 40 || diastolic > 150) {
            Alert.alert("Invalid Reading", "Please enter valid blood pressure values.")
            return
        }

        setIsLoading(true)
        try {
            // Write to Health Connect if available
            let recordId: string | null = null
            if (isHealthConnectInitialized && canWriteBloodPressure()) {
                const result = await writeBloodPressureToHealth(systolic, diastolic, pulseRate)
                recordId = result || null
                if (recordId) {
                    setBpRecordIds(prev => [...prev, recordId!])
                }
            }

            // Update local state
            setSystolicPressure(systolic)
            setDiastolicPressure(diastolic)
            if (pulseRate) setPulse(pulseRate)

            // Save to local storage
            await saveBloodPressure(systolic, diastolic, pulseRate)

            // Reload weekly data
            await loadWeeklyBPData()

            Alert.alert("Success", "Blood pressure recorded successfully!")
        } catch (error) {
            console.error("Error adding blood pressure:", error)
            Alert.alert("Error", "Failed to record blood pressure. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    // Show add blood pressure modal
    const showAddBPModal = () => {
        setNewSystolic("")
        setNewDiastolic("")
        setNewPulse("")
        setShowAddModal(true)
    }

    // Handle blood pressure submission
    const handleBPSubmit = async () => {
        const systolic = Number.parseInt(newSystolic, 10)
        const diastolic = Number.parseInt(newDiastolic, 10)
        const pulseRate = newPulse ? Number.parseInt(newPulse, 10) : undefined

        if (isNaN(systolic) || isNaN(diastolic)) {
            Alert.alert("Invalid Input", "Please enter valid numbers for blood pressure.")
            return
        }

        await addBloodPressure(systolic, diastolic, pulseRate)
        setShowAddModal(false)
    }

    // Sync blood pressure data with Google Health Connect
    const syncWithHealthConnect = async () => {
        if (!isHealthConnectInitialized || !canWriteBloodPressure()) {
            return false;
        }

        try {
            // Get today's date range
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

            // Read blood pressure data from Health Connect for today
            const bpData = await readRecords("BloodPressure", {
                timeRangeFilter: {
                    operator: "between",
                    startTime: startOfDay.toISOString(),
                    endTime: endOfDay.toISOString(),
                },
            });

            if (bpData.records.length > 0) {
                // Get the most recent reading
                const latestReading = bpData.records[bpData.records.length - 1];
                const systolic = latestReading.systolic?.inMillimetersOfMercury || 120;
                const diastolic = latestReading.diastolic?.inMillimetersOfMercury || 80;

                // Update local state and storage
                setSystolicPressure(Math.round(systolic));
                setDiastolicPressure(Math.round(diastolic));
                await saveBloodPressure(systolic, diastolic);
            }

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
            if (isHealthConnectInitialized && canWriteBloodPressure()) {
                const syncSuccess = await syncWithHealthConnect();
                if (syncSuccess) {
                    await loadWeeklyBPData();
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

    // Load weekly blood pressure data
    const loadWeeklyBPData = async () => {
        try {
            if (!isHealthConnectInitialized || !canWriteBloodPressure()) {
                // Fallback: create empty data for the past 7 days
                const fallbackData: WeeklyBloodPressureData[] = [];
                const today = new Date();

                for (let i = 6; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    const dateString = date.toISOString().split('T')[0];

                    fallbackData.push({
                        date: dateString,
                        dayName: getDayName(date),
                        systolic: 0,
                        diastolic: 0,
                        isToday: i === 0,
                    });
                }

                setWeeklyBPData(fallbackData);
                return;
            }

            const bpData = await readRecords('BloodPressure', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    endTime: new Date().toISOString(),
                },
            });

            const weeklyBPArray: WeeklyBloodPressureData[] = [];
            const today = new Date();

            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateString = date.toISOString().split('T')[0];

                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date);
                dayEnd.setHours(23, 59, 59, 999);

                const dayBPData = bpData.records
                    .filter((record: any) => {
                        const recordDate = new Date(record.startTime);
                        return recordDate >= dayStart && recordDate <= dayEnd;
                    });

                // Get the latest reading of the day
                let systolic = 0, diastolic = 0, pulse = 0;
                if (dayBPData.length > 0) {
                    const latestReading = dayBPData[dayBPData.length - 1];
                    systolic = Math.round(latestReading.systolic?.inMillimetersOfMercury || 0);
                    diastolic = Math.round(latestReading.diastolic?.inMillimetersOfMercury || 0);
                }

                weeklyBPArray.push({
                    date: dateString,
                    dayName: getDayName(date),
                    systolic,
                    diastolic,
                    pulse,
                    isToday: i === 0,
                });
            }

            setWeeklyBPData(weeklyBPArray);
        } catch (error) {
            console.error('Error loading weekly BP data:', error);
        }
    };

    const getDayName = (date: Date): string => {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return dayNames[date.getDay()];
    };

    const formatDate = (dateString: string): string => {
        const [year, month, day] = dateString.split('-').map(Number);
        return `${month}/${day}`;
    };

    // Load day detail data
    const loadDayDetailData = async (selectedDate: string) => {
        setLoadingDayDetail(true);
        try {
            const date = new Date(selectedDate);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const dayBPData = await readRecords('BloodPressure', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startOfDay.toISOString(),
                    endTime: endOfDay.toISOString(),
                },
            });

            // Process hourly data
            const hourlyBP: Array<{ hour: number; systolic: number; diastolic: number; pulse?: number }> = [];
            let avgSystolic = 0, avgDiastolic = 0, avgPulse = 0;

            for (let hour = 0; hour < 24; hour++) {
                const hourStart = new Date(date);
                hourStart.setHours(hour, 0, 0, 0);
                const hourEnd = new Date(date);
                hourEnd.setHours(hour, 59, 59, 999);

                const hourData = dayBPData.records.filter((record: any) => {
                    const recordDate = new Date(record.startTime);
                    return recordDate >= hourStart && recordDate <= hourEnd;
                });

                let systolic = 0, diastolic = 0, pulse = 0;
                if (hourData.length > 0) {
                    const latestReading = hourData[hourData.length - 1];
                    systolic = Math.round(latestReading.systolic?.inMillimetersOfMercury || 0);
                    diastolic = Math.round(latestReading.diastolic?.inMillimetersOfMercury || 0);
                }

                hourlyBP.push({ hour, systolic, diastolic, pulse });
            }

            // Calculate averages
            const validReadings = dayBPData.records;
            if (validReadings.length > 0) {
                avgSystolic = validReadings.reduce((sum: number, record: any) => 
                    sum + (record.systolic?.inMillimetersOfMercury || 0), 0) / validReadings.length;
                avgDiastolic = validReadings.reduce((sum: number, record: any) => 
                    sum + (record.diastolic?.inMillimetersOfMercury || 0), 0) / validReadings.length;
            }

            const getBPCategory = (sys: number, dia: number) => {
                if (sys < 90 || dia < 60) return "Low";
                if (sys < 120 && dia < 80) return "Normal";
                if (sys < 130 && dia < 80) return "Elevated";
                if (sys < 140 || dia < 90) return "Stage 1 High";
                if (sys < 180 || dia < 120) return "Stage 2 High";
                return "Crisis";
            };

            const dayDetailData: DayDetailData = {
                date: selectedDate,
                systolic: Math.round(avgSystolic),
                diastolic: Math.round(avgDiastolic),
                pulse: avgPulse > 0 ? Math.round(avgPulse) : undefined,
                category: getBPCategory(avgSystolic, avgDiastolic),
                hourlyData: hourlyBP,
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

    // Load saved blood pressure for today
    const loadBloodPressure = async () => {
        try {
            const todayKey = getTodayKey()
            const savedBP = await AsyncStorage.getItem(todayKey)
            if (savedBP) {
                const bpData = JSON.parse(savedBP)
                setSystolicPressure(bpData.systolic || 120)
                setDiastolicPressure(bpData.diastolic || 80)
                if (bpData.pulse) setPulse(bpData.pulse)
            }
        } catch (error) {
            console.error("Error loading blood pressure:", error)
        }
    }

    // Save blood pressure
    const saveBloodPressure = async (systolic: number, diastolic: number, pulseRate?: number) => {
        try {
            const todayKey = getTodayKey()
            const bpData = { systolic, diastolic, pulse: pulseRate }
            await AsyncStorage.setItem(todayKey, JSON.stringify(bpData))
        } catch (error) {
            console.error("Error saving blood pressure:", error)
        }
    }

    // Load saved record IDs
    const loadBPRecordIds = async () => {
        try {
            const savedIds = await AsyncStorage.getItem('bp_record_ids')
            if (savedIds) {
                setBpRecordIds(JSON.parse(savedIds))
            }
        } catch (error) {
            console.error("Error loading BP record IDs:", error)
        }
    }

    useEffect(() => {
        loadBloodPressure()
        initializeHealthConnect()
        loadBPRecordIds()
        loadWeeklyBPData()
    }, [])

    const getBPStatusMessage = () => {
        const sys = systolicPressure;
        const dia = diastolicPressure;
        
        if (sys < 90 || dia < 60) return "⚠️ Low blood pressure - consult your doctor";
        if (sys < 120 && dia < 80) return "✅ Normal blood pressure - excellent!";
        if (sys < 130 && dia < 80) return "⚡ Elevated - monitor closely";
        if (sys < 140 || dia < 90) return "⚠️ Stage 1 High - lifestyle changes needed";
        if (sys < 180 || dia < 120) return "🚨 Stage 2 High - see doctor soon";
        return "🆘 Crisis - seek immediate medical attention!";
    };

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    colors={["#E53E3E"]}
                    tintColor="#E53E3E"
                    title="Syncing with Google Health..."
                    titleColor="#E53E3E"
                />
            }
        >
            <LinearGradient colors={["#E53E3E", "#C53030", "#9B2C2C"]} style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.headerTop}>
                        <View style={{ width: 40 }} />
                        <Text style={styles.greeting}>Blood Pressure</Text>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={showAddBPModal}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                    <BloodPressureGauge systolic={systolicPressure} diastolic={diastolicPressure} pulse={pulse} />
                    <Text style={styles.motivationalText}>{getBPStatusMessage()}</Text>
                </View>
            </LinearGradient>

            <View style={styles.content}>
                {/* Health Connect Integration */}
                {isHealthConnectInitialized && !canWriteBloodPressure() && (
                    <View style={styles.infoCard}>
                        <Ionicons name="heart-outline" size={24} color="#C53030" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>Connect to Health App</Text>
                            <Text style={styles.infoText}>
                                Sync your blood pressure readings with your health data for better tracking and insights.
                            </Text>
                            <TouchableOpacity
                                style={[styles.actionButton, { marginTop: 10, backgroundColor: "#C53030" }]}
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
                    <Text style={styles.sectionTitle}>Current Reading</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{systolicPressure}</Text>
                                    <Text style={styles.statLabel}>Systolic</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="arrow-up" size={24} color="#E53E3E" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{diastolicPressure}</Text>
                                    <Text style={styles.statLabel}>Diastolic</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="arrow-down" size={24} color="#4CAF50" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{pulse}</Text>
                                    <Text style={styles.statLabel}>Pulse</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="heart" size={24} color="#FF6B9D" />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Weekly Tracking */}
                <View style={styles.weeklyContainer}>
                    <Text style={styles.sectionTitle}>Weekly Tracking</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weeklyScroll}>
                        {weeklyBPData.map((day, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.dayCard, day.isToday && styles.todayCard]}
                                onPress={() => loadDayDetailData(day.date)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.dayName, day.isToday && styles.todayText]}>{day.dayName}</Text>
                                <Text style={[styles.dayDate, day.isToday && styles.todayText]}>{formatDate(day.date)}</Text>
                                {day.systolic > 0 ? (
                                    <>
                                        <Text style={[styles.dayBP, day.isToday && styles.todayText]}>
                                            {day.systolic}/{day.diastolic}
                                        </Text>
                                        <Text style={[styles.dayUnit, day.isToday && styles.todayText]}>mmHg</Text>
                                    </>
                                ) : (
                                    <Text style={[styles.noBP, day.isToday && styles.todayText]}>No data</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* Add Blood Pressure Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showAddModal}
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Blood Pressure Reading</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Systolic (upper)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="120"
                                    value={newSystolic}
                                    onChangeText={setNewSystolic}
                                    keyboardType="numeric"
                                    maxLength={3}
                                />
                                <Text style={styles.inputUnit}>mmHg</Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Diastolic (lower)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="80"
                                    value={newDiastolic}
                                    onChangeText={setNewDiastolic}
                                    keyboardType="numeric"
                                    maxLength={3}
                                />
                                <Text style={styles.inputUnit}>mmHg</Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Pulse (optional)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="72"
                                    value={newPulse}
                                    onChangeText={setNewPulse}
                                    keyboardType="numeric"
                                    maxLength={3}
                                />
                                <Text style={styles.inputUnit}>bpm</Text>
                            </View>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => setShowAddModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalAddButton, isLoading && styles.modalButtonDisabled]}
                                onPress={handleBPSubmit}
                                disabled={isLoading}
                            >
                                <Text style={styles.modalAddText}>
                                    {isLoading ? "Recording..." : "Record"}
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
                                            <Ionicons name="arrow-up-outline" size={24} color="#E53E3E" />
                                            <Text style={styles.summaryValue}>{selectedDayData.systolic}</Text>
                                            <Text style={styles.summaryLabel}>Systolic</Text>
                                        </View>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="arrow-down-outline" size={24} color="#4CAF50" />
                                            <Text style={styles.summaryValue}>{selectedDayData.diastolic}</Text>
                                            <Text style={styles.summaryLabel}>Diastolic</Text>
                                        </View>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="medical-outline" size={24} color="#FF6B35" />
                                            <Text style={styles.summaryValue}>{selectedDayData.category}</Text>
                                            <Text style={styles.summaryLabel}>Category</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Hourly Breakdown */}
                                {selectedDayData.hourlyData && selectedDayData.hourlyData.length > 0 && (
                                    <View style={styles.hourlyBreakdownCard}>
                                        <Text style={styles.hourlyTitle}>Hourly Readings</Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={true}
                                            style={styles.hourlyScrollContainer}
                                            contentContainerStyle={styles.hourlyScrollContent}
                                        >
                                            <View style={styles.hourlyChart}>
                                                {selectedDayData.hourlyData.map((hourData) => {
                                                    const hasReading = hourData.systolic > 0 && hourData.diastolic > 0;

                                                    return (
                                                        <View key={hourData.hour} style={styles.hourlyBarContainer}>
                                                            {hasReading && (
                                                                <Text style={styles.hourSteps}>
                                                                    {hourData.systolic}/{hourData.diastolic}
                                                                </Text>
                                                            )}
                                                            <View style={styles.hourlyBar}>
                                                                <View style={[
                                                                    styles.hourlyBarFill,
                                                                    {
                                                                        height: hasReading ? 80 : 4,
                                                                        backgroundColor: hasReading ? '#E53E3E' : '#E0E0E0'
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
        paddingTop: 40,
        paddingBottom: 15,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        position: "relative",
    },
    headerContent: {
        alignItems: "center",
        paddingHorizontal: 0,
        paddingTop: 5,
    },
    headerTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        paddingHorizontal: 20,
        position: "relative",
    },
    addButton: {
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
        marginVertical: 0,
        marginTop: -20,
        textAlign: "center",
    },
    content: {
        flex: 1,
        marginVertical: 0,
        paddingTop: 20,
    },
    gaugeContainer: {
        alignItems: "center",
        marginVertical: 20,
    },
    gauge: {
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
    },
    gaugeRing: {
        width: "100%",
        height: "100%",
        borderRadius: 150,
        borderWidth: 8,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    gaugeInner: {
        alignItems: "center",
        justifyContent: "center",
    },
    systolicReading: {
        fontSize: 32,
        fontWeight: "bold",
        color: "white",
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    bpSeparator: {
        fontSize: 24,
        fontWeight: "bold",
        color: "white",
        marginHorizontal: 5,
    },
    diastolicReading: {
        fontSize: 32,
        fontWeight: "bold",
        color: "white",
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    bpUnit: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.9)",
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
        marginTop: 5,
    },
    pulseReading: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.9)",
        marginTop: 8,
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    categoryBadge: {
        position: "absolute",
        bottom: -10,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    categoryText: {
        color: "white",
        fontSize: 14,
        fontWeight: "600",
    },
    infoCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "white",
        padding: 16,
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    infoContent: {
        flex: 1,
        marginLeft: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 4,
    },
    infoText: {
        fontSize: 14,
        color: "#666",
        lineHeight: 20,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6,
    },
    buttonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
    },
    statsContainer: {
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#333",
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: "row",
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: "white",
        borderRadius: 16,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    statContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    statTextContainer: {
        flex: 1,
    },
    statNumber: {
        fontSize: 20,
        fontWeight: "700",
        color: "#333",
    },
    statLabel: {
        fontSize: 12,
        color: "#666",
        marginTop: 2,
    },
    statIcon: {
        width: 32,
        height: 32,
        justifyContent: "center",
        alignItems: "center",
    },
    weeklyContainer: {
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    weeklyScroll: {
        marginTop: 10,
    },
    dayCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginRight: 12,
        minWidth: 80,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    todayCard: {
        backgroundColor: "#E53E3E",
    },
    dayName: {
        fontSize: 12,
        fontWeight: "600",
        color: "#666",
        marginBottom: 4,
    },
    dayDate: {
        fontSize: 11,
        color: "#999",
        marginBottom: 8,
    },
    dayBP: {
        fontSize: 14,
        fontWeight: "700",
        color: "#333",
        marginBottom: 2,
    },
    dayUnit: {
        fontSize: 10,
        color: "#666",
    },
    noBP: {
        fontSize: 12,
        color: "#999",
        fontStyle: "italic",
    },
    todayText: {
        color: "white",
    },
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
        margin: 20,
        width: width * 0.9,
        maxHeight: height * 0.8,
    },
    dayDetailModalContent: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        margin: 20,
        width: width * 0.9,
        maxHeight: height * 0.8,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#333",
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    inputContainer: {
        gap: 20,
        marginBottom: 30,
    },
    inputGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        flex: 1,
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        textAlign: "center",
        width: 80,
    },
    inputUnit: {
        fontSize: 14,
        color: "#666",
        width: 40,
    },
    modalButtons: {
        flexDirection: "row",
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
    },
    modalCancelButton: {
        backgroundColor: "#f1f3f4",
    },
    modalAddButton: {
        backgroundColor: "#E53E3E",
    },
    modalButtonDisabled: {
        opacity: 0.5,
    },
    modalCancelText: {
        color: "#666",
        fontSize: 16,
        fontWeight: "600",
    },
    modalAddText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 40,
    },
    loadingText: {
        fontSize: 16,
        color: "#666",
    },
    dayDetailContent: {
        flex: 1,
    },
    daySummaryCard: {
        backgroundColor: "#f8f9fa",
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-around",
    },
    summaryItem: {
        alignItems: "center",
        flex: 1,
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: "700",
        color: "#333",
        marginTop: 8,
    },
    summaryLabel: {
        fontSize: 12,
        color: "#666",
        marginTop: 4,
    },
    hourlyBreakdownCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    hourlyTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#333",
        marginBottom: 16,
    },
    hourlyScrollContainer: {
        marginBottom: 16,
    },
    hourlyScrollContent: {
        paddingRight: 20,
    },
    hourlyChart: {
        flexDirection: "row",
        alignItems: "flex-end",
        height: 140,
    },
    hourlyBarContainer: {
        alignItems: "center",
        marginRight: 8,
        width: 40,
    },
    hourSteps: {
        fontSize: 10,
        color: "#666",
        marginBottom: 4,
        transform: [{ rotate: "90deg" }],
        width: 60,
        textAlign: "center",
    },
    hourlyBar: {
        width: 20,
        height: 100,
        justifyContent: "flex-end",
        alignItems: "center",
    },
    hourlyBarFill: {
        width: "100%",
        borderRadius: 2,
        minHeight: 4,
    },
    hourLabel: {
        fontSize: 10,
        color: "#666",
        marginTop: 8,
        transform: [{ rotate: "45deg" }],
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 40,
    },
    errorText: {
        fontSize: 16,
        color: "#999",
        textAlign: "center",
    },
})
