/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import {
    FlexWidget,
    IconWidget,
    TextWidget,
} from 'react-native-android-widget';

interface StepData {
    currentSteps: number;
    stepGoal: number;
    weekAvg: number;
    distance: number;
    lastUpdated?: string;
    dataSource?: 'health_connect' | 'mock' | 'cached';
    permissionStatus?: 'granted' | 'denied' | 'not_requested' | 'unknown';
}

interface FitnessWidgetProps {
    stepData?: StepData;
}

interface RingProgressProps {
    steps: number;
    goal: number;
}

function RingProgress({ steps, goal }: RingProgressProps) {
    const progress = Math.min(steps / goal, 1);
    const progressColor = progress >= 1 ? '#4CAF50' : '#6B7280';

    return (
        <FlexWidget
            style={{
                width: 100,
                height: 100,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {/* Outer ring background */}
            <FlexWidget
                style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    borderWidth: 6,
                    borderColor: '#2a2a2a',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {/* Progress ring */}
                <FlexWidget
                    style={{
                        width: 88,
                        height: 88,
                        borderRadius: 44,
                        borderWidth: 6,
                        borderColor: progress > 0 ? progressColor : '#2a2a2a',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {/* Center content */}
                    <FlexWidget
                        style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 76,
                            height: 76,
                        }}
                    >
                        <TextWidget
                            style={{
                                fontSize: 18,
                                fontWeight: 'bold',
                                color: '#FFFFFF',
                                textAlign: 'center',
                            }}
                            text={steps.toLocaleString()}
                        />
                        <TextWidget
                            style={{
                                fontSize: 10,
                                color: '#9CA3AF',
                                textAlign: 'center',
                                marginTop: 1,
                            }}
                            text="Steps"
                        />
                        <TextWidget
                            style={{
                                fontSize: 8,
                                color: '#6B7280',
                                textAlign: 'center',
                                marginTop: 1,
                            }}
                            text={`${Math.round(progress * 100)}%`}
                        />
                    </FlexWidget>
                </FlexWidget>
            </FlexWidget>
        </FlexWidget>
    );
}

export function FitnessWidget({ stepData }: FitnessWidgetProps) {
    // Use provided data or default mock data
    const data: StepData = stepData || {
        currentSteps: 8247,
        stepGoal: 10000,
        weekAvg: 7420,
        distance: 6.6,
        lastUpdated: new Date().toISOString(),
        dataSource: 'mock',
        permissionStatus: 'not_requested',
    };

    // Format last updated text
    const getLastUpdatedText = () => {
        if (!data.lastUpdated) return '';
        const lastUpdate = new Date(data.lastUpdated);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return lastUpdate.toLocaleDateString();
    };

    // Get data source indicator
    const getDataSourceText = () => {
        switch (data.dataSource) {
            case 'health_connect':
                return '🟢 Live';
            case 'mock':
                return '🟡 Demo';
            case 'cached':
                return '🔵 Cache';
            default:
                return '';
        }
    };

    return (
        <FlexWidget
            style={{
                backgroundColor: '#1a1a1a',
                height: 'match_parent',
                width: 'match_parent',
                borderRadius: 16,
                padding: 16,
            }}
        >
            {/* Header with refresh button */}
            <FlexWidget
                style={{
                    flexDirection: 'row',
                    width: 'match_parent',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                }}
            >
                <FlexWidget style={{ flex: 1 }}>
                    <TextWidget
                        style={{ fontSize: 18, color: '#FFFFFF', fontWeight: 'bold' }}
                        text="Daily Steps"
                    />
                    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        {data.lastUpdated && (
                            <TextWidget
                                style={{
                                    fontSize: 10,
                                    color: '#6B7280',
                                }}
                                text={`Updated ${getLastUpdatedText()}`}
                            />
                        )}
                        {data.dataSource && (
                            <TextWidget
                                style={{
                                    fontSize: 10,
                                    color: '#6B7280',
                                    marginLeft: 8,
                                }}
                                text={getDataSourceText()}
                            />
                        )}
                    </FlexWidget>
                </FlexWidget>
                <FlexWidget
                    clickAction="refresh_steps"
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#2a2a2a',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    >
                        <TextWidget text="🔁" />
                    </FlexWidget>
                </FlexWidget>
    
                {/* Main 2x2 Layout */}
                <FlexWidget
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        width: 'match_parent',
                    }}
                >
                    {/* Left Side - Ring Progress */}
                    <FlexWidget
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <RingProgress steps={data.currentSteps} goal={data.stepGoal} />
                    </FlexWidget>

                    {/* Right Side - Stats in 2x2 grid */}
                    <FlexWidget
                        style={{
                            flex: 1,
                            flexDirection: 'column',
                            justifyContent: 'space-around',
                            paddingLeft: 8,
                        }}
                    >
                        {/* Top Row */}
                        <FlexWidget
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                marginBottom: 8,
                            }}
                        >
                            {/* Goal */}
                            <FlexWidget
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    backgroundColor: '#2a2a2a',
                                    borderRadius: 8,
                                    padding: 8,
                                    marginRight: 4,
                                }}
                            >
                                <TextWidget
                                    style={{ fontSize: 10, color: '#9CA3AF' }}
                                    text="Goal"
                                />
                                <TextWidget
                                    style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 'bold' }}
                                    text={data.stepGoal.toLocaleString()}
                                />
                            </FlexWidget>

                            {/* Week Avg */}
                            <FlexWidget
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    backgroundColor: '#2a2a2a',
                                    borderRadius: 8,
                                    padding: 8,
                                    marginLeft: 4,
                                }}
                            >
                                <TextWidget
                                    style={{ fontSize: 10, color: '#9CA3AF' }}
                                    text="Week Avg"
                                />
                                <TextWidget
                                    style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 'bold' }}
                                    text={data.weekAvg.toLocaleString()}
                                />
                            </FlexWidget>
                        </FlexWidget>

                        {/* Bottom Row */}
                        <FlexWidget
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                            }}
                        >
                            {/* Distance */}
                            <FlexWidget
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    backgroundColor: '#2a2a2a',
                                    borderRadius: 8,
                                    padding: 8,
                                    marginRight: 4,
                                }}
                            >
                                <TextWidget
                                    style={{ fontSize: 10, color: '#9CA3AF' }}
                                    text="Distance"
                                />
                                <TextWidget
                                    style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 'bold' }}
                                    text={`${data.distance.toFixed(1)}km`}
                                />
                            </FlexWidget>

                            {/* Progress % */}
                            <FlexWidget
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    backgroundColor: '#2a2a2a',
                                    borderRadius: 8,
                                    padding: 8,
                                    marginLeft: 4,
                                }}
                            >
                                <TextWidget
                                    style={{ fontSize: 10, color: '#9CA3AF' }}
                                    text="Progress"
                                />
                                <TextWidget
                                    style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 'bold' }}
                                    text={`${Math.round((data.currentSteps / data.stepGoal) * 100)}%`}
                                />
                            </FlexWidget>
                        </FlexWidget>
                    </FlexWidget>
                </FlexWidget>
            </FlexWidget>
            );
}
