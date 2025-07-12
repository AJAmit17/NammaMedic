import React, { useState, useEffect } from "react"
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Modal,
    TextInput,
    Alert,
    Dimensions,
} from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import {
    initialize,
    readRecords,
    insertRecords,
    getSdkStatus,
    SdkAvailabilityStatus,
    RecordingMethod
} from "react-native-health-connect"
import { LineChart } from "react-native-chart-kit"
import { 
    getDateRange, 
    formatHealthValue, 
    requestEssentialPermissionsWithSettings,
    requestAllPermissionsWithSettings,
    checkPermissionStatus,
    getDeviceMetadata,
    openHealthConnectSettingsScreen
} from "@/utils/healthUtils"

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
                <TouchableOpacity style={[styles.addButton, { backgroundColor: color }]} onPress={onAdd}>
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
    })

    const [loading, setLoading] = useState(false)
    const [chartsLoading, setChartsLoading] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [permissions, setPermissions] = useState<any[]>([])
    const [hasEssentialPermissions, setHasEssentialPermissions] = useState(false)
    const [showPermissionModal, setShowPermissionModal] = useState(false)
    const [aggregatedChartData, setAggregatedChartData] = useState<any>({
        steps: { labels: [], datasets: [{ data: [] }] },
        heartRate: { labels: [], datasets: [{ data: [] }] },
        weight: { labels: [], datasets: [{ data: [] }] },
        hydration: { labels: [], datasets: [{ data: [] }] },
    })

    // Input modal states
    const [showInputModal, setShowInputModal] = useState(false)
    const [inputType, setInputType] = useState<string>("")
    const [inputValue, setInputValue] = useState("")
    const [inputValue2, setInputValue2] = useState("")
    const [saving, setSaving] = useState(false)

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
            const permissions = await requestEssentialPermissionsWithSettings()
            const newGranted = await checkPermissionStatus()
            setPermissions(newGranted)

            if (newGranted.length === 0) {
                Alert.alert(
                    "Permissions Required",
                    "Health Connect permissions are required to display your health data. Please grant permissions in the Health Connect settings.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: openHealthConnectSettingsScreen },
                    ],
                )
            }
        } catch (error) {
            console.error("Error in permission flow:", error)
        }
    }

    const requestAllHealthPermissions = async () => {
        try {
            const permissions = await requestAllPermissionsWithSettings()
            const newGranted = await checkPermissionStatus()
            setPermissions(newGranted)

            if (newGranted.length === 0) {
                Alert.alert(
                    "Permissions Required",
                    "Health Connect permissions are required to display your health data. Please grant permissions in the Health Connect settings.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: openHealthConnectSettingsScreen },
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

            // Load weekly steps data
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
                                const recordTime = new Date(record.startTime || record.time)
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
                            const recordTime = new Date(record.startTime || record.time)
                            if (recordTime >= dayStart && recordTime <= dayEnd) {
                                if (record.samples && record.samples.length > 0) {
                                    record.samples.forEach((sample: any) => {
                                        totalBeats += sample.beatsPerMinute
                                        sampleCount++
                                    })
                                } else if (record.beatsPerMinute) {
                                    totalBeats += record.beatsPerMinute
                                    sampleCount++
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
                        const recordDate = new Date(record.time)
                        const weekStart = new Date(recordDate)
                        weekStart.setDate(recordDate.getDate() - recordDate.getDay())
                        const weekKey = weekStart.toISOString().split('T')[0]
                        
                        if (!weeklyData[weekKey]) {
                            weeklyData[weekKey] = []
                        }
                        weeklyData[weekKey].push(record.weight?.inKilograms || 0)
                    })

                    Object.keys(weeklyData).sort().forEach((weekKey, index) => {
                        const avgWeight = weeklyData[weekKey].reduce((sum, w) => sum + w, 0) / weeklyData[weekKey].length
                        labels.push(`Week ${index + 1}`)
                        data.push(Math.round(avgWeight * 10) / 10)
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
                                const recordTime = new Date(record.startTime || record.time)
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
                        } else if (record.beatsPerMinute) {
                            totalBeats += record.beatsPerMinute
                            sampleCount++
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

    const openInputModal = (type: string) => {
        setInputType(type)
        setInputValue("")
        setInputValue2("")
        setShowInputModal(true)
    }

    const closeInputModal = () => {
        setShowInputModal(false)
        setInputType("")
        setInputValue("")
        setInputValue2("")
    }

    const saveHealthData = async () => {
        if (inputType === "bloodPressure") {
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
                        Alert.alert("Error", "Please enter diastolic value")
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
                default:
                    Alert.alert("Error", "Invalid data type")
                    return
            }

            console.log("Attempting to save record:", JSON.stringify(record, null, 2))
            await insertRecords([record])
            Alert.alert("Success", `${inputType} data saved successfully!`)
            closeInputModal()
            await loadHealthData()
            await loadAggregatedChartData()
        } catch (error) {
            console.error("Error saving health data:", error)
            Alert.alert("Error", `Failed to save health data: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setSaving(false)
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
            <SafeAreaView style={styles.safeArea}>
                <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
                    {/* Modern Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <Text style={styles.title}>Health Dashboard</Text>
                            <Text style={styles.subtitle}>Your wellness journey</Text>
                        </View>
                        {!hasEssentialPermissions && (
                            <TouchableOpacity style={styles.permissionPrompt} onPress={retryPermissions}>
                                <Text style={styles.permissionPromptText}>Grant Permissions</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Health Overview Cards */}
                    <View style={styles.statsContainer}>
                        <Text style={styles.sectionTitle}>Today's Overview</Text>
                        
                        <View style={styles.row}>
                            <StatsCard
                                title="Steps"
                                value={formatHealthValue(healthData.steps, "steps")}
                                unit="steps"
                                icon="👟"
                                color="#4A90E2"
                                progress={(healthData.steps / 10000) * 100}
                                target={10000}
                                trend={healthData.steps > 8000 ? "up" : "stable"}
                            />
                            <StatsCard
                                title="Heart Rate"
                                value={formatHealthValue(healthData.heartRate, "heartRate")}
                                unit="bpm"
                                icon="❤️"
                                color="#F5A623"
                                canAdd
                                onAdd={() => openInputModal("heartRate")}
                                trend="stable"
                            />
                        </View>

                        <View style={styles.row}>
                            <StatsCard
                                title="Weight"
                                value={formatHealthValue(healthData.weight, "weight")}
                                unit="kg"
                                icon="⚖️"
                                color="#7ED321"
                                canAdd
                                onAdd={() => openInputModal("weight")}
                                trend="stable"
                            />
                            <StatsCard
                                title="Hydration"
                                value={formatHealthValue(healthData.hydration, "hydration")}
                                unit="ml"
                                icon="💧"
                                color="#50E3C2"
                                progress={(healthData.hydration / 2000) * 100}
                                target={2000}
                                canAdd
                                onAdd={() => openInputModal("hydration")}
                                trend={healthData.hydration > 1500 ? "up" : "down"}
                            />
                        </View>

                        <View style={styles.row}>
                            <StatsCard
                                title="Distance"
                                value={formatHealthValue(healthData.distance, "distance")}
                                unit="km"
                                icon="🏃"
                                color="#BD10E0"
                                trend="up"
                            />
                            <StatsCard
                                title="Temperature"
                                value={formatHealthValue(healthData.bodyTemp, "bodyTemp")}
                                unit="°C"
                                icon="🌡️"
                                color="#FF6B6B"
                                canAdd
                                onAdd={() => openInputModal("bodyTemp")}
                                trend="stable"
                            />
                        </View>

                        {healthData.bloodPressure && (
                            <View style={styles.row}>
                                <StatsCard
                                    title="Blood Pressure"
                                    value={`${healthData.bloodPressure.systolic}/${healthData.bloodPressure.diastolic}`}
                                    unit="mmHg"
                                    icon="🩺"
                                    color="#FF9500"
                                    canAdd
                                    onAdd={() => openInputModal("bloodPressure")}
                                    trend="stable"
                                />
                                <StatsCard
                                    title="Height"
                                    value={formatHealthValue(healthData.height, "height")}
                                    unit="cm"
                                    icon="📏"
                                    color="#5856D6"
                                    canAdd
                                    onAdd={() => openInputModal("height")}
                                />
                            </View>
                        )}
                    </View>

                    {/* Charts Section */}
                    <View style={styles.statsContainer}>
                        <Text style={styles.sectionTitle}>Weekly Trends</Text>
                        
                        {chartsLoading ? (
                            <View style={styles.loadingContainer}>
                                <Text style={styles.loadingText}>Loading charts...</Text>
                            </View>
                        ) : (
                            <>
                                {aggregatedChartData.steps.labels.length > 0 && (
                                    <View style={styles.chartContainer}>
                                        <Text style={styles.chartTitle}>Steps Progress</Text>
                                        <LineChart
                                            data={aggregatedChartData.steps}
                                            width={screenWidth - 50}
                                            height={200}
                                            chartConfig={{
                                                ...chartConfig,
                                                color: (opacity = 1) => `rgba(74, 144, 226, ${opacity})`,
                                            }}
                                            style={styles.chart}
                                        />
                                    </View>
                                )}

                                {aggregatedChartData.heartRate.labels.length > 0 && (
                                    <View style={styles.chartContainer}>
                                        <Text style={styles.chartTitle}>Heart Rate Trends</Text>
                                        <LineChart
                                            data={aggregatedChartData.heartRate}
                                            width={screenWidth - 50}
                                            height={200}
                                            chartConfig={{
                                                ...chartConfig,
                                                color: (opacity = 1) => `rgba(245, 166, 35, ${opacity})`,
                                            }}
                                            style={styles.chart}
                                        />
                                    </View>
                                )}

                                {aggregatedChartData.hydration.labels.length > 0 && (
                                    <View style={styles.chartContainer}>
                                        <Text style={styles.chartTitle}>Hydration Levels</Text>
                                        <LineChart
                                            data={aggregatedChartData.hydration}
                                            width={screenWidth - 50}
                                            height={200}
                                            chartConfig={{
                                                ...chartConfig,
                                                color: (opacity = 1) => `rgba(80, 227, 194, ${opacity})`,
                                            }}
                                            style={styles.chart}
                                        />
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Health data synced with Health Connect</Text>
                    </View>

                    {/* Input Modal */}
                    <Modal visible={showInputModal} animationType="slide" transparent>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>
                                    Add {inputType === "bloodPressure" ? "Blood Pressure" : inputType === "bodyTemp" ? "Body Temperature" : inputType === "heartRate" ? "Heart Rate" : inputType}
                                </Text>
                                
                                {inputType === "bloodPressure" ? (
                                    <>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Systolic (e.g., 120)"
                                            value={inputValue}
                                            onChangeText={setInputValue}
                                            keyboardType="numeric"
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Diastolic (e.g., 80)"
                                            value={inputValue2}
                                            onChangeText={setInputValue2}
                                            keyboardType="numeric"
                                        />
                                    </>
                                ) : (
                                    <TextInput
                                        style={styles.input}
                                        placeholder={
                                            inputType === "weight" ? "Weight in kg (e.g., 70.5)" :
                                            inputType === "height" ? "Height in cm (e.g., 175)" :
                                            inputType === "heartRate" ? "Heart rate (e.g., 72)" :
                                            inputType === "bodyTemp" ? "Temperature in °C (e.g., 36.8)" :
                                            inputType === "hydration" ? "Water in ml (e.g., 250)" :
                                            "Enter value"
                                        }
                                        value={inputValue}
                                        onChangeText={setInputValue}
                                        keyboardType="numeric"
                                    />
                                )}

                                <View style={styles.modalButtons}>
                                    <TouchableOpacity 
                                        style={[styles.modalButton, styles.cancelButton]} 
                                        onPress={closeInputModal}
                                    >
                                        <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[
                                            styles.modalButton, 
                                            styles.saveButton,
                                            saving && styles.saveButtonDisabled
                                        ]} 
                                        onPress={saveHealthData}
                                        disabled={saving}
                                    >
                                        <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                                            {saving ? "Saving..." : "Save"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    {/* Permission Modal */}
                    <Modal visible={showPermissionModal} animationType="slide" transparent>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Health Connect Permissions</Text>
                                <Text style={styles.permissionModalText}>
                                    To provide accurate health insights, this app needs access to your health data through Health Connect.
                                    {"\n\n"}
                                    Your privacy is important - data stays on your device.
                                </Text>
                                <View style={styles.modalButtons}>
                                    <TouchableOpacity 
                                        style={[styles.modalButton, styles.cancelButton]} 
                                        onPress={skipPermissions}
                                    >
                                        <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Skip</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.modalButton, styles.saveButton]} 
                                        onPress={retryPermissions}
                                    >
                                        <Text style={[styles.modalButtonText, styles.saveButtonText]}>Grant Access</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                </ScrollView>
            </SafeAreaView>
        </SafeAreaProvider>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#6C63FF",
    },
    container: {
        flex: 1,
        backgroundColor: "#F8F9FA",
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        backgroundColor: "#F8F9FA",
    },
    header: {
        padding: 24,
        paddingTop: 16,
        backgroundColor: "#6C63FF",
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        shadowColor: "#6C63FF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    headerContent: {
        flex: 1,
    },
    title: {
        fontSize: 32,
        fontWeight: "700",
        color: "white",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: "rgba(255, 255, 255, 0.8)",
        fontWeight: "400",
    },
    centerTitle: {
        fontSize: 32,
        fontWeight: "700",
        color: "#333",
        textAlign: "center",
        marginBottom: 8,
    },
    centerSubtitle: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginBottom: 24,
    },
    button: {
        backgroundColor: "#6C63FF",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        shadowColor: "#6C63FF",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    buttonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
    statsContainer: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: "700",
        marginBottom: 20,
        color: "#2D3748",
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 16,
        gap: 12,
    },
    card: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 20,
        flex: 1,
        borderLeftWidth: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    cardIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    cardTitle: {
        fontSize: 14,
        color: "#718096",
        fontWeight: "600",
        flex: 1,
    },
    cardValue: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 4,
    },
    cardUnit: {
        fontSize: 14,
        color: "#A0AEC0",
        fontWeight: "500",
    },
    progressContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
    },
    progressBar: {
        flex: 1,
        height: 8,
        backgroundColor: "#F1F5F9",
        borderRadius: 4,
        marginRight: 12,
    },
    progressFill: {
        height: "100%",
        borderRadius: 4,
    },
    progressText: {
        fontSize: 12,
        color: "#718096",
        fontWeight: "600",
    },
    trendContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    trendIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    trendText: {
        fontSize: 12,
        color: "#718096",
        fontWeight: "500",
    },
    chartContainer: {
        backgroundColor: "white",
        borderRadius: 16,
        marginBottom: 20,
        paddingVertical: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#2D3748",
        marginBottom: 12,
        marginLeft: 20,
    },
    chart: {
        borderRadius: 16,
    },
    footer: {
        padding: 24,
        alignItems: "center",
    },
    footerText: {
        fontSize: 14,
        color: "#A0AEC0",
        textAlign: "center",
        fontWeight: "500",
    },
    addButton: {
        borderRadius: 12,
        width: 28,
        height: 28,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    addButtonText: {
        color: "white",
        fontSize: 18,
        fontWeight: "600",
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    modalContent: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 24,
        width: "85%",
        maxWidth: 350,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 20,
        textAlign: "center",
        color: "#2D3748",
    },
    input: {
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        fontSize: 16,
        backgroundColor: "#F8F9FA",
    },
    modalButtons: {
        flexDirection: "row",
        gap: 12,
    },
    modalButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    cancelButton: {
        backgroundColor: "#F1F5F9",
    },
    saveButton: {
        backgroundColor: "#6C63FF",
        shadowColor: "#6C63FF",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    saveButtonDisabled: {
        backgroundColor: "#CBD5E0",
        shadowOpacity: 0,
        elevation: 0,
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: "600",
    },
    cancelButtonText: {
        color: "#718096",
    },
    saveButtonText: {
        color: "white",
    },
    permissionPrompt: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.3)",
    },
    permissionPromptText: {
        color: "white",
        fontSize: 14,
        fontWeight: "600",
    },
    permissionModalText: {
        fontSize: 16,
        color: "#718096",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 24,
    },
    loadingContainer: {
        padding: 40,
        alignItems: "center",
    },
    loadingText: {
        fontSize: 16,
        color: "#6C63FF",
        fontWeight: "500",
    },
})

export default HealthDashboard
