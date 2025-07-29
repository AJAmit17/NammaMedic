import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { getStepsDataForWidget, getHydrationDataForWidget } from './WidgetDataService';
import { StepsWidget } from '@/components/widgets/StepsWidget';
import { HydrationWidget } from '@/components/widgets/HydrationWidget';

/**
 * Update steps widget immediately when step data changes in the app
 */
export async function updateStepsWidget(steps?: number): Promise<void> {
    try {
        console.log('🔄 Updating Steps widget...');
        
        // Get the latest steps data
        const stepsData = await getStepsDataForWidget();
        
        // Request widget update with real-time data
        requestWidgetUpdate({
            widgetName: 'Steps',
            renderWidget: () => React.createElement(StepsWidget, {
                steps: stepsData.steps,
                goal: stepsData.goal,
                widgetWidth: 'large'
            }),
            widgetNotFound: () => {
                console.log('No Steps widget found on home screen');
            }
        });
        
        console.log('✅ Steps widget update requested with data:', stepsData);
    } catch (error) {
        console.error('❌ Error updating steps widget:', error);
    }
}

/**
 * Update hydration widget immediately when water intake changes in the app
 */
export async function updateHydrationWidget(intake?: number): Promise<void> {
    try {
        console.log('🔄 Updating Hydration widget...');
        
        // Get the latest hydration data
        const hydrationData = await getHydrationDataForWidget();
        
        // Request widget update with real-time data
        requestWidgetUpdate({
            widgetName: 'Hydration',
            renderWidget: () => React.createElement(HydrationWidget, {
                intake: hydrationData.intake,
                goal: hydrationData.goal,
                widgetWidth: 'large'
            }),
            widgetNotFound: () => {
                console.log('No Hydration widget found on home screen');
            }
        });
        
        console.log('✅ Hydration widget update requested with data:', hydrationData);
    } catch (error) {
        console.error('❌ Error updating hydration widget:', error);
    }
}

/**
 * Update all health widgets at once
 */
export async function updateAllHealthWidgets(): Promise<void> {
    try {
        console.log('🔄 Updating all health widgets...');
        
        await Promise.all([
            updateStepsWidget(),
            updateHydrationWidget()
        ]);
        
        console.log('✅ All health widgets update requested');
    } catch (error) {
        console.error('❌ Error updating all health widgets:', error);
    }
}
