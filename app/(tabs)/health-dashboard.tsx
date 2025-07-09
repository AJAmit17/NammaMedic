"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    Alert,
    TouchableOpacity,
    TextInput,
    Modal,
    Dimensions,
} from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import * as Device from "expo-device"
import { LineChart, BarChart, PieChart } from "react-native-chart-kit"
import {
    initialize,
    readRecords,
    getSdkStatus,
    SdkAvailabilityStatus,
    insertRecords,
    RecordingMethod,
    DeviceType,
    aggregateGroupByDuration,
    aggregateGroupByPeriod,
} from "react-native-health-connect"
import {
    requestEssentialPermissions,
    requestAllPermissions,
    checkPermissionStatus,
    getDateRange,
    formatHealthValue,
} from "@/utils/healthUtils"
import { SafeAreaProvider } from "react-native-safe-area-context"

const screenWidth = Dimensions.get("window").width

interface HealthData {
    steps: number
    heartRate: number
    distance: number
    weight: number
    height: number
    bloodPressure: { systolic: number; diastolic: number } | null
    bodyTemp: number
    hydration: number
    sleepHours: number
}

interface StatsCardProps {
    title: string
    value: string
    unit: string
    icon: string
    color: string
    onAdd?: () => void
    canAdd?: boolean
    progress?: number
    target?: number
    trend?: "up" | "down" | "stable"
}

const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    unit,
    icon,
    color,
    onAdd,
    canAdd,
    progress,
    target,
    trend,
}) => (
    <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>{icon}</Text>
            <Text style={styles.cardTitle}>{title}</Text>
            {canAdd && onAdd && (
                <TouchableOpacity style={styles.addButton} onPress={onAdd}>
                    <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
            )}
        </View>
        <Text style={[styles.cardValue, { color }]}>{value}</Text>
        <Text style={styles.cardUnit}>{unit}</Text>

        {/* Progress Bar */}
        {progress !== undefined && (
            <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: color }]} />
                </View>
                <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
        )}

        {/* Trend Indicator */}
        {trend && (
            <View style={styles.trendContainer}>
                <Text
                    style={[
                        styles.trendIcon,
                        {
                            color: trend === "up" ? "#4CAF50" : trend === "down" ? "#F44336" : "#666",
                        },
                    ]}
                >
                    {trend === "up" ? "↗️" : trend === "down" ? "↘️" : "➡️"}
                </Text>
                <Text style={styles.trendText}>{trend === "up" ? "Improving" : trend === "down" ? "Declining" : "Stable"}</Text>
            </View>
        )}
    </View>
)

const HealthDashboard: React.FC = () => {
    const [healthData, setHealthData] = useState<HealthData>({
        steps: 8247,
        heartRate: 72,
        distance: 6.2,
        weight: 70.5,
        height: 175,
        bloodPressure: { systolic: 120, diastolic: 80 },
        bodyTemp: 36.8,
        hydration: 1800,
        sleepHours: 7.2,
    })

    const [loading, setLoading] = useState(false)
    const [chartsLoading, setChartsLoading] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [permissions, setPermissions] = useState<any[]>([])
    const [hasEssentialPermissions, setHasEssentialPermissions] = useState(false)
    const [showPermissionModal, setShowPermissionModal] = useState(false)
    const [activeTab, setActiveTab] = useState("overview")
    const [aggregatedChartData, setAggregatedChartData] = useState<any>({
        steps: { labels: [], datasets: [{ data: [] }] },
        heartRate: { labels: [], datasets: [{ data: [] }] },
        weight: { labels: [], datasets: [{ data: [] }] },
        hydration: { labels: [], datasets: [{ data: [] }] },
        sleep: [],
    })

    // Input modal states
    const [showInputModal, setShowInputModal] = useState(false)
    const [inputType, setInputType] = useState<string>("")
    const [inputValue, setInputValue] = useState("")
    const [inputValue2, setInputValue2] = useState("")
    const [saving, setSaving] = useState(false)

    // Sleep time picker states
    const [sleepStartTime, setSleepStartTime] = useState(new Date())
    const [sleepEndTime, setSleepEndTime] = useState(new Date())
    const [showStartTimePicker, setShowStartTimePicker] = useState(false)
    const [showEndTimePicker, setShowEndTimePicker] = useState(false)

    const chartConfig = {
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
        strokeWidth: 3,
        barPercentage: 0.7,
        useShadowColorFromDataset: false,
        decimalPlaces: 0,
        propsForLabels: {
            fontSize: 12,
            fontWeight: "600",
        },
        propsForVerticalLabels: {
            fontSize: 10,
        },
        propsForHorizontalLabels: {
            fontSize: 10,
        },
    }

    // Your existing useEffect and functions remain the same
    useEffect(() => {
        initializeHealthConnect()
    }, [])

    useEffect(() => {
        if (isInitialized) {
            checkEssentialPermissions()
        }
    }, [permissions, isInitialized])

    useEffect(() => {
        if (isInitialized && !hasEssentialPermissions && permissions.length === 0) {
            setShowPermissionModal(true)
        } else {
            setShowPermissionModal(false)
        }
    }, [isInitialized, hasEssentialPermissions, permissions])

    const checkEssentialPermissions = () => {
        const essentialTypes = ["Steps", "HeartRate", "Weight"]
        const hasEssential = essentialTypes.some((type) =>
            permissions.some((perm: any) => perm.recordType === type && perm.accessType === "read"),
        )
        setHasEssentialPermissions(hasEssential)
    }

    const initializeHealthConnect = async () => {
        try {
            const status = await getSdkStatus()
            if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
                Alert.alert("Health Connect", "Health Connect is not available on this device")
                return
            }
            const result = await initialize()
            setIsInitialized(result)
            if (result) {
                const currentPermissions = await checkPermissionStatus()
                setPermissions(currentPermissions)

                if (currentPermissions.length > 0) {
                    await loadHealthData()
                    await loadAggregatedChartData()
                }
            }
        } catch (error) {
            console.error("Error initializing Health Connect:", error)
            Alert.alert("Error", "Failed to initialize Health Connect")
        }
    }

    const requestHealthPermissions = async () => {
        try {
            const permissions = await requestEssentialPermissions()
            const newGranted = await checkPermissionStatus()
            setPermissions(newGranted)

            if (newGranted.length === 0) {
                Alert.alert(
                    "Permissions Required",
                    "Health Connect permissions are required to display your health data. Please grant permissions in the Health Connect settings.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: () => initializeHealthConnect() },
                    ],
                )
            }
        } catch (error) {
            console.error("Error in permission flow:", error)
        }
    }

    const requestAllHealthPermissions = async () => {
        try {
            const permissions = await requestAllPermissions()
            const newGranted = await checkPermissionStatus()
            setPermissions(newGranted)

            if (newGranted.length === 0) {
                Alert.alert(
                    "Permissions Required",
                    "Health Connect permissions are required to display your health data. Please grant permissions in the Health Connect settings.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: () => initializeHealthConnect() },
                    ],
                )
            }
        } catch (error) {
            console.error("Error requesting all permissions:", error)
        }
    }

    const loadAggregatedChartData = async () => {
        setChartsLoading(true)
        try {
            const currentPermissions = await checkPermissionStatus()
            const canRead = (recordType: string) =>
                currentPermissions.some((perm: any) => perm.recordType === recordType && perm.accessType === "read")

            // Load weekly steps data using readRecords and manual aggregation
            if (canRead("Steps")) {
                try {
                    const stepsData = await readRecords("Steps", {
                        timeRangeFilter: {
                            operator: "between",
                            startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                            endTime: new Date().toISOString(),
                        },
                    })

                    const labels: string[] = []
                    const data: number[] = []
                    const today = new Date()

                    // Create daily aggregations
                    for (let i = 6; i >= 0; i--) {
                        const date = new Date(today)
                        date.setDate(date.getDate() - i)
                        const dayName = date.toLocaleDateString('en', { weekday: 'short' })
                        labels.push(dayName)

                        const dayStart = new Date(date)
                        dayStart.setHours(0, 0, 0, 0)
                        const dayEnd = new Date(date)
                        dayEnd.setHours(23, 59, 59, 999)

                        const daySteps = stepsData.records
                            .filter((record: any) => {
                                const recordTime = new Date(record.startTime)
                                return recordTime >= dayStart && recordTime <= dayEnd
                            })
                            .reduce((sum: number, record: any) => sum + record.count, 0)

                        data.push(daySteps)
                    }

                    setAggregatedChartData((prev: any) => ({
                        ...prev,
                        steps: { labels, datasets: [{ data }] }
                    }))
                } catch (error) {
                    console.log("Could not load steps data for charts:", error)
                }
            }

            // Load weekly heart rate data
            if (canRead("HeartRate")) {
                try {
                    const heartRateData = await readRecords("HeartRate", {
                        timeRangeFilter: {
                            operator: "between",
                            startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                            endTime: new Date().toISOString(),
                        },
                    })

                    const labels: string[] = []
                    const data: number[] = []
                    const today = new Date()

                    for (let i = 6; i >= 0; i--) {
                        const date = new Date(today)
                        date.setDate(date.getDate() - i)
                        const dayName = date.toLocaleDateString('en', { weekday: 'short' })
                        labels.push(dayName)

                        const dayStart = new Date(date)
                        dayStart.setHours(0, 0, 0, 0)
                        const dayEnd = new Date(date)
                        dayEnd.setHours(23, 59, 59, 999)

                        let totalBeats = 0
                        let sampleCount = 0

                        heartRateData.records.forEach((record: any) => {
                            const recordTime = new Date(record.startTime)
                            if (recordTime >= dayStart && recordTime <= dayEnd) {
                                if (record.samples && record.samples.length > 0) {
                                    record.samples.forEach((sample: any) => {
                                        totalBeats += sample.beatsPerMinute
                                        sampleCount++
                                    })
                                }
                            }
                        })

                        const avgHeartRate = sampleCount > 0 ? Math.round(totalBeats / sampleCount) : 0
                        data.push(avgHeartRate)
                    }

                    setAggregatedChartData((prev: any) => ({
                        ...prev,
                        heartRate: { labels, datasets: [{ data }] }
                    }))
                } catch (error) {
                    console.log("Could not load heart rate data for charts:", error)
                }
            }

            // Load monthly weight data
            if (canRead("Weight")) {
                try {
                    const weightData = await readRecords("Weight", {
                        timeRangeFilter: {
                            operator: "between",
                            startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                            endTime: new Date().toISOString(),
                        },
                    })

                    const labels: string[] = []
                    const data: number[] = []

                    // Group by weeks
                    const weeklyData: { [key: string]: number[] } = {}

                    weightData.records.forEach((record: any) => {
                        const date = new Date(record.time)
                        const weekStart = new Date(date)
                        weekStart.setDate(date.getDate() - date.getDay())
                        const weekKey = weekStart.toISOString().split('T')[0]

                        if (!weeklyData[weekKey]) {
                            weeklyData[weekKey] = []
                        }
                        weeklyData[weekKey].push(record.weight?.inKilograms || 0)
                    })

                    Object.keys(weeklyData).sort().forEach((weekKey, index) => {
                        const weights = weeklyData[weekKey]
                        const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length
                        labels.push(`Week ${index + 1}`)
                        data.push(parseFloat(avgWeight.toFixed(1)))
                    })

                    setAggregatedChartData((prev: any) => ({
                        ...prev,
                        weight: { labels, datasets: [{ data }] }
                    }))
                } catch (error) {
                    console.log("Could not load weight data for charts:", error)
                }
            }

            // Load weekly hydration data
            if (canRead("Hydration")) {
                try {
                    const hydrationData = await readRecords("Hydration", {
                        timeRangeFilter: {
                            operator: "between",
                            startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                            endTime: new Date().toISOString(),
                        },
                    })

                    const labels: string[] = []
                    const data: number[] = []
                    const today = new Date()

                    for (let i = 6; i >= 0; i--) {
                        const date = new Date(today)
                        date.setDate(date.getDate() - i)
                        const dayName = date.toLocaleDateString('en', { weekday: 'short' })
                        labels.push(dayName)

                        const dayStart = new Date(date)
                        dayStart.setHours(0, 0, 0, 0)
                        const dayEnd = new Date(date)
                        dayEnd.setHours(23, 59, 59, 999)

                        const dayHydration = hydrationData.records
                            .filter((record: any) => {
                                const recordTime = new Date(record.startTime)
                                return recordTime >= dayStart && recordTime <= dayEnd
                            })
                            .reduce((sum: number, record: any) => sum + (record.volume?.inLiters || 0), 0)

                        data.push(Math.round(dayHydration * 1000)) // Convert to ml
                    }

                    setAggregatedChartData((prev: any) => ({
                        ...prev,
                        hydration: { labels, datasets: [{ data }] }
                    }))
                } catch (error) {
                    console.log("Could not load hydration data for charts:", error)
                }
            }

            // Load sleep session data for pie chart
            if (canRead("SleepSession")) {
                try {
                    const sleepData = await readRecords("SleepSession", {
                        timeRangeFilter: {
                            operator: "between",
                            startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                            endTime: new Date().toISOString(),
                        },
                    })

                    let deepSleep = 0
                    let lightSleep = 0
                    let remSleep = 0
                    let awakeSleep = 0

                    sleepData.records.forEach((record: any) => {
                        if (record.stages && record.stages.length > 0) {
                            record.stages.forEach((stage: any) => {
                                const start = new Date(stage.startTime)
                                const end = new Date(stage.endTime)
                                const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60) // hours

                                switch (stage.stage) {
                                    case 3: // Deep sleep
                                        deepSleep += duration
                                        break
                                    case 2: // Light sleep
                                        lightSleep += duration
                                        break
                                    case 4: // REM sleep
                                        remSleep += duration
                                        break
                                    case 1: // Awake
                                        awakeSleep += duration
                                        break
                                }
                            })
                        } else {
                            // If no stages, assume all light sleep
                            const start = new Date(record.startTime)
                            const end = new Date(record.endTime)
                            const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                            lightSleep += duration
                        }
                    })

                    const sleepPieData = [
                        {
                            name: "Deep",
                            population: parseFloat(deepSleep.toFixed(1)),
                            color: "#4A90E2",
                            legendFontColor: "#333",
                            legendFontSize: 12
                        },
                        {
                            name: "Light",
                            population: parseFloat(lightSleep.toFixed(1)),
                            color: "#7ED321",
                            legendFontColor: "#333",
                            legendFontSize: 12
                        },
                        {
                            name: "REM",
                            population: parseFloat(remSleep.toFixed(1)),
                            color: "#F5A623",
                            legendFontColor: "#333",
                            legendFontSize: 12
                        },
                        {
                            name: "Awake",
                            population: parseFloat(awakeSleep.toFixed(1)),
                            color: "#D0021B",
                            legendFontColor: "#333",
                            legendFontSize: 12
                        },
                    ].filter(item => item.population > 0)

                    setAggregatedChartData((prev: any) => ({
                        ...prev,
                        sleep: sleepPieData
                    }))
                } catch (error) {
                    console.log("Could not load sleep data for chart:", error)
                }
            }

        } catch (error) {
            console.error("Error loading aggregated chart data:", error)
        } finally {
            setChartsLoading(false)
        }
    }

    const loadHealthData = async () => {
        setLoading(true)
        const dateRange = getDateRange(1)

        const healthDataUpdate: HealthData = {
            steps: 0,
            heartRate: 0,
            distance: 0,
            weight: 0,
            height: 0,
            bloodPressure: null,
            bodyTemp: 0,
            hydration: 0,
            sleepHours: 0,
        }

        try {
            const currentPermissions = await checkPermissionStatus()
            const canRead = (recordType: string) =>
                currentPermissions.some((perm: any) => perm.recordType === recordType && perm.accessType === "read")

            // Load Steps
            if (canRead("Steps")) {
                try {
                    const stepsData = await readRecords("Steps", {
                        timeRangeFilter: {
                            operator: "between",
                            ...dateRange,
                        },
                    })
                    healthDataUpdate.steps = Math.round(
                        stepsData.records.reduce((sum: number, record: any) => sum + record.count, 0),
                    )
                } catch (error) {
                    console.log("Could not load steps data:", error)
                }
            }

            // Load Heart Rate
            if (canRead("HeartRate")) {
                try {
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
                        }
                    })

                    healthDataUpdate.heartRate = sampleCount > 0 ? Math.round(totalBeats / sampleCount) : 0
                } catch (error) {
                    console.log("Could not load heart rate data:", error)
                }
            }

            // Load Distance
            if (canRead("Distance")) {
                try {
                    const distanceData = await readRecords("Distance", {
                        timeRangeFilter: {
                            operator: "between",
                            ...dateRange,
                        },
                    })
                    const totalDistance = distanceData.records.reduce(
                        (sum: number, record: any) => sum + (record.distance?.inKilometers || 0),
                        0,
                    )
                    healthDataUpdate.distance = Math.round(totalDistance * 100) / 100
                } catch (error) {
                    console.log("Could not load distance data:", error)
                }
            }

            // Load Weight
            if (canRead("Weight")) {
                try {
                    const weightData = await readRecords("Weight", {
                        timeRangeFilter: {
                            operator: "between",
                            startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                            endTime: new Date().toISOString(),
                        },
                    })
                    const latestWeight =
                        weightData.records.length > 0
                            ? weightData.records[weightData.records.length - 1].weight?.inKilograms || 0
                            : 0
                    healthDataUpdate.weight = Math.round(latestWeight * 10) / 10
                } catch (error) {
                    console.log("Could not load weight data:", error)
                }
            }

            // Load Height
            if (canRead("Height")) {
                try {
                    const heightData = await readRecords("Height", {
                        timeRangeFilter: {
                            operator: "between",
                            startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
                            endTime: new Date().toISOString(),
                        },
                    })
                    const latestHeight =
                        heightData.records.length > 0 ? heightData.records[heightData.records.length - 1].height?.inMeters || 0 : 0
                    healthDataUpdate.height = Math.round(latestHeight * 100)
                } catch (error) {
                    console.log("Could not load height data:", error)
                }
            }

            // Load Blood Pressure
            if (canRead("BloodPressure")) {
                try {
                    const bpData = await readRecords("BloodPressure", {
                        timeRangeFilter: {
                            operator: "between",
                            ...dateRange,
                        },
                    })
                    healthDataUpdate.bloodPressure =
                        bpData.records.length > 0
                            ? {
                                systolic: bpData.records[bpData.records.length - 1].systolic?.inMillimetersOfMercury || 0,
                                diastolic: bpData.records[bpData.records.length - 1].diastolic?.inMillimetersOfMercury || 0,
                            }
                            : null
                } catch (error) {
                    console.log("Could not load blood pressure data:", error)
                }
            }

            // Load Body Temperature
            if (canRead("BodyTemperature")) {
                try {
                    const tempData = await readRecords("BodyTemperature", {
                        timeRangeFilter: {
                            operator: "between",
                            ...dateRange,
                        },
                    })
                    const latestTemp =
                        tempData.records.length > 0 ? tempData.records[tempData.records.length - 1].temperature?.inCelsius || 0 : 0
                    healthDataUpdate.bodyTemp = Math.round(latestTemp * 10) / 10
                } catch (error) {
                    console.log("Could not load body temperature data:", error)
                }
            }

            // Load Hydration
            if (canRead("Hydration")) {
                try {
                    const hydrationData = await readRecords("Hydration", {
                        timeRangeFilter: {
                            operator: "between",
                            ...dateRange,
                        },
                    })
                    const totalHydration = hydrationData.records.reduce(
                        (sum: number, record: any) => sum + (record.volume?.inLiters || 0),
                        0,
                    )
                    healthDataUpdate.hydration = Math.round(totalHydration * 1000)
                } catch (error) {
                    console.log("Could not load hydration data:", error)
                }
            }

            // Load Sleep
            if (canRead("SleepSession")) {
                try {
                    const sleepData = await readRecords("SleepSession", {
                        timeRangeFilter: {
                            operator: "between",
                            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                            endTime: new Date().toISOString(),
                        },
                    })
                    const totalSleepHours = sleepData.records.reduce((sum: number, record: any) => {
                        const start = new Date(record.startTime)
                        const end = new Date(record.endTime)
                        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                    }, 0)
                    healthDataUpdate.sleepHours = Math.round(totalSleepHours * 10) / 10
                } catch (error) {
                    console.log("Could not load sleep data:", error)
                }
            }

            setHealthData(healthDataUpdate)
        } catch (error) {
            console.error("General error loading health data:", error)
            setHealthData(healthDataUpdate)
        } finally {
            setLoading(false)
        }
    }

    const onRefresh = async () => {
        await loadHealthData()
        await loadAggregatedChartData()
    }

    const retryPermissions = () => {
        setShowPermissionModal(false)
        Alert.alert(
            "Setup Health Connect",
            "Health Connect permissions are needed to show your health data. This will open the Health Connect settings where you can grant permissions.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Grant Essential Permissions", onPress: requestHealthPermissions },
                { text: "Grant All Permissions", onPress: requestAllHealthPermissions },
            ],
        )
    }

    const skipPermissions = () => {
        setShowPermissionModal(false)
        setHasEssentialPermissions(true)
    }

    const canWrite = (recordType: string) =>
        permissions.some((perm: any) => perm.recordType === recordType && perm.accessType === "write")

    const getDeviceMetadata = () => {
        return {
            manufacturer: Device.manufacturer || "Unknown",
            model: Device.modelName || Device.deviceName || "Unknown",
            type: DeviceType.TYPE_PHONE,
        }
    }

    const openInputModal = (type: string) => {
        setInputType(type)
        setInputValue("")
        setInputValue2("")

        if (type === "sleep") {
            const now = new Date()
            const defaultStartTime = new Date()
            defaultStartTime.setHours(22, 0, 0, 0)

            const defaultEndTime = new Date()
            defaultEndTime.setHours(7, 0, 0, 0)
            if (defaultEndTime < defaultStartTime) {
                defaultEndTime.setDate(defaultEndTime.getDate() + 1)
            }

            setSleepStartTime(defaultStartTime)
            setSleepEndTime(defaultEndTime)
        }

        setShowInputModal(true)
    }

    const closeInputModal = () => {
        setShowInputModal(false)
        setInputType("")
        setInputValue("")
        setInputValue2("")
        setShowStartTimePicker(false)
        setShowEndTimePicker(false)
    }

    const saveHealthData = async () => {
        if (inputType === "sleep") {
            if (sleepEndTime <= sleepStartTime) {
                Alert.alert("Error", "End time must be after start time")
                return
            }
        } else if (inputType === "bloodPressure") {
            if (!inputValue.trim() || !inputValue2.trim()) {
                Alert.alert("Error", "Please enter both systolic and diastolic values")
                return
            }
        } else if (!inputValue.trim()) {
            Alert.alert("Error", "Please enter a value")
            return
        }

        setSaving(true)
        try {
            const now = new Date().toISOString()
            const deviceInfo = getDeviceMetadata()
            let record: any = {
                recordType: "",
                metadata: {
                    recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
                    device: deviceInfo,
                },
            }

            switch (inputType) {
                case "heartRate":
                    record = {
                        ...record,
                        recordType: "HeartRate",
                        samples: [
                            {
                                time: now,
                                beatsPerMinute: Number.parseInt(inputValue),
                            },
                        ],
                        startTime: new Date(Date.now() - 1000).toISOString(),
                        endTime: now,
                    }
                    break
                case "weight":
                    record = {
                        ...record,
                        recordType: "Weight",
                        weight: {
                            value: Number.parseFloat(inputValue),
                            unit: "kilograms",
                        },
                        time: now,
                    }
                    break
                case "height":
                    record = {
                        ...record,
                        recordType: "Height",
                        height: {
                            value: Number.parseFloat(inputValue) / 100,
                            unit: "meters",
                        },
                        time: now,
                    }
                    break
                case "bloodPressure":
                    if (!inputValue2.trim()) {
                        Alert.alert("Error", "Please enter both systolic and diastolic values")
                        return
                    }
                    record = {
                        ...record,
                        recordType: "BloodPressure",
                        systolic: {
                            value: Number.parseInt(inputValue),
                            unit: "millimetersOfMercury",
                        },
                        diastolic: {
                            value: Number.parseInt(inputValue2),
                            unit: "millimetersOfMercury",
                        },
                        bodyPosition: 1,
                        measurementLocation: 1,
                        time: now,
                    }
                    break
                case "bodyTemp":
                    record = {
                        ...record,
                        recordType: "BodyTemperature",
                        temperature: {
                            value: Number.parseFloat(inputValue),
                            unit: "celsius",
                        },
                        measurementLocation: 1,
                        time: now,
                    }
                    break
                case "hydration":
                    record = {
                        ...record,
                        recordType: "Hydration",
                        volume: {
                            value: Number.parseFloat(inputValue) / 1000,
                            unit: "liters",
                        },
                        startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                        endTime: now,
                    }
                    break
                case "sleep":
                    const sleepDurationMs = sleepEndTime.getTime() - sleepStartTime.getTime()
                    const sleepDurationHours = sleepDurationMs / (1000 * 60 * 60)

                    const stages = []
                    stages.push({
                        startTime: sleepStartTime.toISOString(),
                        endTime: sleepEndTime.toISOString(),
                        stage: 2,
                    })

                    record = {
                        ...record,
                        recordType: "SleepSession",
                        title: "Sleep Session",
                        notes: `Manual sleep entry - ${sleepDurationHours.toFixed(1)} hours`,
                        startTime: sleepStartTime.toISOString(),
                        endTime: sleepEndTime.toISOString(),
                        stages: stages,
                    }
                    break
                default:
                    Alert.alert("Error", "Invalid data type")
                    return
            }

            await insertRecords([record])
            Alert.alert("Success", `${inputType} data saved successfully!`)
            closeInputModal()
            await loadHealthData()
            await loadAggregatedChartData()
        } catch (error) {
            console.error("Error saving health data:", error)
            Alert.alert("Error", "Failed to save health data")
        } finally {
            setSaving(false)
        }
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case "overview":
                return (
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionTitle}>Today's Overview</Text>
                        <View style={styles.row}>
                            <StatsCard
                                title="Steps"
                                value={formatHealthValue(healthData.steps, "steps")}
                                unit="steps"
                                icon="👟"
                                color="#4CAF50"
                                progress={(healthData.steps / 10000) * 100}
                                target={10000}
                                trend="up"
                            />
                        </View>
                        <View style={styles.row}>
                            <StatsCard
                                title="Heart Rate"
                                value={formatHealthValue(healthData.heartRate, "heartRate")}
                                unit="bpm"
                                icon="❤️"
                                color="#E91E63"
                                onAdd={() => openInputModal("heartRate")}
                                canAdd={canWrite("HeartRate")}
                                trend="stable"
                            />
                            <StatsCard
                                title="Distance"
                                value={formatHealthValue(healthData.distance, "distance")}
                                unit="km"
                                icon="📍"
                                color="#2196F3"
                                progress={(healthData.distance / 8) * 100}
                                target={8}
                                trend="up"
                            />
                        </View>
                    </View>
                )
            case "charts":
                return (
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionTitle}>Weekly Steps</Text>
                        <View style={styles.chartContainer}>
                            {chartsLoading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>Loading chart...</Text>
                                </View>
                            ) : aggregatedChartData.steps.datasets[0].data.length > 0 ? (
                                <LineChart
                                    data={aggregatedChartData.steps}
                                    width={screenWidth - 40}
                                    height={220}
                                    chartConfig={chartConfig}
                                    bezier
                                    style={styles.chart}
                                />
                            ) : (
                                <View style={styles.noDataContainer}>
                                    <Text style={styles.noDataText}>No steps data available</Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.sectionTitle}>Heart Rate This Week</Text>
                        <View style={styles.chartContainer}>
                            {chartsLoading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>Loading chart...</Text>
                                </View>
                            ) : aggregatedChartData.heartRate.datasets[0].data.length > 0 ? (
                                <LineChart
                                    data={aggregatedChartData.heartRate}
                                    width={screenWidth - 40}
                                    height={220}
                                    chartConfig={{
                                        ...chartConfig,
                                        color: (opacity = 1) => `rgba(233, 30, 99, ${opacity})`,
                                    }}
                                    style={styles.chart}
                                />
                            ) : (
                                <View style={styles.noDataContainer}>
                                    <Text style={styles.noDataText}>No heart rate data available</Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.sectionTitle}>Hydration This Week</Text>
                        <View style={styles.chartContainer}>
                            {chartsLoading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>Loading chart...</Text>
                                </View>
                            ) : aggregatedChartData.hydration.datasets[0].data.length > 0 ? (
                                <BarChart
                                    data={aggregatedChartData.hydration}
                                    width={screenWidth - 40}
                                    height={220}
                                    yAxisLabel=""
                                    yAxisSuffix="ml"
                                    chartConfig={{
                                        ...chartConfig,
                                        color: (opacity = 1) => `rgba(0, 188, 212, ${opacity})`,
                                    }}
                                    style={styles.chart}
                                />
                            ) : (
                                <View style={styles.noDataContainer}>
                                    <Text style={styles.noDataText}>No hydration data available</Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.sectionTitle}>Sleep Quality (Weekly)</Text>
                        <View style={styles.chartContainer}>
                            {chartsLoading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>Loading chart...</Text>
                                </View>
                            ) : aggregatedChartData.sleep.length > 0 ? (
                                <PieChart
                                    data={aggregatedChartData.sleep}
                                    width={screenWidth - 40}
                                    height={220}
                                    chartConfig={chartConfig}
                                    accessor="population"
                                    backgroundColor="transparent"
                                    paddingLeft="15"
                                    style={styles.chart}
                                />
                            ) : (
                                <View style={styles.noDataContainer}>
                                    <Text style={styles.noDataText}>No sleep data available</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )
            case "vitals":
                return (
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionTitle}>Vital Signs</Text>
                        <View style={styles.row}>
                            <StatsCard
                                title="Weight"
                                value={formatHealthValue(healthData.weight, "weight")}
                                unit="kg"
                                icon="⚖️"
                                color="#9C27B0"
                                onAdd={() => openInputModal("weight")}
                                canAdd={canWrite("Weight")}
                                trend="down"
                            />
                            <StatsCard
                                title="Height"
                                value={formatHealthValue(healthData.height, "height")}
                                unit="cm"
                                icon="📏"
                                color="#795548"
                                onAdd={() => openInputModal("height")}
                                canAdd={canWrite("Height")}
                                trend="stable"
                            />
                        </View>
                        <View style={styles.row}>
                            <StatsCard
                                title="Blood Pressure"
                                value={
                                    healthData.bloodPressure
                                        ? `${healthData.bloodPressure.systolic}/${healthData.bloodPressure.diastolic}`
                                        : "--"
                                }
                                unit="mmHg"
                                icon="🩺"
                                color="#F44336"
                                onAdd={() => openInputModal("bloodPressure")}
                                canAdd={canWrite("BloodPressure")}
                                trend="stable"
                            />
                            <StatsCard
                                title="Body Temp"
                                value={formatHealthValue(healthData.bodyTemp, "bodyTemp")}
                                unit="°C"
                                icon="🌡️"
                                color="#FF9800"
                                onAdd={() => openInputModal("bodyTemp")}
                                canAdd={canWrite("BodyTemperature")}
                                trend="stable"
                            />
                        </View>
                        <View style={styles.row}>
                            <StatsCard
                                title="Hydration"
                                value={formatHealthValue(healthData.hydration, "hydration")}
                                unit="ml"
                                icon="💧"
                                color="#00BCD4"
                                onAdd={() => openInputModal("hydration")}
                                canAdd={canWrite("Hydration")}
                                progress={(healthData.hydration / 2500) * 100}
                                target={2500}
                                trend="up"
                            />
                            <StatsCard
                                title="Sleep"
                                value={formatHealthValue(healthData.sleepHours, "sleepHours")}
                                unit="hours"
                                icon="😴"
                                color="#673AB7"
                                onAdd={() => openInputModal("sleep")}
                                canAdd={canWrite("SleepSession")}
                                progress={(healthData.sleepHours / 8) * 100}
                                target={8}
                                trend="up"
                            />
                        </View>

                        <Text style={styles.sectionTitle}>Weight Trend (Monthly)</Text>
                        <View style={styles.chartContainer}>
                            {chartsLoading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>Loading chart...</Text>
                                </View>
                            ) : aggregatedChartData.weight.datasets[0].data.length > 0 ? (
                                <LineChart
                                    data={aggregatedChartData.weight}
                                    width={screenWidth - 40}
                                    height={220}
                                    chartConfig={{
                                        ...chartConfig,
                                        color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`,
                                    }}
                                    style={styles.chart}
                                />
                            ) : (
                                <View style={styles.noDataContainer}>
                                    <Text style={styles.noDataText}>No weight data available</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )
            default:
                return null
        }
    }

    if (!isInitialized) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.centerTitle}>Health Dashboard</Text>
                <Text style={styles.centerSubtitle}>Initializing Health Connect...</Text>
                <TouchableOpacity style={styles.button} onPress={initializeHealthConnect}>
                    <Text style={styles.buttonText}>Retry Initialization</Text>
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <SafeAreaProvider>
            <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
                <View style={styles.header}>
                    <Text style={styles.title}>Health Dashboard</Text>
                    <Text style={styles.subtitle}>Your comprehensive health overview</Text>
                    {permissions.length === 0 && (
                        <TouchableOpacity style={styles.permissionPrompt} onPress={retryPermissions}>
                            <Text style={styles.permissionPromptText}>Grant Health Permissions</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tab Navigation */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === "overview" && styles.activeTab]}
                        onPress={() => setActiveTab("overview")}
                    >
                        <Text style={[styles.tabText, activeTab === "overview" && styles.activeTabText]}>Overview</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === "charts" && styles.activeTab]}
                        onPress={() => setActiveTab("charts")}
                    >
                        <Text style={[styles.tabText, activeTab === "charts" && styles.activeTabText]}>Charts</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === "vitals" && styles.activeTab]}
                        onPress={() => setActiveTab("vitals")}
                    >
                        <Text style={[styles.tabText, activeTab === "vitals" && styles.activeTabText]}>Vitals</Text>
                    </TouchableOpacity>
                </View>

                {/* Tab Content */}
                <View style={styles.statsContainer}>{renderTabContent()}</View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Data from Google Health Connect • Last updated: {new Date().toLocaleTimeString()}
                    </Text>
                </View>

                {/* Input Modal - Keep your existing modal code */}
                <Modal visible={showInputModal} animationType="slide" transparent>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>
                                Enter{" "}
                                {inputType === "bloodPressure"
                                    ? "Blood Pressure"
                                    : inputType === "bodyTemp"
                                        ? "Body Temperature"
                                        : inputType === "heartRate"
                                            ? "Heart Rate"
                                            : inputType === "sleep"
                                                ? "Sleep Times"
                                                : inputType.charAt(0).toUpperCase() + inputType.slice(1)}
                            </Text>
                            {inputType === "sleep" ? (
                                <View>
                                    <Text style={styles.timeLabel}>Sleep Start Time:</Text>
                                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowStartTimePicker(true)}>
                                        <Text style={styles.timeButtonText}>
                                            {sleepStartTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </Text>
                                    </TouchableOpacity>
                                    <Text style={styles.timeLabel}>Sleep End Time:</Text>
                                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowEndTimePicker(true)}>
                                        <Text style={styles.timeButtonText}>
                                            {sleepEndTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </Text>
                                    </TouchableOpacity>
                                    {showStartTimePicker && (
                                        <DateTimePicker
                                            value={sleepStartTime}
                                            mode="time"
                                            is24Hour={false}
                                            display="default"
                                            onChange={(event, selectedTime) => {
                                                setShowStartTimePicker(false)
                                                if (selectedTime) {
                                                    setSleepStartTime(selectedTime)
                                                }
                                            }}
                                        />
                                    )}
                                    {showEndTimePicker && (
                                        <DateTimePicker
                                            value={sleepEndTime}
                                            mode="time"
                                            is24Hour={false}
                                            display="default"
                                            onChange={(event, selectedTime) => {
                                                setShowEndTimePicker(false)
                                                if (selectedTime) {
                                                    const newEndTime = selectedTime
                                                    if (newEndTime <= sleepStartTime) {
                                                        newEndTime.setDate(newEndTime.getDate() + 1)
                                                    }
                                                    setSleepEndTime(newEndTime)
                                                }
                                            }}
                                        />
                                    )}
                                </View>
                            ) : (
                                <View>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={
                                            inputType === "heartRate"
                                                ? "Heart rate (bpm)"
                                                : inputType === "weight"
                                                    ? "Weight (kg)"
                                                    : inputType === "height"
                                                        ? "Height (cm)"
                                                        : inputType === "bloodPressure"
                                                            ? "Systolic (mmHg)"
                                                            : inputType === "bodyTemp"
                                                                ? "Temperature (°C)"
                                                                : inputType === "hydration"
                                                                    ? "Volume (ml)"
                                                                    : `Enter ${inputType}`
                                        }
                                        keyboardType="numeric"
                                        value={inputValue}
                                        onChangeText={setInputValue}
                                    />

                                    {inputType === "bloodPressure" && (
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Diastolic (mmHg)"
                                            keyboardType="numeric"
                                            value={inputValue2}
                                            onChangeText={setInputValue2}
                                        />
                                    )}
                                </View>
                            )}
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeInputModal}>
                                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.saveButton, saving && styles.saveButtonDisabled]}
                                    onPress={saveHealthData}
                                    disabled={saving}
                                >
                                    <Text style={[styles.modalButtonText, styles.saveButtonText]}>{saving ? "Saving..." : "Save"}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Permission Modal - Keep your existing modal code */}
                <Modal visible={showPermissionModal} animationType="slide" transparent>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Health Connect Permissions</Text>
                            <Text style={styles.permissionModalText}>
                                To display your health data, this app needs access to Health Connect.
                                {"\n\n"}
                                You can grant essential permissions for basic functionality, or all permissions for complete health
                                tracking.
                            </Text>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={skipPermissions}>
                                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Skip</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={retryPermissions}>
                                    <Text style={[styles.modalButtonText, styles.saveButtonText]}>Grant Permissions</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaProvider>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        backgroundColor: "#f5f5f5",
    },
    header: {
        padding: 20,
        backgroundColor: "#2196F3",
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "white",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.8)",
        textAlign: "center",
        marginTop: 5,
    },
    centerTitle: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#333",
        textAlign: "center",
    },
    centerSubtitle: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginTop: 5,
        marginBottom: 20,
    },
    button: {
        backgroundColor: "#2196F3",
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 100,
    },
    buttonText: {
        color: "white",
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: "white",
        marginHorizontal: 15,
        marginTop: 15,
        borderRadius: 10,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 15,
        alignItems: "center",
        borderRadius: 10,
    },
    activeTab: {
        backgroundColor: "#2196F3",
    },
    tabText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#666",
    },
    activeTabText: {
        color: "white",
    },
    tabContent: {
        flex: 1,
    },
    statsContainer: {
        padding: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 15,
        marginTop: 10,
        color: "#333",
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 15,
    },
    card: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 15,
        flex: 1,
        marginHorizontal: 5,
        borderLeftWidth: 4,
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    cardIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    cardTitle: {
        fontSize: 14,
        color: "#666",
        fontWeight: "500",
    },
    cardValue: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 2,
    },
    cardUnit: {
        fontSize: 12,
        color: "#999",
    },
    progressContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: "#f0f0f0",
        borderRadius: 3,
        marginRight: 8,
    },
    progressFill: {
        height: "100%",
        borderRadius: 3,
    },
    progressText: {
        fontSize: 10,
        color: "#666",
        fontWeight: "600",
    },
    trendContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 5,
    },
    trendIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    trendText: {
        fontSize: 10,
        color: "#666",
    },
    chartContainer: {
        backgroundColor: "white",
        borderRadius: 12,
        marginBottom: 20,
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        overflow: "hidden",
    },
    chart: {
        marginVertical: 8,
        borderRadius: 12,
    },
    footer: {
        padding: 20,
        alignItems: "center",
    },
    footerText: {
        fontSize: 12,
        color: "#666",
        textAlign: "center",
    },
    addButton: {
        backgroundColor: "#2196F3",
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: "auto",
    },
    addButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalContent: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
        width: "80%",
        maxWidth: 300,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 15,
        textAlign: "center",
        color: "#333",
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: "#f0f0f0",
    },
    saveButton: {
        backgroundColor: "#2196F3",
    },
    saveButtonDisabled: {
        backgroundColor: "#ccc",
    },
    modalButtonText: {
        textAlign: "center",
        fontSize: 16,
        fontWeight: "600",
    },
    cancelButtonText: {
        color: "#666",
    },
    saveButtonText: {
        color: "white",
    },
    timeLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        marginBottom: 8,
        marginTop: 10,
    },
    timeButton: {
        backgroundColor: "#f0f0f0",
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#ddd",
    },
    timeButtonText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
    },
    permissionPrompt: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 8,
        marginTop: 10,
        alignSelf: "center",
    },
    permissionPromptText: {
        color: "white",
        fontSize: 14,
        fontWeight: "600",
    },
    permissionModalText: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginBottom: 20,
        lineHeight: 22,
    },
    noDataContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
    },
    noDataText: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
    },
    loadingText: {
        fontSize: 16,
        color: "#2196F3",
        textAlign: "center",
    },
})

export default HealthDashboard
