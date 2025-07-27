// Legacy hook - Use the new useHealthData hook instead
// This file is kept for backward compatibility

import React from 'react';
import { useHealthData } from './health';

/**
 * @deprecated Use useHealthData from './health' instead
 */
const useGoogleHealthConnect = (date: Date) => {
    const { dailyData, loadDailyData } = useHealthData();

    // Load data when date changes
    React.useEffect(() => {
        loadDailyData(date);
    }, [date, loadDailyData]);

    return {
        steps: dailyData?.steps || 0,
        flights: 0, // Not directly available in new structure
        distance: dailyData?.distance || 0,
    };
};

export default useGoogleHealthConnect;