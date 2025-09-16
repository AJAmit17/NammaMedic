
# NammaMedic Overview

NammaMedic is a cross-platform mobile health application built with React Native and Expo. It serves as a complete medication and health management platform, integrating health data, AI-powered medical assistance, and secure healthcare provider data sharing.

## Purpose and Scope

NammaMedic provides:
- Medication management (dose tracking, reminders, emergency contact integration)
- Health metrics tracking (steps, heart rate, hydration, temperature)
- AI medical assistant (prescription analysis, medical Q&A powered by Google Generative AI)
- Secure provider integration (time-limited medical data sharing)
- Home screen widgets for real-time health metrics

For more details, see:
- [Medication Management](https://deepwiki.com/AJAmit17/NammaMedic/4.1-medication-management)
- [Health Dashboard](https://deepwiki.com/AJAmit17/NammaMedic/4.2-health-dashboard)
- [AI-Powered Features](https://deepwiki.com/AJAmit17/NammaMedic/7-ai-powered-features)
- [Application Architecture](https://deepwiki.com/AJAmit17/NammaMedic/3-application-architecture)
- [Health Data Integration](https://deepwiki.com/AJAmit17/NammaMedic/5-health-data-integration)

## Application Foundation

### Core Technology Stack

| Feature         | Technology                                    | Description                                 |
|-----------------|-----------------------------------------------|---------------------------------------------|
| Framework       | React Native + Expo                           | Cross-platform mobile development           |
| Navigation      | expo-router                                   | File-based routing system                   |
| UI Framework    | react-native-paper                            | Material Design components                  |
| Health Data     | react-native-health-connect                    | Android Health Connect integration          |
| AI Services     | @google/generative-ai                         | Prescription analysis and AI doctor         |
| Speech          | @elevenlabs/react                             | Voice synthesis for AI interactions         |
| Data Storage    | @react-native-async-storage/async-storage     | Local data persistence                      |
| Widgets         | react-native-android-widget                   | Home screen health widgets                  |

## Core Application Configuration

The app is configured via `app.config.ts`, defining platform-specific settings, permissions, and plugin configurations.

### Platform Permissions and Features

| Feature      | Permissions                                                        |
|--------------|---------------------------------------------------------------------|
| Health Data  | android.permission.health.READ_STEPS, android.permission.health.READ_HEART_RATE |
| Biometric    | android.permission.USE_BIOMETRIC                                   |
| Communication| android.permission.CALL_PHONE, android.permission.RECORD_AUDIO      |
| Hydration    | android.permission.health.READ_HYDRATION, android.permission.health.WRITE_HYDRATION |

### Widget Configuration

Android widgets are configured for health tracking with automatic updates.

## Key Dependencies and Integrations

### Health and Medical Integration
- Health Connect: `expo-health-connect` and `react-native-health-connect` for Android health platform
- AI Medical Services: `@google/generative-ai` for prescription analysis and medical Q&A
- Biometric Authentication: `expo-local-authentication` for secure data access

### Data Management and Storage
- Local Storage: `@react-native-async-storage/async-storage` for medication data, profiles, and settings
- Secure Storage: `expo-secure-store` for authentication tokens and encryption keys
- Cryptography: `crypto-js` for secure medical data sharing

### User Experience Enhancements
- Voice Interaction: `@elevenlabs/react` and `expo-speech-recognition` for voice-based AI doctor
- Notifications: `expo-notifications` for medication reminders
- Charts: `react-native-chart-kit`, `react-native-circular-progress-indicator` for health metrics visualization

## Application Scope and Boundaries

NammaMedic is designed for Android-first deployment with iOS compatibility, leveraging platform-specific health APIs while maintaining a cross-platform React Native architecture.

### Core Capabilities
1. Medication Management: Dose tracking, reminders, emergency contact integration
2. Health Metrics: Steps, heart rate, hydration, temperature monitoring
3. AI Medical Assistant: Prescription analysis, medical Q&A
4. Provider Integration: Secure, time-limited medical data sharing
5. Home Screen Widgets: Real-time health metric display

---

For more documentation, visit [DeepWiki](https://deepwiki.com/AJAmit17/NammaMedic/1-nammamedic-overview) or the [GitHub repository](https://github.com/AJAmit17/NammaMedic).
