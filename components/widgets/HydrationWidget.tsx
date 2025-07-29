import * as React from 'react';
import {
    FlexWidget,
    TextWidget,
} from 'react-native-android-widget';

interface HydrationWidgetProps {
    intake?: number; // in ml
    goal?: number; // in ml
}

export function HydrationWidget({
    intake = 0,
    goal = 2500
}: HydrationWidgetProps) {
    // Validate props to prevent runtime errors
    const safeIntake = Math.max(0, intake || 0);
    const safeGoal = Math.max(1, goal || 2500); // Prevent division by zero

    const progress = Math.min((safeIntake / safeGoal) * 100, 100);
    const isGoalReached = safeIntake >= safeGoal;
    const remainingIntake = Math.max(safeGoal - safeIntake, 0);

    // Convert ml to liters for display
    const intakeLiters = (safeIntake / 1000).toFixed(1);
    const goalLiters = (safeGoal / 1000).toFixed(1);
    const remainingLiters = (remainingIntake / 1000).toFixed(1);

    // Water level for visual representations
    const waterLevel = Math.min(progress, 100);

    return (
        <FlexWidget
            style={{
                height: 'match_parent',
                width: 'match_parent',
                backgroundColor: '#0084ffff',
                borderRadius: 24,
                padding: 20,
                justifyContent: 'space-between',
                flexDirection: 'column',
            }}
            clickAction="OPEN_APP"
        >
            {/* Header with Icon */}
            <FlexWidget
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: 'match_parent',
                    marginBottom: 8,
                }}
            >
                <TextWidget
                    text="💧 Hydration"
                    style={{
                        fontSize: 16,
                        color: '#FFFFFF',
                        fontFamily: 'sans-serif-medium',
                    }}
                />
                <FlexWidget
                    style={{
                        width: 32,
                        height: 32,
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: 16,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <TextWidget
                        text={`${Math.round(progress)}%`}
                        style={{
                            fontSize: 12,
                            color: '#FFFFFF',
                            fontFamily: 'sans-serif-medium',
                        }}
                    />
                </FlexWidget>
            </FlexWidget>

            {/* Main Content Area */}
            <FlexWidget
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: 'match_parent',
                    flex: 1,
                }}
            >
                {/* Left Side - Current Intake */}
                <FlexWidget
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                    }}
                >
                    <FlexWidget
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: 4,
                        }}
                    >
                        <TextWidget
                            text={intakeLiters}
                            style={{
                                fontSize: 36,
                                color: '#FFFFFF',
                                fontFamily: 'sans-serif-light',
                            }}
                        />
                        <TextWidget
                            text="L"
                            style={{
                                fontSize: 20,
                                color: 'rgba(255, 255, 255, 0.8)',
                                marginLeft: 4,
                            }}
                        />
                    </FlexWidget>
                    <TextWidget
                        text={`of ${goalLiters}L goal`}
                        style={{
                            fontSize: 12,
                            color: 'rgba(255, 255, 255, 0.7)',
                        }}
                    />
                </FlexWidget>

                {/* Right Side - Water Bottle Visual */}
                <FlexWidget
                    style={{
                        width: 80,
                        height: 80,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    {/* Outer bottle container */}
                    <FlexWidget
                        style={{
                            width: 50,
                            height: 70,
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            borderRadius: 12,
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            padding: 4,
                        }}
                    >
                        {/* Water level indicator */}
                        <FlexWidget
                            style={{
                                width: 42,
                                height: Math.max((62 * waterLevel) / 100, 4),
                                backgroundColor: isGoalReached ? '#4CAF50' : '#E3F2FD',
                                borderRadius: 8,
                            }}
                        />
                    </FlexWidget>

                    {/* Bottle cap - using OverlapWidget for positioning */}
                    <FlexWidget
                        style={{
                            width: 20,
                            height: 8,
                            backgroundColor: 'rgba(255, 255, 255, 0.3)',
                            borderRadius: 4,
                            marginTop: -74,
                        }}
                    />
                </FlexWidget>
            </FlexWidget>

            {/* Bottom Status */}
            <FlexWidget
                style={{
                    width: 'match_parent',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: 8,
                    marginTop: 8,
                }}
            >
                <TextWidget
                    text={
                        isGoalReached
                            ? "🎉 Hydration goal reached!"
                            : remainingIntake > 0
                                ? `${remainingLiters}L remaining today`
                                : "Start hydrating!"
                    }
                    style={{
                        fontSize: 11,
                        color: '#FFFFFF',
                        textAlign: 'center',
                        fontFamily: 'sans-serif',
                    }}
                />
            </FlexWidget>
        </FlexWidget>
    );
}
