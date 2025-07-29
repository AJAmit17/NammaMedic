import * as React from 'react';
import { ScrollView, StyleSheet, View, Text } from 'react-native';
import { WidgetPreview } from 'react-native-android-widget';
import { StepsWidget } from '@/components/widgets/StepsWidget';
import { HydrationWidget } from '@/components/widgets/HydrationWidget';
import { getStepsDataForWidget, getHydrationDataForWidget } from '@/lib/WidgetDataService';

export default function HelloWidgetPreviewScreen() {
    const [stepsData, setStepsData] = React.useState({ steps: 0, goal: 10000 });
    const [hydrationData, setHydrationData] = React.useState({ intake: 0, goal: 2500 });
    const [isLoading, setIsLoading] = React.useState(true);

    // Load real widget data on component mount
    React.useEffect(() => {
        const loadWidgetData = async () => {
            try {
                const [steps, hydration] = await Promise.all([
                    getStepsDataForWidget(),
                    getHydrationDataForWidget()
                ]);
                setStepsData(steps);
                setHydrationData(hydration);
            } catch (error) {
                console.error('Error loading widget data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadWidgetData();
    }, []);

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
                <Text style={styles.title}>NammaMedic Widgets Preview</Text>
                <Text style={styles.subtitle}>
                    {isLoading ? 'Loading real data...' : 'Showing your current health data'}
                </Text>
                
                {/* Steps Widget Preview */}
                <View style={styles.widgetSection}>
                    <Text style={styles.widgetTitle}>Daily Steps Widget (2x2)</Text>
                    <WidgetPreview
                        renderWidget={() => (
                            <StepsWidget 
                                steps={stepsData.steps} 
                                goal={stepsData.goal} 
                            />
                        )}
                        width={160}
                        height={160}
                    />
                    <Text style={styles.widgetInfo}>
                        Steps: {stepsData.steps.toLocaleString()} / Goal: {stepsData.goal.toLocaleString()}
                    </Text>
                </View>

                {/* Hydration Widget Preview */}
                <View style={styles.widgetSection}>
                    <Text style={styles.widgetTitle}>Hydration Widget (3x2)</Text>
                    <WidgetPreview
                        renderWidget={() => (
                            <HydrationWidget 
                                intake={hydrationData.intake} 
                                goal={hydrationData.goal} 
                            />
                        )}
                        width={240}
                        height={160}
                    />
                    <Text style={styles.widgetInfo}>
                        Intake: {(hydrationData.intake / 1000).toFixed(1)}L / Goal: {(hydrationData.goal / 1000).toFixed(1)}L
                    </Text>
                </View>

                {/* Hello Widget Preview */}
                <View style={styles.widgetSection}>
                    <Text style={styles.widgetTitle}>Hello Widget (5x2)</Text>
                    <Text style={styles.widgetInfo}>
                        Sample greeting widget
                    </Text>
                </View>
                
                <View style={styles.infoSection}>
                    <Text style={styles.infoTitle}>How to Add Widgets:</Text>
                    <Text style={styles.infoText}>
                        1. Long press on your Android home screen{'\n'}
                        2. Tap "Widgets"{'\n'}
                        3. Find "NammaMedic" widgets{'\n'}
                        4. Drag and drop your preferred widget{'\n'}
                        5. Configure if needed
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: {
        flexGrow: 1,
        paddingVertical: 20,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0288D1',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    widgetSection: {
        marginBottom: 30,
        alignItems: 'center',
        width: '100%',
    },
    widgetTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    widgetInfo: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    infoSection: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 20,
        marginTop: 20,
        width: '100%',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    infoText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
});