import * as React from 'react';
import {
    FlexWidget,
    TextWidget
} from 'react-native-android-widget';

interface StepsWidgetProps {
    steps?: number;
    goal?: number;
}

export function StepsWidget({
    steps = 0,
    goal = 10000
}: StepsWidgetProps) {
    const safeSteps = Math.max(0, steps || 0);
    const safeGoal = Math.max(1, goal || 10000);
    const progress = Math.min((safeSteps / safeGoal) * 100, 100);
    const isGoalReached = safeSteps >= safeGoal;
    const remainingSteps = Math.max(safeGoal - safeSteps, 0);

    return (
        <FlexWidget
            style={{
                height: 'match_parent',
                width: 'match_parent',
                backgroundColor: '#1976D2',
                borderRadius: 24,
                padding: 20,
                justifyContent: 'space-between',
                flexDirection: 'column',
            }}
            clickAction="OPEN_APP"
        >
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
                    text="👟 Daily Steps"
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

            <FlexWidget
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: 'match_parent',
                    flex: 1,
                }}
            >
                <FlexWidget
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                    }}
                >
                    <TextWidget
                        text={safeSteps.toLocaleString()}
                        style={{
                            fontSize: 36,
                            color: '#FFFFFF',
                            fontFamily: 'sans-serif-light',
                            marginBottom: 4,
                        }}
                    />
                    <TextWidget
                        text={`of ${safeGoal.toLocaleString()} goal`}
                        style={{
                            fontSize: 12,
                            color: 'rgba(255, 255, 255, 0.7)',
                        }}
                    />
                </FlexWidget>

                {/* Right Side - Circular Progress */}
                <FlexWidget
                    style={{
                        width: 80,
                        height: 80,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    {/* Outer progress ring */}
                    <FlexWidget
                        style={{
                            width: 70,
                            height: 70,
                            borderRadius: 35,
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        {/* Inner progress indicator */}
                        <FlexWidget
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: isGoalReached ? '#4CAF50' : '#E3F2FD',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <TextWidget
                                text={isGoalReached ? "✓" : "🚶"}
                                style={{
                                    fontSize: 20,
                                    color: isGoalReached ? '#FFFFFF' : '#1976D2',
                                }}
                            />
                        </FlexWidget>
                    </FlexWidget>
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
                            ? "🎉 Daily goal achieved!"
                            : remainingSteps > 0
                                ? `${remainingSteps.toLocaleString()} steps to go`
                                : "Let's start walking!"
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
