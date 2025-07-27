import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions, Animated, Modal, TextInput, RefreshControl } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { LineChart } from "react-native-chart-kit"
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

const { width, height } = Dimensions.get("window")

interface HeartRateProps {
  bpm: number
}

interface WeeklyHeartRateData {
  date: string;
  dayName: string;
  averageBpm: number;
  maxBpm: number;
  minBpm: number;
  isToday: boolean;
}

interface DayDetailData {
  date: string;
  averageBpm: number;
  maxBpm: number;
  minBpm: number;
  category: string;
  hourlyData: Array<{
    hour: number;
    bpm: number;
  }>;
}

function HeartRateDisplay({ bpm }: HeartRateProps) {
  const [pulseAnimation] = useState(new Animated.Value(1))

  const getHRCategory = (heartRate: number) => {
    if (heartRate < 60) return { category: "Bradycardia", color: "#d4b401ff" }
    if (heartRate <= 100) return { category: "Normal", color: "#cc1c1cff" }
    if (heartRate <= 120) return { category: "Elevated", color: "#cc1c1cff" }
    if (heartRate <= 150) return { category: "High", color: "#cc1c1cff" }
    return { category: "Very High", color: "#cc1c1cff" }
  }

  const hrInfo = getHRCategory(bpm)
  const displaySize = width * 0.7

  return (
    <View style={styles.heartRateContainer}>
      <Animated.View style={[
        styles.heartDisplay,
        {
          width: displaySize,
          height: displaySize,
          transform: [{ scale: pulseAnimation }]
        }
      ]}>
        <View style={[styles.heartRing, { borderColor: hrInfo.color }]}>
          <View style={styles.heartInner}>
            <Ionicons name="heart" size={60} color={hrInfo.color} />
            <Text style={styles.bpmReading}>{bpm}</Text>
            <Text style={styles.bpmUnit}>BPM</Text>
          </View>
        </View>
        <View style={[styles.categoryBadge, { backgroundColor: hrInfo.color }]}>
          <Text style={styles.categoryText}>{hrInfo.category}</Text>
        </View>
      </Animated.View>
    </View>
  )
}

export default function HeartRateScreen() {
  const [heartRate, setHeartRate] = useState(72)
  const [isHealthConnectInitialized, setIsHealthConnectInitialized] = useState(false)
  const [healthPermissions, setHealthPermissions] = useState<any[]>([])
  const [hrRecordIds, setHrRecordIds] = useState<string[]>([])

  const [showAddModal, setShowAddModal] = useState(false)
  const [newHeartRate, setNewHeartRate] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const [isRefreshing, setIsRefreshing] = useState(false)

  const [weeklyHRData, setWeeklyHRData] = useState<WeeklyHeartRateData[]>([])
  const [isDayDetailModalVisible, setIsDayDetailModalVisible] = useState(false)
  const [selectedDayData, setSelectedDayData] = useState<DayDetailData | null>(null)
  const [loadingDayDetail, setLoadingDayDetail] = useState(false)

  const getTodayKey = () => {
    const today = new Date()
    return `hr_${today.getFullYear()}_${today.getMonth()}_${today.getDate()}`
  }

  // Check if we can write heart rate data
  const canWriteHeartRate = (): boolean => {
    return healthPermissions.some(
      permission => permission.recordType === 'HeartRate' && permission.accessType === 'write'
    )
  }

  // Check if we can read heart rate data
  const canReadHeartRate = (): boolean => {
    return healthPermissions.some(
      permission => permission.recordType === 'HeartRate' && permission.accessType === 'read'
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
      // console.log("Current HR permissions:", grantedPermissions.filter(p => p.recordType === 'HeartRate'))
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

  // Write heart rate to Health Connect
  const writeHeartRateToHealth = async (bpm: number) => {
    if (!isHealthConnectInitialized || !canWriteHeartRate()) {
      return;
    }

    try {
      const now = new Date().toISOString();
      const deviceInfo = getDeviceMetadata();

      const recordType = 'HeartRate';

      const record: any = {
        recordType,
        metadata: {
          recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
          device: deviceInfo,
        },
        samples: [
          {
            time: now,
            beatsPerMinute: bpm,
          },
        ],
        startTime: new Date(Date.now() - 1000).toISOString(),
        endTime: now,
      }

      //@ts-ignore
      const recordIds = await insertRecords([record])
      // console.log(`${recordType} record created:`, recordIds)

      if (recordIds && recordIds.length > 0) {
        setHrRecordIds(prevIds => [...prevIds, recordIds[0]]);
        try {
          const storedIds = await AsyncStorage.getItem('hr_record_ids') || '[]';
          const idsArray = JSON.parse(storedIds);
          await AsyncStorage.setItem('hr_record_ids', JSON.stringify([...idsArray, recordIds[0]]));
        } catch (error) {
          console.error('Error saving record ID:', error);
        }
      }

      return recordIds?.[0] || null;
    } catch (error) {
      console.error("Error writing heart rate to Health Connect:", error)
      throw error
    }
  }

  const addHeartRate = async (bpm: number) => {
    if (bpm < 30 || bpm > 220) {
      Alert.alert("Invalid Reading", "Please enter a valid heart rate between 30-220 BPM.")
      return
    }

    setIsLoading(true)
    try {
      let recordId: string | null = null
      if (isHealthConnectInitialized && canWriteHeartRate()) {
        const result = await writeHeartRateToHealth(bpm)
        recordId = result || null
        if (recordId) {
          setHrRecordIds(prev => [...prev, recordId!])
        }
      }

      setHeartRate(bpm)
      await saveHeartRate(bpm)
      await loadWeeklyHRData()

      Alert.alert("Success", "Heart rate recorded successfully!")
    } catch (error) {
      console.error("Error adding heart rate:", error)
      Alert.alert("Error", "Failed to record heart rate. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const showAddHRModal = () => {
    setNewHeartRate("")
    setShowAddModal(true)
  }

  const handleHRSubmit = async () => {
    const bpm = Number.parseInt(newHeartRate, 10)

    if (isNaN(bpm)) {
      Alert.alert("Invalid Input", "Please enter a valid heart rate.")
      return
    }

    await addHeartRate(bpm)
    setShowAddModal(false)
  }

  const syncWithHealthConnect = async () => {
    if (!isHealthConnectInitialized || !canReadHeartRate()) {
      return false;
    }

    try {
      const dateRange = getDateRange(1)

      const heartRateData = await readRecords("HeartRate", {
        timeRangeFilter: {
          operator: "between",
          ...dateRange,
        },
      })

      let totalBeats = 0
      let sampleCount = 0

      heartRateData.records.forEach((record: any) => {
        if (record.samples && record.samples.length > 0) {
          record.samples.forEach((sample: any) => {
            totalBeats += sample.beatsPerMinute
            sampleCount++
          })
        } else if (record.beatsPerMinute) {
          totalBeats += record.beatsPerMinute
          sampleCount++
        }
      })

      setHeartRate(sampleCount > 0 ? Math.round(totalBeats / sampleCount) : 0)

      Alert.alert("Sync Successful", "Heart rate data synced with Google Health.")
      return true;
    } catch (error) {
      console.error('Error syncing with Health Connect:', error);
      return false;
    }
  }

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (isHealthConnectInitialized && canReadHeartRate()) {
        const syncSuccess = await syncWithHealthConnect();
        if (syncSuccess) {
          await loadWeeklyHRData();
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

  // Load weekly heart rate data
  const loadWeeklyHRData = async () => {
    try {
      if (!isHealthConnectInitialized || !canReadHeartRate()) {
        // Fallback: create empty data for the past 7 days
        const fallbackData: WeeklyHeartRateData[] = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateString = date.toISOString().split('T')[0];

          fallbackData.push({
            date: dateString,
            dayName: getDayName(date),
            averageBpm: 0,
            maxBpm: 0,
            minBpm: 0,
            isToday: i === 0,
          });
        }

        setWeeklyHRData(fallbackData);
        return;
      }

      const hrData = await readRecords('HeartRate', {
        timeRangeFilter: {
          operator: 'between',
          startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date().toISOString(),
        },
      });

      const weeklyHRArray: WeeklyHeartRateData[] = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayHRData = hrData.records
          .filter((record: any) => {
            const recordDate = new Date(record.startTime);
            return recordDate >= dayStart && recordDate <= dayEnd;
          });

        let averageBpm = 0, maxBpm = 0, minBpm = 0;
        if (dayHRData.length > 0) {
          const allBpmValues: number[] = [];

          dayHRData.forEach((record: any) => {
            if (record.samples && record.samples.length > 0) {
              record.samples.forEach((sample: any) => {
                if (sample.beatsPerMinute && sample.beatsPerMinute > 0) {
                  allBpmValues.push(sample.beatsPerMinute);
                }
              });
            } else if (record.beatsPerMinute && record.beatsPerMinute > 0) {
              allBpmValues.push(record.beatsPerMinute);
            }
          });

          if (allBpmValues.length > 0) {
            averageBpm = Math.round(allBpmValues.reduce((sum: number, bpm: number) => sum + bpm, 0) / allBpmValues.length);
            maxBpm = Math.round(Math.max(...allBpmValues));
            minBpm = Math.round(Math.min(...allBpmValues));
          }
        }

        weeklyHRArray.push({
          date: dateString,
          dayName: getDayName(date),
          averageBpm,
          maxBpm,
          minBpm,
          isToday: i === 0,
        });
      }

      setWeeklyHRData(weeklyHRArray);
    } catch (error) {
      console.error('Error loading weekly HR data:', error);
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

  const loadDayDetailData = async (selectedDate: string) => {
    setLoadingDayDetail(true);

    try {
      if (!isHealthConnectInitialized || !canReadHeartRate()) {
        Alert.alert('No Permissions', 'Heart rate read permissions are required to view detailed data.');
        setLoadingDayDetail(false);
        return;
      }

      const date = new Date(selectedDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const dayHRData = await readRecords('HeartRate', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: endOfDay.toISOString(),
        },
      });

      // Process hourly data
      const hourlyHR: Array<{ hour: number; bpm: number }> = [];
      let avgBpm = 0, maxBpm = 0, minBpm = 999;

      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date(date);
        hourStart.setHours(hour, 0, 0, 0);
        const hourEnd = new Date(date);
        hourEnd.setHours(hour, 59, 59, 999);

        const hourData = dayHRData.records.filter((record: any) => {
          const recordDate = new Date(record.startTime);
          return recordDate >= hourStart && recordDate <= hourEnd;
        });

        let hourBpm = 0;
        if (hourData.length > 0) {
          // Heart rate records can have samples array or direct beatsPerMinute
          const hourBpmValues: number[] = [];

          hourData.forEach((record: any) => {
            if (record.samples && record.samples.length > 0) {
              // HeartRate records with samples
              record.samples.forEach((sample: any) => {
                if (sample.beatsPerMinute && sample.beatsPerMinute > 0) {
                  hourBpmValues.push(sample.beatsPerMinute);
                }
              });
            } else if (record.beatsPerMinute && record.beatsPerMinute > 0) {
              // Direct heart rate reading
              hourBpmValues.push(record.beatsPerMinute);
            }
          });

          if (hourBpmValues.length > 0) {
            hourBpm = Math.round(hourBpmValues.reduce((sum: number, bpm: number) => sum + bpm, 0) / hourBpmValues.length);
          }
        }

        hourlyHR.push({ hour, bpm: hourBpm });
      }

      // Calculate day averages from all readings
      const allBpmValues: number[] = [];
      dayHRData.records.forEach((record: any) => {
        if (record.samples && record.samples.length > 0) {
          record.samples.forEach((sample: any) => {
            if (sample.beatsPerMinute && sample.beatsPerMinute > 0) {
              allBpmValues.push(sample.beatsPerMinute);
            }
          });
        } else if (record.beatsPerMinute && record.beatsPerMinute > 0) {
          allBpmValues.push(record.beatsPerMinute);
        }
      });

      if (allBpmValues.length > 0) {
        avgBpm = Math.round(allBpmValues.reduce((sum: number, bpm: number) => sum + bpm, 0) / allBpmValues.length);
        maxBpm = Math.round(Math.max(...allBpmValues));
        minBpm = Math.round(Math.min(...allBpmValues));
      } else {
        avgBpm = 0;
        maxBpm = 0;
        minBpm = 0;
      }

      const getHRCategory = (hr: number) => {
        if (hr < 60) return "Bradycardia";
        if (hr <= 100) return "Normal";
        if (hr <= 120) return "Elevated";
        if (hr <= 150) return "High";
        return "Very High";
      };

      const dayDetailData: DayDetailData = {
        date: selectedDate,
        averageBpm: avgBpm,
        maxBpm: maxBpm,
        minBpm: minBpm,
        category: getHRCategory(avgBpm),
        hourlyData: hourlyHR,
      };

      // console.log('=== REAL DATA FROM GOOGLE HEALTH ===');
      // console.log('Total records found:', dayHRData.records.length);
      // console.log('Processed heart rate data:', {
      //   date: selectedDate,
      //   avgBpm,
      //   maxBpm,
      //   minBpm,
      //   category: getHRCategory(avgBpm),
      //   hourlyDataPoints: hourlyHR.filter(h => h.bpm > 0).length
      // });

      setSelectedDayData(dayDetailData);

    } catch (error) {
      console.error('Error loading day detail data:', error);
      Alert.alert('Error', 'Failed to load heart rate data from Google Health. Please try again.');
      setLoadingDayDetail(false);
      return;
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

  // Load saved heart rate for today
  const loadHeartRate = async () => {
    try {
      const todayKey = getTodayKey()
      const savedHR = await AsyncStorage.getItem(todayKey)
      if (savedHR) {
        const hrData = JSON.parse(savedHR)
        setHeartRate(hrData.heartRate || 72)
      }
    } catch (error) {
      console.error("Error loading heart rate:", error)
    }
  }

  // Save heart rate
  const saveHeartRate = async (bpm: number) => {
    try {
      const todayKey = getTodayKey()
      const hrData = { heartRate: bpm }
      await AsyncStorage.setItem(todayKey, JSON.stringify(hrData))
    } catch (error) {
      console.error("Error saving heart rate:", error)
    }
  }

  // Load saved record IDs
  const loadHRRecordIds = async () => {
    try {
      const savedIds = await AsyncStorage.getItem('hr_record_ids')
      if (savedIds) {
        setHrRecordIds(JSON.parse(savedIds))
      }
    } catch (error) {
      console.error("Error loading HR record IDs:", error)
    }
  }

  useEffect(() => {
    loadHeartRate()
    initializeHealthConnect()
    loadHRRecordIds()
    loadWeeklyHRData()
  }, [])

  const getHRStatusMessage = () => {
    const hr = heartRate;

    if (hr < 60) return "⚠️ Low heart rate - consult your doctor if persistent";
    if (hr <= 100) return "✅ Normal heart rate - excellent!";
    if (hr <= 120) return "⚡ Elevated - monitor during activities";
    if (hr <= 150) return "⚠️ High - consider checking with a doctor";
    return "🚨 Very high - seek medical attention if persistent!";
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={["#E91E63"]}
          tintColor="#E91E63"
          title="Syncing with Google Health..."
          titleColor="#E91E63"
        />
      }
    >
      <LinearGradient colors={["#E91E63", "#C2185B", "#AD1457"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View>
              <Appbar.BackAction
                onPress={() => router.back()}
                iconColor="#ffffff"
                size={24}
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
              />
            </View>
            <Text style={styles.greeting}>Heart Rate</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={showAddHRModal}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <HeartRateDisplay bpm={heartRate} />
          <Text style={styles.motivationalText}>{getHRStatusMessage()}</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Health Connect Integration */}
        {isHealthConnectInitialized && !canWriteHeartRate() && (
          <View style={styles.infoCard}>
            <Ionicons name="heart-outline" size={24} color="#C2185B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Connect to Health App</Text>
              <Text style={styles.infoText}>
                Sync your heart rate data with your health app for better tracking and insights.
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { marginTop: 10, backgroundColor: "#C2185B" }]}
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
                  <Text style={styles.statNumber}>{heartRate}</Text>
                  <Text style={styles.statLabel}>BPM</Text>
                </View>
                <View style={styles.statIcon}>
                  <Ionicons name="heart" size={24} color="#E91E63" />
                </View>
              </View>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statContent}>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statNumber}>
                    {Math.abs(heartRate - 72)}
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
            {weeklyHRData.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.dayCard, day.isToday && styles.todayCard]}
                onPress={() => loadDayDetailData(day.date)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dayName, day.isToday && styles.todayText]}>{day.dayName}</Text>
                <Text style={[styles.dayDate, day.isToday && styles.todayText]}>{formatDate(day.date)}</Text>
                {day.averageBpm > 0 ? (
                  <>
                    <Text style={[styles.dayTemp, day.isToday && styles.todayText]}>
                      {day.averageBpm} BPM
                    </Text>
                    {day.maxBpm > 0 && (
                      <Text style={[styles.dayRange, day.isToday && styles.todayText]}>
                        {day.minBpm}-{day.maxBpm}
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
          <Text style={styles.sectionTitle}>💡 Heart Rate Health Tips</Text>
          <View style={styles.tipsCard}>
            <View style={styles.tipItem}>
              <Ionicons name="heart-outline" size={20} color="#E91E63" />
              <Text style={styles.tipText}>Normal resting heart rate ranges from 60-100 beats per minute</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="fitness-outline" size={20} color="#2196F3" />
              <Text style={styles.tipText}>Regular exercise can help lower your resting heart rate over time</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="medical-outline" size={20} color="#4CAF50" />
              <Text style={styles.tipText}>Consult a doctor if your heart rate consistently exceeds 100 BPM at rest</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="cafe-outline" size={20} color="#FF9800" />
              <Text style={styles.tipText}>Caffeine and stress can temporarily increase your heart rate</Text>
            </View>
            <View style={[styles.tipItem, styles.lastTipItem]}>
              <Ionicons name="moon-outline" size={20} color="#9C27B0" />
              <Text style={styles.tipText}>Monitor your heart rate during sleep - it's typically 10-20% lower</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Add Heart Rate Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddModal}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Heart Rate Reading</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Heart Rate</Text>
                <TextInput
                  style={styles.input}
                  placeholder="72"
                  value={newHeartRate}
                  onChangeText={setNewHeartRate}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={styles.inputUnit}>BPM</Text>
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
                onPress={handleHRSubmit}
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

            {selectedDayData ? (
              <ScrollView style={styles.dayDetailContent} showsVerticalScrollIndicator={false}>
                {/* Summary Cards */}
                <View style={styles.daySummaryCard}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Ionicons name="heart-outline" size={24} color="#E91E63" />
                      <Text style={styles.summaryValue}>{selectedDayData.averageBpm}</Text>
                      <Text style={styles.summaryLabel}>Avg BPM</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Ionicons name="trending-up-outline" size={24} color="#FF5722" />
                      <Text style={styles.summaryValue}>{selectedDayData.maxBpm}</Text>
                      <Text style={styles.summaryLabel}>Max BPM</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Ionicons name="trending-down-outline" size={24} color="#4CAF50" />
                      <Text style={styles.summaryValue}>{selectedDayData.minBpm}</Text>
                      <Text style={styles.summaryLabel}>Min BPM</Text>
                    </View>
                  </View>
                  <View style={styles.categoryContainer}>
                    <Text style={styles.categoryLabel}>Status: </Text>
                    <Text style={[styles.categoryValue, {
                      color: selectedDayData.category === 'Normal' ? '#4CAF50' :
                        selectedDayData.category === 'Elevated' ? '#FF9800' : '#F44336'
                    }]}>
                      {selectedDayData.category}
                    </Text>
                  </View>
                </View>

                {/* Line Graph */}
                <View style={styles.lineGraphContainer}>
                  <Text style={styles.graphTitle}>24-Hour Heart Rate Trend</Text>

                  {selectedDayData.hourlyData && selectedDayData.hourlyData.length > 0 && selectedDayData.hourlyData.some(hour => hour.bpm > 0) ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <LineChart
                        data={{
                          labels: selectedDayData.hourlyData
                            .filter((_, index) => index % 3 === 0) // Show every 3rd hour for cleaner x-axis
                            .map(hour => `${hour.hour}h`),
                          datasets: [{
                            data: selectedDayData.hourlyData.map(hour => {
                              // Only show actual readings, use 0 for missing data but chart will handle it
                              return hour.bpm > 0 ? hour.bpm : 0;
                            }),
                            color: (opacity = 1) => `rgba(233, 30, 99, ${opacity})`,
                            strokeWidth: 2,
                            withDots: true,
                          }],
                        }}
                        width={Math.max(width - 60, selectedDayData.hourlyData.length * 15)} // Responsive width for scrolling
                        height={220}
                        yAxisLabel=""
                        yAxisSuffix=" bpm"
                        yAxisInterval={1}
                        chartConfig={{
                          backgroundColor: "#ffffff",
                          backgroundGradientFrom: "#ffffff",
                          backgroundGradientTo: "#f8f9fa",
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(233, 30, 99, ${opacity})`,
                          labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
                          style: {
                            borderRadius: 16,
                          },
                          propsForDots: {
                            r: "4",
                            strokeWidth: "2",
                            stroke: "#E91E63",
                            fill: "#ffffff"
                          },
                          propsForBackgroundLines: {
                            strokeDasharray: "5,5",
                            stroke: "#e0e0e0",
                            strokeWidth: 1
                          },
                          fillShadowGradient: "#E91E63",
                          fillShadowGradientOpacity: 0.1,
                        }}
                        // No bezier for accurate medical data - straight lines only between actual readings
                        style={{
                          marginVertical: 8,
                          borderRadius: 16,
                          elevation: 3,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 8,
                        }}
                        onDataPointClick={(data) => {
                          const hourData = selectedDayData.hourlyData[data.index * 3]; // Adjust for filtered labels
                          if (hourData) {
                            const message = hourData.bpm > 0
                              ? `Heart Rate: ${hourData.bpm} BPM`
                              : 'No heart rate data recorded';
                            Alert.alert(
                              `${hourData.hour}:00`,
                              message,
                              [{ text: "OK" }]
                            );
                          }
                        }}
                      />
                    </ScrollView>
                  ) : (
                    <View style={styles.noDataContainer}>
                      <Ionicons name="heart-outline" size={48} color="#E0E0E0" />
                      <Text style={styles.noDataText}>No heart rate data available for this day</Text>
                      <Text style={styles.noDataSubtext}>
                        Try recording some heart rate readings or check if your health app has data for this date.
                      </Text>
                    </View>
                  )}
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
    shadowColor: "#E91E63",
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
  heartRateContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  heartDisplay: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  heartRing: {
    width: "100%",
    height: "100%",
    borderRadius: 150,
    borderWidth: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  heartInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  bpmReading: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginTop: 10,
  },
  bpmUnit: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginTop: 5,
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
    borderColor: "rgba(233, 30, 99, 0.1)",
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
    shadowColor: "#E91E63",
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
    backgroundColor: "rgba(233, 30, 99, 0.1)",
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
    backgroundColor: "#E91E63",
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
    borderColor: "rgba(233, 30, 99, 0.1)",
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
  dayHR: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  dayUnit: {
    fontSize: 10,
    color: "#666",
    marginBottom: 2,
  },
  noHR: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
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
    backgroundColor: "#E91E63",
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
    marginBottom: 16,
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
    height: 180,
    marginBottom: 16,
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
  hourlyLegend: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
  },
  hourlyLegendTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  hourlyLegendExtra: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  hourlyLegendText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    color: "#666",
  },
  noHourlyDataContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noHourlyDataText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
    marginTop: 12,
    textAlign: "center",
  },
  noHourlyDataSubtext: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 16,
  },
  // Line Graph Styles
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
    fontSize: 14,
    color: "#bbb",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  chartLegend: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginHorizontal: 20,
  },
  chartLegendText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 16,
  },
})