import { useState, useEffect, useCallback } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions, Animated, Modal, TextInput, RefreshControl } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
    initialize,
    insertRecords,
    readRecords,
    getSdkStatus,
    SdkAvailabilityStatus,
    RecordingMethod,
    DeviceType,
} from "react-native-health-connect"
import * as Device from "expo-device"
import {
    checkPermissionStatus,
    getDateRange,
    requestEssentialPermissionsWithSettings
} from "@/utils/healthUtils"
import { Appbar } from "react-native-paper"
import { router } from "expo-router"
import { LineChart } from "react-native-chart-kit";

const { width, height } = Dimensions.get("window")

interface TemperatureProps {
    // celsius: number
    // fahrenheit: number
    value: number
    unit: 'celsius' | 'fahrenheit'
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

function TemperatureGauge({ value, unit }: TemperatureProps) {
    const [gaugeAnimation] = useState(new Animated.Value(0))

    const getTempCategory = (temp: number, tempUnit: 'celsius' | 'fahrenheit') => {
        // Convert to celsius for consistent checking if fahrenheit
        const celsius = tempUnit === 'fahrenheit' ? (temp - 32) * 5 / 9 : temp

        if (celsius < 36.1) return { category: "Low", color: "#ff9100ff" }
        if (celsius <= 37.2) return { category: "Normal", color: "#ffa600ff" }
        if (celsius <= 38.0) return { category: "Mild Fever", color: "#FF9800" }
        if (celsius <= 39.0) return { category: "Moderate Fever", color: "#FF5722" }
        return { category: "High Fever", color: "#F44336" }
    }

    // Convert between units as needed
    const celsius = unit === 'fahrenheit' ? (value - 32) * 5 / 9 : value
    const fahrenheit = unit === 'celsius' ? (value * 9 / 5) + 32 : value

    const tempInfo = getTempCategory(value, unit)
    const gaugeSize = width * 0.7

    useEffect(() => {
        Animated.timing(gaugeAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
        }).start()
    }, [value])

    const fillHeight = gaugeAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, (celsius - 30) / 10 * (gaugeSize - 20)],
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
                    {[40, 38, 36, 34, 32, 30].map((temp) => (
                        <View key={temp} style={styles.scaleMarker}>
                            <Text style={styles.scaleText}>{temp}°</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.tempReadings}>
                <Text style={styles.tempCelsius}>
                    {celsius.toFixed(1)}°C
                </Text>
                <Text style={styles.tempFahrenheit}>
                    {fahrenheit.toFixed(1)}°F
                </Text>
                <View style={[styles.categoryBadge, { backgroundColor: tempInfo.color }]}>
                    <Text style={styles.categoryText}>{tempInfo.category}</Text>
                </View>
            </View>
        </View>
    )
}

export default function TemperatureScreen() {
    const [bodyTemperature, setBodyTemperature] = useState(0)
    const [isHealthConnectInitialized, setIsHealthConnectInitialized] = useState(false)
    const [healthPermissions, setHealthPermissions] = useState<any[]>([])
    const [tempRecordIds, setTempRecordIds] = useState<string[]>([])

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false)
    const [newTemperature, setNewTemperature] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    // Refresh control state
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Weekly data states
    const [weeklyTempData, setWeeklyTempData] = useState<WeeklyTemperatureData[]>([])
    const [isDayDetailModalVisible, setIsDayDetailModalVisible] = useState(false)
    const [selectedDayData, setSelectedDayData] = useState<DayDetailData | null>(null)
    const [loadingDayDetail, setLoadingDayDetail] = useState(false)

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

    const canReadTemperature = (): boolean => {
        return healthPermissions.some(
            permission => permission.recordType === 'BodyTemperature' && permission.accessType === 'read'
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
            model: Device.modelName || 'Unknown',
            type: DeviceType.TYPE_PHONE
        };
    };

    // Write body temperature to Health Connect
    const writeTemperatureToHealth = async (value: number) => {
        if (!isHealthConnectInitialized || !canWriteTemperature()) {
            return;
        }

        try {
            const now = new Date().toISOString();
            const deviceInfo = getDeviceMetadata();

            const record: any = {
                recordType: 'BodyTemperature',
                temperature: {
                    value: value,
                    unit: 'celsius',
                },
                measurementLocation: 1,
                time: now,
                metadata: {
                    recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
                    device: deviceInfo,
                }
            }

            console.log(record)

            const recordIds = await insertRecords([record])
            console.log("Temperature record created:", recordIds)

            // Store the record ID for potential deletion later
            if (recordIds && recordIds.length > 0) {
                setTempRecordIds(prevIds => [...prevIds, recordIds[0]]);
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
    const addTemperature = async (temp: number) => {
        let celsius = temp;

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

        await addTemperature(temp)
        setShowAddModal(false)
    }

    // Sync temperature data with Google Health Connect
    const syncWithHealthConnect = async (showAlert: boolean = true) => {
        if (!isHealthConnectInitialized || !canReadTemperature()) {
            return false;
        }

        try {
            const dateRange = getDateRange(1)

            const temperatureData = await readRecords("BodyTemperature", {
                timeRangeFilter: {
                    operator: "between",
                    ...dateRange,
                },
            })

            let totalTemp = 0
            let sampleCount = 0

            temperatureData.records.forEach((record: any) => {
                if (record.temperature && record.temperature.inCelsius > 0) {
                    totalTemp += record.temperature.inCelsius
                    sampleCount++
                }
            })

            setBodyTemperature(sampleCount > 0 ? Math.round((totalTemp / sampleCount) * 10) / 10 : 0)

            if (showAlert) {
                Alert.alert("Sync Successful", "Body Temperature data synced with Google Health.")
            }
            return true;
        } catch (error) {
            console.error('Error syncing with Health Connect:', error);
            return false;
        }
    }

    // Handle pull-to-refresh
    const onRefresh = async (showAlert: boolean = true) => {
        setIsRefreshing(true);
        try {
            if (isHealthConnectInitialized && canReadTemperature()) {
                const syncSuccess = await syncWithHealthConnect(showAlert);
                if (syncSuccess) {
                    await loadWeeklyTempData();
                }
            }
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setIsRefreshing(false);
        }
    }

    // Load weekly temperature data
    const loadWeeklyTempData = async () => {
        try {
            if (!isHealthConnectInitialized || !canReadTemperature()) {
                console.log('Health Connect not initialized or no read permissions');
                // Fallback: create empty data for the past 7 days
                const fallbackData: WeeklyTemperatureData[] = [];
                const today = new Date();

                for (let i = 6; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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

                const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                // Filter records for this specific day
                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date);
                dayEnd.setHours(23, 59, 59, 999);

                const dayTempData = tempData.records
                    .filter((record: any) => {
                        const recordDate = new Date(record.time);
                        return recordDate >= dayStart && recordDate <= dayEnd;
                    });

                let averageTemp = 0, maxTemp = 0, minTemp = 0;
                if (dayTempData.length > 0) {
                    const allTempValues: number[] = [];

                    dayTempData.forEach((record: any) => {
                        if (record.temperature && record.temperature.inCelsius > 0) {
                            allTempValues.push(record.temperature.inCelsius);
                        }
                    });

                    if (allTempValues.length > 0) {
                        averageTemp = Math.round((allTempValues.reduce((sum: number, temp: number) => sum + temp, 0) / allTempValues.length) * 10) / 10;
                        maxTemp = Math.round(Math.max(...allTempValues) * 10) / 10;
                        minTemp = Math.round(Math.min(...allTempValues) * 10) / 10;
                    }
                }

                weeklyTempArray.push({
                    date: dateString,
                    dayName: getDayName(date),
                    averageTemp,
                    maxTemp,
                    minTemp,
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
        console.log('Loading day detail data for:', selectedDate);

        try {
            if (!isHealthConnectInitialized || !canReadTemperature()) {
                console.log('Health Connect not initialized or no read permissions');
                Alert.alert('No Permissions', 'Temperature read permissions are required to view detailed data.');
                setLoadingDayDetail(false);
                return;
            }

            // Sync latest data silently before loading details
            await syncWithHealthConnect(false);

            const date = new Date(selectedDate);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            console.log('Fetching temperature data from:', startOfDay.toISOString(), 'to:', endOfDay.toISOString());

            const dayTempData = await readRecords('BodyTemperature', {
                timeRangeFilter: {
                    operator: 'between',
                    startTime: startOfDay.toISOString(),
                    endTime: endOfDay.toISOString(),
                },
            });

            console.log('Temperature records found:', dayTempData.records.length);

            // Process hourly data
            const hourlyTemp: Array<{ hour: number; temperature: number }> = [];
            let avgTemp = 0, maxTemp = 0, minTemp = 999;
            let totalTemp = 0, totalReadings = 0;

            for (let hour = 0; hour < 24; hour++) {
                const hourStart = new Date(date);
                hourStart.setHours(hour, 0, 0, 0);
                const hourEnd = new Date(date);
                hourEnd.setHours(hour, 59, 59, 999);

                const hourData = dayTempData.records.filter((record: any) => {
                    const recordDate = new Date(record.time);
                    return recordDate >= hourStart && recordDate <= hourEnd;
                });

                let hourTemp = 0;
                if (hourData.length > 0) {
                    // Body Temperature records with direct temperature value
                    const hourTempValues: number[] = [];

                    hourData.forEach((record: any) => {
                        if (record.temperature && record.temperature.inCelsius > 0) {
                            hourTempValues.push(record.temperature.inCelsius);
                        }
                    });

                    if (hourTempValues.length > 0) {
                        hourTemp = Math.round((hourTempValues.reduce((sum: number, temp: number) => sum + temp, 0) / hourTempValues.length) * 10) / 10;
                        totalTemp += hourTemp * hourTempValues.length;
                        totalReadings += hourTempValues.length;
                    }
                }

                hourlyTemp.push({ hour, temperature: hourTemp });
            }

            // Calculate day averages from all readings
            const allTempValues: number[] = [];
            dayTempData.records.forEach((record: any) => {
                if (record.temperature && record.temperature.inCelsius > 0) {
                    allTempValues.push(record.temperature.inCelsius);
                }
            });

            if (allTempValues.length > 0) {
                avgTemp = Math.round((allTempValues.reduce((sum: number, temp: number) => sum + temp, 0) / allTempValues.length) * 10) / 10;
                maxTemp = Math.round(Math.max(...allTempValues) * 10) / 10;
                minTemp = Math.round(Math.min(...allTempValues) * 10) / 10;
            } else {
                avgTemp = 0;
                maxTemp = 0;
                minTemp = 0;
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
                averageTemp: avgTemp,
                maxTemp: maxTemp,
                minTemp: minTemp,
                category: getTempCategory(avgTemp),
                hourlyData: hourlyTemp,
            };

            setSelectedDayData(dayDetailData);

        } catch (error) {
            console.error('Error loading day detail data:', error);
            Alert.alert('Error', 'Failed to load detailed data for the selected day.');
        } finally {
            setIsDayDetailModalVisible(true);
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
            const todayKey = getTodayKey();
            const savedTemp = await AsyncStorage.getItem(todayKey);
            if (savedTemp) {
                const tempData = JSON.parse(savedTemp);
                setBodyTemperature(tempData.temp || 72);
            }
        } catch (error) {
            console.error("Error loading temperature:", error);
        }
    }

    // Save temperature
    const saveTemperature = async (celsius: number) => {
        try {
            const todayKey = getTodayKey()
            const tempData = { temp: celsius }
            await AsyncStorage.setItem(todayKey, JSON.stringify(tempData))
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

    // Auto-refresh when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            onRefresh(false);
        }, [isHealthConnectInitialized])
    )

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
                        <Appbar.BackAction
                            onPress={() => router.back()}
                            iconColor="#ffffff"
                            size={24}
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                        />
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
                        value={bodyTemperature}
                        unit="celsius"
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
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.weeklyScroll}
                        contentContainerStyle={styles.weeklyScrollContent}
                        decelerationRate="fast"
                        snapToInterval={92}
                        snapToAlignment="start"
                    >
                        {weeklyTempData.map((day, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.dayCard, day.isToday && styles.todayCard]}
                                onPress={() => loadDayDetailData(day.date)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.dayName, day.isToday && styles.todayText]}>{day.dayName}</Text>
                                <Text style={[styles.dayDate, day.isToday && styles.todayText]}>{formatDate(day.date)}</Text>
                                {day.averageTemp > 0 ? (
                                    <>
                                        <Text style={[styles.dayTemp, day.isToday && styles.todayText]}>
                                            {day.averageTemp.toFixed(1)}°C
                                        </Text>
                                        {day.maxTemp > 0 && (
                                            <Text style={[styles.dayRange, day.isToday && styles.todayText]}>
                                                {day.minTemp.toFixed(1)}-{day.maxTemp.toFixed(1)}
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

                {/* Health Tips Section */}
                <View style={styles.tipsContainer}>
                    <Text style={styles.sectionTitle}>💡 Temperature Health Tips</Text>
                    <View style={styles.tipsCard}>
                        <View style={styles.tipItem}>
                            <Ionicons name="thermometer-outline" size={20} color="#FF6B35" />
                            <Text style={styles.tipText}>Normal body temperature ranges from 36.1°C to 37.2°C</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <Ionicons name="time-outline" size={20} color="#2196F3" />
                            <Text style={styles.tipText}>Body temperature is lowest in early morning and highest in late afternoon</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <Ionicons name="medical-outline" size={20} color="#4CAF50" />
                            <Text style={styles.tipText}>Fever above 38°C may indicate infection - consult a doctor</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <Ionicons name="water-outline" size={20} color="#00BCD4" />
                            <Text style={styles.tipText}>Stay hydrated when experiencing fever or high temperature</Text>
                        </View>
                        <View style={[styles.tipItem, styles.lastTipItem]}>
                            <Ionicons name="restaurant-outline" size={20} color="#FF9800" />
                            <Text style={styles.tipText}>Avoid heavy meals when feeling feverish - opt for light, nutritious foods</Text>
                        </View>
                    </View>
                </View>
            </View>

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
                                    placeholder="36.5"
                                    value={newTemperature}
                                    onChangeText={setNewTemperature}
                                    keyboardType="numeric"
                                    maxLength={4}
                                />
                                <Text style={styles.inputUnit}>°C</Text>
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

                        {selectedDayData ? (
                            <ScrollView style={styles.dayDetailContent} showsVerticalScrollIndicator={false}>
                                <View style={styles.daySummaryCard}>
                                    <View style={styles.summaryRow}>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="thermometer-outline" size={24} color="#FF6B35" />
                                            <Text style={styles.summaryValue}>{selectedDayData.averageTemp}°C</Text>
                                            <Text style={styles.summaryLabel}>Avg Temp</Text>
                                        </View>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="trending-up-outline" size={24} color="#FF5722" />
                                            <Text style={styles.summaryValue}>{selectedDayData.maxTemp}°C</Text>
                                            <Text style={styles.summaryLabel}>Max Temp</Text>
                                        </View>
                                        <View style={styles.summaryItem}>
                                            <Ionicons name="trending-down-outline" size={24} color="#4CAF50" />
                                            <Text style={styles.summaryValue}>{selectedDayData.minTemp}°C</Text>
                                            <Text style={styles.summaryLabel}>Min Temp</Text>
                                        </View>
                                    </View>
                                    <View style={styles.categoryContainer}>
                                        <Text style={styles.categoryLabel}>Status: </Text>
                                        <Text style={[styles.categoryValue, {
                                            color: selectedDayData.category === 'Normal' ? '#4CAF50' :
                                                selectedDayData.category === 'Mild Fever' ? '#FF9800' :
                                                    selectedDayData.category === 'Low' ? '#2196F3' : '#F44336'
                                        }]}>
                                            {selectedDayData.category}
                                        </Text>
                                    </View>
                                </View>

                                {/* Line Graph */}
                                <View style={styles.lineGraphContainer}>
                                    <Text style={styles.graphTitle}>24-Hour Temperature Trend</Text>

                                    {(() => {
                                        const hourlyData = selectedDayData.hourlyData;
                                        const hasAnyData = hourlyData.some(hour => hour.temperature > 0);

                                        // Create labels for X-axis - one for each hour (24 total), display every 3 hours
                                        const xLabels = Array.from({ length: 24 }, (_, i) =>
                                            i % 3 === 0 ? `${i}h` : ''
                                        );

                                        // Map all 24 hours - use null marker for missing data
                                        const chartData = hourlyData.map(hour => hour.temperature > 0 ? hour.temperature : 30);
                                        const hasData = hourlyData.map(hour => hour.temperature > 0);

                                        if (!hasAnyData) {
                                            return (
                                                <View style={styles.noDataContainer}>
                                                    <Ionicons name="thermometer-outline" size={48} color="#E0E0E0" />
                                                    <Text style={styles.noDataText}>No temperature data available for this day</Text>
                                                    <Text style={styles.noDataSubtext}>
                                                        Try recording some temperature readings or sync with your health app.
                                                    </Text>
                                                </View>
                                            );
                                        }

                                        return (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                <LineChart
                                                    data={{
                                                        labels: xLabels,
                                                        datasets: [
                                                            {
                                                                data: chartData,
                                                                color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                                                                strokeWidth: 2,
                                                            },
                                                            // Hidden datasets to fix Y-axis range 30-44
                                                            { data: [30], withDots: false, color: () => 'transparent' },
                                                            { data: [44], withDots: false, color: () => 'transparent' },
                                                        ],
                                                    }}
                                                    width={width * 1.5}
                                                    height={250}
                                                    yAxisSuffix="°"
                                                    yAxisInterval={1}
                                                    segments={7}
                                                    fromZero={false}
                                                    formatYLabel={(value) => `${Math.round(Number(value))}`}
                                                    chartConfig={{
                                                        backgroundColor: "#ffffff",
                                                        backgroundGradientFrom: "#ffffff",
                                                        backgroundGradientTo: "#fff8f5",
                                                        decimalPlaces: 0,
                                                        color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                                                        labelColor: (opacity = 1) => `rgba(80, 80, 80, ${opacity})`,
                                                        style: { borderRadius: 16 },
                                                        propsForDots: {
                                                            r: "4",
                                                        },
                                                        propsForBackgroundLines: {
                                                            strokeDasharray: "5,5",
                                                            stroke: "#f5e5e0",
                                                            strokeWidth: 1
                                                        },
                                                        propsForLabels: {
                                                            fontSize: 11,
                                                            fontWeight: '500',
                                                        },
                                                    }}
                                                    withDots={true}
                                                    withInnerLines={true}
                                                    withOuterLines={true}
                                                    withVerticalLines={true}
                                                    withHorizontalLines={true}
                                                    withVerticalLabels={true}
                                                    withHorizontalLabels={true}
                                                    renderDotContent={({ x, y, index }) => {
                                                        if (!hasData[index]) return null;
                                                        return (
                                                            <View
                                                                key={index}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: x - 6,
                                                                    top: y - 6,
                                                                    width: 12,
                                                                    height: 12,
                                                                    borderRadius: 6,
                                                                    backgroundColor: '#FF6B35',
                                                                    borderWidth: 2,
                                                                    borderColor: '#fff',
                                                                }}
                                                            />
                                                        );
                                                    }}
                                                    style={{
                                                        marginVertical: 8,
                                                        borderRadius: 16,
                                                    }}
                                                    onDataPointClick={(data) => {
                                                        if (hasData[data.index]) {
                                                            Alert.alert(
                                                                `${data.index}:00`,
                                                                `Temperature: ${chartData[data.index].toFixed(1)}°C`,
                                                                [{ text: "OK" }]
                                                            );
                                                        }
                                                    }}
                                                />
                                            </ScrollView>
                                        );
                                    })()}
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
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fa",
    },
    header: {
        paddingTop: 40,
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        position: "relative",
        shadowColor: "#FF6B35",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
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
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255, 255, 255, 0.25)",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    greeting: {
        fontSize: 24,
        fontWeight: "700",
        color: "white",
        textAlign: "center",
        flex: 1,
        textShadowColor: "rgba(0, 0, 0, 0.3)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    motivationalText: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.95)",
        marginVertical: 0,
        marginTop: 10,
        textAlign: "center",
        textShadowColor: "rgba(0, 0, 0, 0.2)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
        paddingHorizontal: 20,
    },
    content: {
        flex: 1,
        marginVertical: 0,
        paddingTop: 25,
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
        padding: 18,
        marginHorizontal: 20,
        marginBottom: 25,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: "rgba(255, 107, 53, 0.1)",
    },
    infoContent: {
        flex: 1,
        marginLeft: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 6,
    },
    infoText: {
        fontSize: 14,
        color: "#666",
        lineHeight: 22,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 8,
        shadowColor: "#FF6B35",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        color: "white",
        fontSize: 14,
        fontWeight: "600",
    },
    statsContainer: {
        paddingHorizontal: 20,
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#333",
        marginBottom: 18,
        letterSpacing: 0.3,
    },
    statsGrid: {
        flexDirection: "row",
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: "white",
        borderRadius: 20,
        padding: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.04)",
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
        fontSize: 22,
        fontWeight: "700",
        color: "#333",
    },
    statLabel: {
        fontSize: 12,
        color: "#666",
        marginTop: 4,
        fontWeight: "500",
    },
    statIcon: {
        width: 36,
        height: 36,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255, 107, 53, 0.1)",
        borderRadius: 18,
    },
    weeklyContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    weeklyScroll: {
        marginTop: 10,
    },
    weeklyScrollContent: {
        paddingHorizontal: 4,
    },
    dayCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 16,
        marginRight: 12,
        minWidth: 50,
        alignItems: "center",
        elevation: 1,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.04)",
    },
    todayCard: {
        backgroundColor: "#FF6B35",
        elevation: 2,
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
        fontSize: 16,
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
    // Tips Section Styles
    tipsContainer: {
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    tipsCard: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: "rgba(255, 107, 53, 0.1)",
    },
    tipItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.06)",
    },
    lastTipItem: {
        marginBottom: 0,
        paddingBottom: 0,
        borderBottomWidth: 0,
    },
    tipText: {
        flex: 1,
        fontSize: 14,
        color: "#555",
        lineHeight: 20,
        marginLeft: 12,
        fontWeight: "400",
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
        margin: 10,
        width: width * 0.95,
        height: height * 0.65,
        maxHeight: height * 0.95,
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
    lineGraphContainer: {
        marginTop: 16,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "white",
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    graphTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 12,
    },
    customChartContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingTop: 10,
    },
    yAxisContainer: {
        width: 40,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingRight: 8,
        height: 220,
    },
    yAxisLabel: {
        fontSize: 11,
        color: '#666',
        fontWeight: '500',
    },
    chartArea: {
        position: 'relative',
        backgroundColor: '#fafafa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    gridLineHorizontal: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#e8e8e8',
    },
    gridLineVertical: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: '#e8e8e8',
    },
    xAxisContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
    },
    xAxisLabel: {
        fontSize: 11,
        color: '#666',
        fontWeight: '500',
    },
    dataPointTemp: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 3,
        borderColor: '#FF6B35',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    dataPointInnerTemp: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FF6B35',
    },
    noDataOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    noDataOverlayText: {
        fontSize: 14,
        color: '#999',
        fontWeight: '500',
    },
    noDataContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 40,
    },
    noDataText: {
        fontSize: 16,
        color: "#999",
        textAlign: "center",
        marginTop: 12,
    },
    noDataSubtext: {
        fontSize: 13,
        color: "#bbb",
        textAlign: "center",
        marginTop: 8,
        paddingHorizontal: 20,
        lineHeight: 18,
    },
    // Category styles  
    categoryContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
    },
    categoryLabel: {
        fontSize: 16,
        color: "#666",
        fontWeight: "500",
    },
    categoryValue: {
        fontSize: 16,
        fontWeight: "700",
    },
    inputUnit: {
        fontSize: 14,
        color: "#666",
        width: 40,
    },
})
