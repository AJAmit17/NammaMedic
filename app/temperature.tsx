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

interface TemperatureProps {
    celsius: number
    fahrenheit: number
}

interface WeeklyTemperatureData {
    date: string;
    dayName: string;
    averageTemp: number;
    maxTemp: number;
    minTemp: number;
    isToday: boolean;
}

interface DayDetailData {
    date: string;
    averageTemp: number;
    maxTemp: number;
    minTemp: number;
    category: string;
    hourlyData: Array<{
        hour: number;
        temperature: number;
    }>;
}

function TemperatureGauge({ celsius, fahrenheit }: TemperatureProps) {
    const [gaugeAnimation] = useState(new Animated.Value(0))
    
    const getTempCategory = (temp: number) => {
        if (temp < 36.1) return { category: "Low", color: "#4FC3F7" }
        if (temp <= 37.2) return { category: "Normal", color: "#4CAF50" }
        if (temp <= 38.0) return { category: "Mild Fever", color: "#FF9800" }
        if (temp <= 39.0) return { category: "Moderate Fever", color: "#FF5722" }
        return { category: "High Fever", color: "#F44336" }
    }

    const tempInfo = getTempCategory(celsius)
    const gaugeSize = width * 0.7

    useEffect(() => {
        Animated.timing(gaugeAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
        }).start()
    }, [celsius])

    const fillHeight = gaugeAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, (celsius - 35) / 7 * 100], // Scale from 35°C to 42°C
        extrapolate: "clamp",
    })

    return (
        <View style={styles.tempContainer}>
            <View style={[styles.thermometer, { height: gaugeSize }]}>
                <View style={styles.thermometerBulb}>
                    <View style={[styles.thermometerBulbInner, { backgroundColor: tempInfo.color }]} />
                </View>
                <View style={styles.thermometerTube}>
                    <Animated.View style={[
                        styles.thermometerFill,
                        { 
                            height: fillHeight,
                            backgroundColor: tempInfo.color 
                        }
                    ]} />
                </View>
                <View style={styles.thermometerScale}>
                    {[42, 40, 38, 36, 34].map((temp) => (
                        <View key={temp} style={styles.scaleMarker}>
                            <Text style={styles.scaleText}>{temp}°</Text>
                        </View>
                    ))}
                </View>
            </View>
            
            <View style={styles.tempReadings}>
                <Text style={styles.tempCelsius}>{celsius.toFixed(1)}°C</Text>
                <Text style={styles.tempFahrenheit}>{fahrenheit.toFixed(1)}°F</Text>
                <View style={[styles.categoryBadge, { backgroundColor: tempInfo.color }]}>
                    <Text style={styles.categoryText}>{tempInfo.category}</Text>
                </View>
            </View>
        </View>
    )
}

export default function TemperatureScreen() {
    const [bodyTemperature, setBodyTemperature] = useState(36.5) // Normal body temperature in Celsius
    const [animatedValue] = useState(new Animated.Value(0))
    const [isHealthConnectInitialized, setIsHealthConnectInitialized] = useState(false)
    const [healthPermissions, setHealthPermissions] = useState<any[]>([])
    const [tempRecordIds, setTempRecordIds] = useState<string[]>([])

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false)
    const [newTemperature, setNewTemperature] = useState("")
    const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>('C')
    const [isLoading, setIsLoading] = useState(false)

    // Refresh control state
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Weekly data states
    const [weeklyTempData, setWeeklyTempData] = useState<WeeklyTemperatureData[]>([])
    const [isDayDetailModalVisible, setIsDayDetailModalVisible] = useState(false)
    const [selectedDayData, setSelectedDayData] = useState<DayDetailData | null>(null)
    const [loadingDayDetail, setLoadingDayDetail] = useState(false)

    // Convert Celsius to Fahrenheit
    const celsiusToFahrenheit = (celsius: number): number => {
        return (celsius * 9/5) + 32
    }

    // Convert Fahrenheit to Celsius
    const fahrenheitToCelsius = (fahrenheit: number): number => {
        return (fahrenheit - 32) * 5/9
    }

    // Get today's date string for storage key
    const getTodayKey = () => {
        const today = new Date()
        return `temp_${today.getFullYear()}_${today.getMonth()}_${today.getDate()}`
    }

    // Check if we can write body temperature data
    const canWriteTemperature = (): boolean => {
        return healthPermissions.some(
            permission => permission.recordType === 'BodyTemperature' && permission.accessType === 'write'
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
            console.log("Current Temperature permissions:", grantedPermissions.filter(p => p.recordType === 'BodyTemperature'))
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

    // Write body temperature to Health Connect
    const writeTemperatureToHealth = async (celsius: number) => {
        if (!isHealthConnectInitialized || !canWriteTemperature()) {
            return;
        }

        try {
            const now = new Date().toISOString();
            const deviceInfo = getDeviceMetadata();
            
            const record: any = {
                recordType: 'BodyTemperature',
                temperature: {
                    inCelsius: celsius
                },
                measurementLocation: 1, // Oral
                startTime: now,
                endTime: now,
                metadata: {
                    recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
                    device: deviceInfo,
                },
            }

            //@ts-ignore
            const recordIds = await insertRecords([record])
            console.log("Temperature record created:", recordIds)
            
            // Store the record ID for potential deletion later
            if (recordIds && recordIds.length > 0) {
                setTempRecordIds(prevIds => [...prevIds, recordIds[0]]);
                // Also save to AsyncStorage to persist across app restarts
                try {
                    const storedIds = await AsyncStorage.getItem('temp_record_ids') || '[]';
                    const idsArray = JSON.parse(storedIds);
                    await AsyncStorage.setItem('temp_record_ids', JSON.stringify([...idsArray, recordIds[0]]));
                } catch (error) {
                    console.error('Error saving record ID:', error);
                }
            }
            
            return recordIds?.[0] || null;
        } catch (error) {
            console.error("Error writing temperature to Health Connect:", error)
            throw error
        }
    }

    // Add temperature measurement
    const addTemperature = async (temp: number, unit: 'C' | 'F') => {
        let celsius = temp;
        if (unit === 'F') {
            celsius = fahrenheitToCelsius(temp);
        }

        if (celsius < 30 || celsius > 45) {
            Alert.alert("Invalid Reading", "Please enter a valid temperature reading.")
            return
        }

        setIsLoading(true)
        try {
            // Write to Health Connect if available
            let recordId: string | null = null
            if (isHealthConnectInitialized && canWriteTemperature()) {
                const result = await writeTemperatureToHealth(celsius)
                recordId = result || null
                if (recordId) {
                    setTempRecordIds(prev => [...prev, recordId!])
                }
            }

            // Update local state
            setBodyTemperature(celsius)

            // Save to local storage
            await saveTemperature(celsius)

            // Reload weekly data
            await loadWeeklyTempData()

            Alert.alert("Success", "Temperature recorded successfully!")
        } catch (error) {
            console.error("Error adding temperature:", error)
            Alert.alert("Error", "Failed to record temperature. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    // Show add temperature modal
    const showAddTempModal = () => {
        setNewTemperature("")
        setShowAddModal(true)
    }

    // Handle temperature submission
    const handleTempSubmit = async () => {
        const temp = Number.parseFloat(newTemperature)

        if (isNaN(temp)) {
            Alert.alert("Invalid Input", "Please enter a valid temperature.")
            return
        }

        await addTemperature(temp, temperatureUnit)
        setShowAddModal(false)
    }

    // Sync temperature data with Google Health Connect
    const syncWithHealthConnect = async () => {
        if (!isHealthConnectInitialized || !canWriteTemperature()) {
            return false;
        }

        try {
            // Get today's date range
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

            // Read temperature data from Health Connect for today
            const tempData = await readRecords("BodyTemperature", {
                timeRangeFilter: {
                    operator: "between",
                    startTime: startOfDay.toISOString(),
                    endTime: endOfDay.toISOString(),
                },
            });

            if (tempData.records.length > 0) {
                // Get the most recent reading
                const latestReading = tempData.records[tempData.records.length - 1];
                const celsius = (latestReading as any).temperature?.inCelsius || 36.5;

                // Update local state and storage
                setBodyTemperature(celsius);
                await saveTemperature(celsius);
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
            if (isHealthConnectInitialized && canWriteTemperature()) {
                const syncSuccess = await syncWithHealthConnect();
                if (syncSuccess) {
                    await loadWeeklyTempData();
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

    // Load weekly temperature data
    const loadWeeklyTempData = async () => {
        try {
            if (!isHealthConnectInitialized || !canWriteTemperature()) {
                // Fallback: create empty data for the past 7 days
                const fallbackData: WeeklyTemperatureData[] = [];
                const today = new Date();

                for (let i = 6; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    const dateString = date.toISOString().split('T')[0];

                    fallbackData.push({
                        date: dateString,
                        dayName: getDayName(date),
                        averageTemp: 0,
                        maxTemp: 0,
                        minTemp: 0,
                        isToday: i === 0,
                    });
                }

                setWeeklyTempData(fallbackData);
                return;
            }

            const tempData = await readRecords('BodyTemperature', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    endTime: new Date().toISOString(),
                },
            });

            const weeklyTempArray: WeeklyTemperatureData[] = [];
            const today = new Date();

            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateString = date.toISOString().split('T')[0];

                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date);
                dayEnd.setHours(23, 59, 59, 999);

                const dayTempData = tempData.records
                    .filter((record: any) => {
                        const recordDate = new Date(record.startTime);
                        return recordDate >= dayStart && recordDate <= dayEnd;
                    });

                let averageTemp = 0, maxTemp = 0, minTemp = 0;
                if (dayTempData.length > 0) {
                    const tempValues = dayTempData.map((record: any) => (record as any).temperature?.inCelsius || 0);
                    averageTemp = tempValues.reduce((sum: number, temp: number) => sum + temp, 0) / tempValues.length;
                    maxTemp = Math.max(...tempValues);
                    minTemp = Math.min(...tempValues);
                }

                weeklyTempArray.push({
                    date: dateString,
                    dayName: getDayName(date),
                    averageTemp: Math.round(averageTemp * 10) / 10,
                    maxTemp: Math.round(maxTemp * 10) / 10,
                    minTemp: Math.round(minTemp * 10) / 10,
                    isToday: i === 0,
                });
            }

            setWeeklyTempData(weeklyTempArray);
        } catch (error) {
            console.error('Error loading weekly temperature data:', error);
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

            const dayTempData = await readRecords('BodyTemperature', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startOfDay.toISOString(),
                    endTime: endOfDay.toISOString(),
                },
            });

            // Process hourly data
            const hourlyTemp: Array<{ hour: number; temperature: number }> = [];
            let avgTemp = 0, maxTemp = 0, minTemp = 999;

            for (let hour = 0; hour < 24; hour++) {
                const hourStart = new Date(date);
                hourStart.setHours(hour, 0, 0, 0);
                const hourEnd = new Date(date);
                hourEnd.setHours(hour, 59, 59, 999);

                const hourData = dayTempData.records.filter((record: any) => {
                    const recordDate = new Date(record.startTime);
                    return recordDate >= hourStart && recordDate <= hourEnd;
                });

                let hourTemp = 0;
                if (hourData.length > 0) {
                    const hourTempValues = hourData.map((record: any) => (record as any).temperature?.inCelsius || 0);
                    hourTemp = hourTempValues.reduce((sum: number, temp: number) => sum + temp, 0) / hourTempValues.length;
                }

                hourlyTemp.push({ hour, temperature: Math.round(hourTemp * 10) / 10 });
            }

            // Calculate day averages
            const validReadings = dayTempData.records.filter((record: any) => (record as any).temperature?.inCelsius > 0);
            if (validReadings.length > 0) {
                const tempValues = validReadings.map((record: any) => (record as any).temperature?.inCelsius);
                avgTemp = tempValues.reduce((sum: number, temp: number) => sum + temp, 0) / tempValues.length;
                maxTemp = Math.max(...tempValues);
                minTemp = Math.min(...tempValues);
            }

            const getTempCategory = (temp: number) => {
                if (temp < 36.1) return "Low";
                if (temp <= 37.2) return "Normal";
                if (temp <= 38.0) return "Mild Fever";
                if (temp <= 39.0) return "Moderate Fever";
                return "High Fever";
            };

            const dayDetailData: DayDetailData = {
                date: selectedDate,
                averageTemp: Math.round(avgTemp * 10) / 10,
                maxTemp: Math.round(maxTemp * 10) / 10,
                minTemp: minTemp === 999 ? 0 : Math.round(minTemp * 10) / 10,
                category: getTempCategory(avgTemp),
                hourlyData: hourlyTemp,
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

    const getFullDateString = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Load saved temperature for today
    const loadTemperature = async () => {
        try {
            const todayKey = getTodayKey()
            const savedTemp = await AsyncStorage.getItem(todayKey)
            if (savedTemp) {
                setBodyTemperature(Number.parseFloat(savedTemp))
            }
        } catch (error) {
            console.error("Error loading temperature:", error)
        }
    }

    // Save temperature
    const saveTemperature = async (celsius: number) => {
        try {
            const todayKey = getTodayKey()
            await AsyncStorage.setItem(todayKey, celsius.toString())
        } catch (error) {
            console.error("Error saving temperature:", error)
        }
    }

    // Load saved record IDs
    const loadTempRecordIds = async () => {
        try {
            const savedIds = await AsyncStorage.getItem('temp_record_ids')
            if (savedIds) {
                setTempRecordIds(JSON.parse(savedIds))
            }
        } catch (error) {
            console.error("Error loading temperature record IDs:", error)
        }
    }

    useEffect(() => {
        loadTemperature()
        initializeHealthConnect()
        loadTempRecordIds()
        loadWeeklyTempData()
    }, [])

    const getTempStatusMessage = () => {
        const temp = bodyTemperature;
        
        if (temp < 36.1) return "❄️ Low body temperature - stay warm and consult a doctor";
        if (temp <= 37.2) return "✅ Normal body temperature - you're healthy!";
        if (temp <= 38.0) return "⚡ Mild fever - monitor and rest";
        if (temp <= 39.0) return "⚠️ Moderate fever - consider medical attention";
        return "🚨 High fever - seek immediate medical attention!";
    };

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    colors={["#FF6B35"]}
                    tintColor="#FF6B35"
                    title="Syncing with Google Health..."
                    titleColor="#FF6B35"
                />
            }
        >
            <LinearGradient colors={["#FF6B35", "#F7931E", "#FFAB00"]} style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.headerTop}>
                        <View style={{ width: 40 }} />
                        <Text style={styles.greeting}>Body Temperature</Text>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={showAddTempModal}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                    <TemperatureGauge 
                        celsius={bodyTemperature} 
                        fahrenheit={celsiusToFahrenheit(bodyTemperature)} 
                    />
                    <Text style={styles.motivationalText}>{getTempStatusMessage()}</Text>
                </View>
            </LinearGradient>

            <View style={styles.content}>
                {/* Health Connect Integration */}
                {isHealthConnectInitialized && !canWriteTemperature() && (
                    <View style={styles.infoCard}>
                        <Ionicons name="thermometer-outline" size={24} color="#F7931E" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>Connect to Health App</Text>
                            <Text style={styles.infoText}>
                                Sync your temperature readings with your health app for better tracking and insights.
                            </Text>
                            <TouchableOpacity
                                style={[styles.actionButton, { marginTop: 10, backgroundColor: "#F7931E" }]}
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
                                    <Text style={styles.statNumber}>{bodyTemperature.toFixed(1)}</Text>
                                    <Text style={styles.statLabel}>°C</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="thermometer" size={24} color="#FF6B35" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>{celsiusToFahrenheit(bodyTemperature).toFixed(1)}</Text>
                                    <Text style={styles.statLabel}>°F</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="thermometer" size={24} color="#4CAF50" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.statCard}>
                            <View style={styles.statContent}>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statNumber}>
                                        {Math.abs(bodyTemperature - 37.0).toFixed(1)}
                                    </Text>
                                    <Text style={styles.statLabel}>From Normal</Text>
                                </View>
                                <View style={styles.statIcon}>
                                    <Ionicons name="analytics" size={24} color="#FF9800" />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Weekly Tracking */}
                <View style={styles.weeklyContainer}>
                    <Text style={styles.sectionTitle}>Weekly Tracking</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weeklyScroll}>
                        {weeklyTempData.map((day, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.dayCard, day.isToday && styles.todayCard]}
                                onPress={() => loadDayDetailData(day.date)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.dayName, day.isToday && styles.todayText]}>{day.dayName}</Text>
                                <Text style={[styles.dayDate, day.isToday && styles.todayText]}>{formatDate(day.date)}</Text>
                                {day.averageTemp > 0 ? (
                                    <>
                                        <Text style={[styles.dayTemp, day.isToday && styles.todayText]}>
                                            {day.averageTemp}°C
                                        </Text>
                                        {day.maxTemp > 0 && (
                                            <Text style={[styles.dayRange, day.isToday && styles.todayText]}>
                                                {day.minTemp}-{day.maxTemp}
                                            </Text>
                                        )}
                                    </>
                                ) : (
                                    <Text style={[styles.noTemp, day.isToday && styles.todayText]}>No data</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* Add Temperature Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showAddModal}
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Temperature Reading</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Temperature</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={temperatureUnit === 'C' ? "36.5" : "97.7"}
                                    value={newTemperature}
                                    onChangeText={setNewTemperature}
                                    keyboardType="decimal-pad"
                                    maxLength={5}
                                />
                                <TouchableOpacity
                                    style={[styles.unitButton, temperatureUnit === 'C' && styles.unitButtonActive]}
                                    onPress={() => setTemperatureUnit('C')}
                                >
                                    <Text style={[styles.unitText, temperatureUnit === 'C' && styles.unitTextActive]}>°C</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.unitButton, temperatureUnit === 'F' && styles.unitButtonActive]}
                                    onPress={() => setTemperatureUnit('F')}
                                >
                                    <Text style={[styles.unitText, temperatureUnit === 'F' && styles.unitTextActive]}>°F</Text>
                                </TouchableOpacity>
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
                                onPress={handleTempSubmit}
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
                                            <Ionicons name="thermometer-outline" size={24} color="#FF6B35" />
                                            <Text style={styles.summaryValue}>{selectedDayData.averageTemp}°C</Text>
                                            <Text style={styles.summaryLabel}>Average</Text>
                                        </View>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="trending-up-outline" size={24} color="#FF5722" />
                                            <Text style={styles.summaryValue}>{selectedDayData.maxTemp}°C</Text>
                                            <Text style={styles.summaryLabel}>Max</Text>
                                        </View>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="medical-outline" size={24} color="#4CAF50" />
                                            <Text style={styles.summaryValue}>{selectedDayData.category}</Text>
                                            <Text style={styles.summaryLabel}>Category</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Hourly Breakdown */}
                                {selectedDayData.hourlyData && selectedDayData.hourlyData.length > 0 && (
                                    <View style={styles.hourlyBreakdownCard}>
                                        <Text style={styles.hourlyTitle}>Hourly Temperature</Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={true}
                                            style={styles.hourlyScrollContainer}
                                            contentContainerStyle={styles.hourlyScrollContent}
                                        >
                                            <View style={styles.hourlyChart}>
                                                {selectedDayData.hourlyData.map((hourData) => {
                                                    const maxTemp = Math.max(...selectedDayData.hourlyData.map(h => h.temperature));
                                                    const minTemp = Math.min(...selectedDayData.hourlyData.map(h => h.temperature));
                                                    const range = maxTemp - minTemp;
                                                    const barHeight = range > 0 ? ((hourData.temperature - minTemp) / range) * 100 : 0;
                                                    const hasReading = hourData.temperature > 0;

                                                    return (
                                                        <View key={hourData.hour} style={styles.hourlyBarContainer}>
                                                            {hasReading && (
                                                                <Text style={styles.hourSteps}>
                                                                    {hourData.temperature.toFixed(1)}
                                                                </Text>
                                                            )}
                                                            <View style={styles.hourlyBar}>
                                                                <View style={[
                                                                    styles.hourlyBarFill,
                                                                    {
                                                                        height: Math.max(barHeight, 4),
                                                                        backgroundColor: hasReading ? '#FF6B35' : '#E0E0E0'
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
    tempContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 20,
        gap: 40,
    },
    thermometer: {
        width: 60,
        alignItems: "center",
        position: "relative",
    },
    thermometerBulb: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        justifyContent: "center",
        alignItems: "center",
        position: "absolute",
        bottom: 0,
        zIndex: 2,
    },
    thermometerBulbInner: {
        width: 30,
        height: 30,
        borderRadius: 15,
    },
    thermometerTube: {
        width: 20,
        flex: 1,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        borderRadius: 10,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        justifyContent: "flex-end",
        marginBottom: 20,
        overflow: "hidden",
    },
    thermometerFill: {
        width: "100%",
        borderRadius: 10,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    thermometerScale: {
        position: "absolute",
        right: -30,
        top: 0,
        bottom: 20,
        justifyContent: "space-between",
    },
    scaleMarker: {
        alignItems: "flex-start",
    },
    scaleText: {
        color: "white",
        fontSize: 12,
        fontWeight: "600",
    },
    tempReadings: {
        alignItems: "center",
    },
    tempCelsius: {
        fontSize: 36,
        fontWeight: "bold",
        color: "white",
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    tempFahrenheit: {
        fontSize: 18,
        color: "rgba(255, 255, 255, 0.9)",
        marginTop: 5,
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    categoryBadge: {
        marginTop: 10,
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
        backgroundColor: "#FF6B35",
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
    dayTemp: {
        fontSize: 14,
        fontWeight: "700",
        color: "#333",
        marginBottom: 2,
    },
    dayRange: {
        fontSize: 9,
        color: "#999",
    },
    noTemp: {
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
    unitButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: "#f0f0f0",
    },
    unitButtonActive: {
        backgroundColor: "#FF6B35",
    },
    unitText: {
        fontSize: 14,
        color: "#666",
        fontWeight: "600",
    },
    unitTextActive: {
        color: "white",
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
        backgroundColor: "#FF6B35",
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
