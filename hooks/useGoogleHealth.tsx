import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { initialize, requestPermission, readRecords } from 'react-native-health-connect';
import { TimeRangeFilter } from 'react-native-health-connect/lib/typescript/types/base.types';

const useGoogleHealthConnect = (date: Date) => {
    // const [hasPermissions, setHasPermission] = useState(false);
    const [steps, setSteps] = useState(0);
    const [flights, setFlights] = useState(0);
    const [distance, setDistance] = useState(0);

    // Android - Health Connect
    const readSampleData = async () => {
        // initialize the client
        const isInitialized = await initialize();
        if (!isInitialized) return;

        // request permissions
        await requestPermission([
            { accessType: 'read', recordType: 'Steps' },
            { accessType: 'read', recordType: 'Distance' },
            { accessType: 'read', recordType: 'FloorsClimbed' },
        ]);

        const timeRangeFilter: TimeRangeFilter = {
            operator: 'between',
            startTime: new Date(date.setHours(0, 0, 0, 0)).toISOString(),
            endTime: new Date(date.setHours(23, 59, 59, 999)).toISOString(),
        };

        // Steps
        const steps = await readRecords('Steps', { timeRangeFilter });
        const totalSteps = steps.records.reduce((sum, cur) => sum + cur.count, 0);
        setSteps(totalSteps);

        // Distance
        const distance = await readRecords('Distance', { timeRangeFilter });
        const totalDistance = distance.records.reduce((sum, cur) => sum + cur.distance.inMeters, 0);
        setDistance(totalDistance);

        // Floors climbed
        const floorsClimbed = await readRecords('FloorsClimbed', {
            timeRangeFilter,
        });
        const totalFloors = floorsClimbed.records.reduce((sum, cur) => sum + cur.floors, 0);
        setFlights(totalFloors);
    };

    useEffect(() => {
        if (Platform.OS !== 'android') return;
        readSampleData();
    }, [date]);

    return { steps, flights, distance };
};

export default useGoogleHealthConnect;