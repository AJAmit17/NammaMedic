// MapBox Test Component - Use this to test your MapBox integration
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MapBoxService } from '@/lib/MapBoxService';

export const MapBoxTest = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string>('');

    const testMapBox = async () => {
        setIsLoading(true);
        setResult('Testing MapBox API...');

        try {
            // Test with a known location (Bangalore, India)
            const facilities = await MapBoxService.findNearbyMedicalFacilities(
                12.9716, // Bangalore latitude
                77.5946, // Bangalore longitude
                3000     // 3km radius
            );

            if (facilities.length > 0) {
                setResult(`✅ Success! Found ${facilities.length} facilities near Bangalore:\n\n` +
                    facilities.slice(0, 3).map((f, i) =>
                        `${i + 1}. ${f.name}\n   Distance: ${f.distance.toFixed(2)}km\n   Category: ${f.category}`
                    ).join('\n\n')
                );
            } else {
                setResult('⚠️ MapBox API responded but found no facilities. This might be normal in some areas.');
            }
        } catch (error) {
            setResult(`❌ MapBox API Error:\n${error}`);
            Alert.alert(
                'MapBox Test Failed',
                'Please check:\n1. Your EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env.local\n2. Internet connection\n3. MapBox token permissions',
                [{ text: 'OK' }]
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>MapBox API Test</Text>

            <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={testMapBox}
                disabled={isLoading}
            >
                <Text style={styles.buttonText}>
                    {isLoading ? 'Testing...' : 'Test MapBox API'}
                </Text>
            </TouchableOpacity>

            {result ? (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultText}>{result}</Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
    },
    buttonDisabled: {
        backgroundColor: '#999',
    },
    buttonText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    resultContainer: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    resultText: {
        fontSize: 12,
        fontFamily: 'monospace',
    },
});

export default MapBoxTest;
