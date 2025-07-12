import * as React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { WidgetPreview } from 'react-native-android-widget';
import { HelloWidget } from '@/components/widgets/helloWidget';
import { FitnessWidget } from '@/components/widgets/FitnessWidget';
import { openHealthConnectSettingsScreen } from '@/utils/healthUtils';

export default function HelloWidgetPreviewScreen() {
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>Widget Previews</Text>

            <Text style={styles.subtitle}>Hello Widget</Text>
            <WidgetPreview
                renderWidget={() => <HelloWidget />}
                width={320}
                height={200}
            />

            <Text style={styles.subtitle}>Fitness Widget (Static/Mock Data)</Text>
            <WidgetPreview
                renderWidget={() => <FitnessWidget />}
                width={320}
                height={200}
            />

            <Text style={styles.subtitle}>Widget Data Service Test</Text>
            <View style={styles.testButtonsContainer}>
                <TouchableOpacity style={[styles.testButton, { backgroundColor: '#6C5CE7' }]} onPress={openHealthConnectSettingsScreen}>
                    <Text style={styles.testButtonText}>Open Health Connect Settings</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    contentContainer: {
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 20,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        marginTop: 20,
        marginBottom: 10,
        textAlign: 'center',
    },
    reactComponentContainer: {
        width: 320,
        height: 200,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        overflow: 'hidden',
    },
    testButtonsContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    testButton: {
        backgroundColor: '#1a8e2d',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        marginVertical: 5,
    },
    testButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    lastRefreshText: {
        fontSize: 12,
        color: '#666',
        marginTop: 10,
        textAlign: 'center',
    },
});
