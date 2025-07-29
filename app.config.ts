import type { ConfigContext, ExpoConfig } from 'expo/config';
import type { WithAndroidWidgetsParams } from 'react-native-android-widget';

const widgetConfig: WithAndroidWidgetsParams = {
    widgets: [
        {
            name: 'Steps',
            label: 'Daily Steps Counter',
            minWidth: '320dp',  // 2 cells × 80dp per cell
            minHeight: '160dp', // 2 cells × 80dp per cell
            targetCellWidth: 4,
            targetCellHeight: 2,
            description: 'Track your daily steps progress',
            previewImage: './assets/images/steps.png',
            updatePeriodMillis: 1800000 // Update every 30 minutes
        },
        {
            name: 'Hydration',
            label: 'Hydration Tracker',
            minWidth: '320dp',  // 2 cells × 80dp per cell
            minHeight: '160dp', // 2 cells × 80dp per cell
            targetCellWidth: 4,
            targetCellHeight: 2,
            description: 'Monitor your daily water intake',
            previewImage: './assets/images/water.png',
            updatePeriodMillis: 1800000 // Update every 30 minutes
        }
    ],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "Namma Medic",
    slug: "namma-medic",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
        supportsTablet: true,
        infoPlist: {
            NSMicrophoneUsageDescription: "This app uses the microphone for AI Doctor voice input to help answer your medical questions.",
            NSPhoneCallUsageDescription: "This app makes emergency calls to your emergency contacts and doctors."
        }
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/images/adaptive-icon.png",
            backgroundColor: "#ffffff"
        },
        package: "com.amit.namma_medic",
        permissions: [
            "android.permission.RECORD_AUDIO",
            "android.permission.CALL_PHONE",
            "android.permission.USE_BIOMETRIC",
            "android.permission.health.READ_STEPS",
            "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
            "android.permission.health.WRITE_ACTIVE_CALORIES_BURNED",
            "android.permission.health.READ_EXERCISE",
            "android.permission.health.WRITE_EXERCISE",
            "android.permission.health.WRITE_EXERCISE_ROUTE",
            "android.permission.health.READ_HEART_RATE",
            "android.permission.health.WRITE_HEART_RATE",
            "android.permission.health.READ_DISTANCE",
            "android.permission.health.WRITE_DISTANCE",
            "android.permission.health.READ_WEIGHT",
            "android.permission.health.WRITE_WEIGHT",
            "android.permission.health.READ_HEIGHT",
            "android.permission.health.WRITE_HEIGHT",
            "android.permission.health.READ_BLOOD_PRESSURE",
            "android.permission.health.WRITE_BLOOD_PRESSURE",
            "android.permission.health.READ_BODY_TEMPERATURE",
            "android.permission.health.WRITE_BODY_TEMPERATURE",
            "android.permission.health.READ_SLEEP",
            "android.permission.health.WRITE_SLEEP",
            "android.permission.health.READ_HYDRATION",
            "android.permission.health.WRITE_HYDRATION",
            "android.permission.health.READ_NUTRITION",
            "android.permission.health.WRITE_NUTRITION",
            "android.permission.health.READ_OXYGEN_SATURATION",
            "android.permission.health.WRITE_OXYGEN_SATURATION"
        ]
    },
    web: {
        bundler: "metro"
    },
    plugins: [
        ['react-native-android-widget', widgetConfig],
        "expo-router",
        ["expo-health-connect"],
        [
            "expo-location",
            {
                locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location."
            }
        ],
        [
            "expo-splash-screen",
            {
                image: "./assets/images/splash-icon.png",
                imageWidth: 200,
                resizeMode: "contain",
                backgroundColor: "#ffffff"
            }
        ],
        [
            "expo-build-properties",
            {
                android: {
                    compileSdkVersion: 35,
                    targetSdkVersion: 35,
                    buildToolsVersion: "35.0.0",
                    minSdkVersion: 26
                },
                ios: {
                    deploymentTarget: "15.1"
                }
            }
        ],
        "expo-font",
        "expo-secure-store",
        [
            "expo-av",
            {
                microphonePermission: "Allow Namma Medic to access your microphone for voice input in the AI Doctor feature."
            }
        ],
        [
            "expo-local-authentication",
            {
                faceIDPermission: "Allow Namma Medic to use Face ID."
            }
        ],
        [
            "expo-notifications",
            {
                icon: "./assets/images/notification_icon.png",
                color: "#ffffff",
                defaultChannel: "default",
                sounds: ["./assets/audio/medicine.wav", "./assets/audio/water.wav"]
            }
        ]
    ],
    experiments: {
        typedRoutes: true
    },
    extra: {
        router: {
            origin: false
        },
        eas: {
            projectId: "0b301786-070b-4947-8004-95e70311f1fe"
        }
    },
    owner: "cypher176",
    runtimeVersion: {
        policy: "appVersion"
    },
    updates: {
        url: "https://u.expo.dev/0b301786-070b-4947-8004-95e70311f1fe"
    }
});