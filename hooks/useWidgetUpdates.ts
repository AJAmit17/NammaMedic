import { useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { updateStepsWidget, updateHydrationWidget, updateAllHealthWidgets } from '../lib/WidgetUpdateService';

/**
 * Hook to trigger real-time widget updates and monitor app lifecycle
 */
export function useWidgetUpdates() {
    useEffect(() => {
        console.log('Widget update monitoring initialized');

        // Listen to app state changes
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                // App has come to foreground - update all widgets with latest data
                console.log('App became active - updating all widgets');
                updateAllHealthWidgets();
            }
        };

        // Subscribe to app state changes
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Cleanup subscription on unmount
        return () => {
            subscription?.remove();
        };
    }, []);

    // Real-time widget update functions
    const updateSteps = useCallback(async (steps?: number) => {
        await updateStepsWidget(steps);
    }, []);

    const updateHydration = useCallback(async (intake?: number) => {
        await updateHydrationWidget(intake);
    }, []);

    const updateAllWidgets = useCallback(async () => {
        await updateAllHealthWidgets();
    }, []);

    return {
        updateSteps,
        updateHydration,
        updateAllWidgets
    };
}

/**
 * Manual trigger to refresh widget data
 * This updates the stored data that widgets will fetch on their next update cycle
 */
export function triggerWidgetDataRefresh() {
    console.log('Widget data refresh triggered - data will be updated on next widget update cycle');
}
