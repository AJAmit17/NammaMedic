import { WeeklyHealthData, getWeekRange } from '../hooks/health';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEEKLY_DATA_KEY = 'weekly_health_data';
const HISTORICAL_DATA_KEY = 'historical_health_data';

export interface StoredWeeklyData {
  weekStart: string;
  weekEnd: string;
  data: WeeklyHealthData;
  timestamp: string;
}

export class WeeklyHealthDataManager {
  static async saveWeeklyData(weeklyData: WeeklyHealthData, weekStart: Date, weekEnd: Date): Promise<void> {
    try {
      const storedData: StoredWeeklyData = {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        data: weeklyData,
        timestamp: new Date().toISOString(),
      };

      // Save current week data
      await AsyncStorage.setItem(WEEKLY_DATA_KEY, JSON.stringify(storedData));
      
      // Archive to historical data
      await this.archiveWeeklyData(storedData);
    } catch (error) {
      console.error('Error saving weekly health data:', error);
    }
  }

  static async getCurrentWeekData(): Promise<StoredWeeklyData | null> {
    try {
      const data = await AsyncStorage.getItem(WEEKLY_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading current week health data:', error);
      return null;
    }
  }

  static async getHistoricalData(weeks: number = 4): Promise<StoredWeeklyData[]> {
    try {
      const data = await AsyncStorage.getItem(HISTORICAL_DATA_KEY);
      const historicalData: StoredWeeklyData[] = data ? JSON.parse(data) : [];
      
      // Return last 'weeks' number of weeks, sorted by most recent first
      return historicalData
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, weeks);
    } catch (error) {
      console.error('Error loading historical health data:', error);
      return [];
    }
  }

  static async getAllDataForProfile(): Promise<{
    currentWeek: StoredWeeklyData | null;
    historicalWeeks: StoredWeeklyData[];
    summary: {
      totalWeeksTracked: number;
      averageStepsPerWeek: number;
      averageHeartRatePerWeek: number;
      averageWaterIntakePerWeek: number;
      averageTemperaturePerWeek: number;
    };
  }> {
    try {
      const currentWeek = await this.getCurrentWeekData();
      const historicalWeeks = await this.getHistoricalData(12); // Last 3 months
      
      const allWeeks = [currentWeek, ...historicalWeeks].filter(Boolean) as StoredWeeklyData[];
      
      const summary = this.calculateSummaryStats(allWeeks);
      
      return {
        currentWeek,
        historicalWeeks,
        summary,
      };
    } catch (error) {
      console.error('Error getting all profile health data:', error);
      return {
        currentWeek: null,
        historicalWeeks: [],
        summary: {
          totalWeeksTracked: 0,
          averageStepsPerWeek: 0,
          averageHeartRatePerWeek: 0,
          averageWaterIntakePerWeek: 0,
          averageTemperaturePerWeek: 0,
        },
      };
    }
  }

  private static async archiveWeeklyData(weekData: StoredWeeklyData): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(HISTORICAL_DATA_KEY);
      const historicalData: StoredWeeklyData[] = existingData ? JSON.parse(existingData) : [];
      
      // Check if this week's data already exists
      const existingIndex = historicalData.findIndex(
        data => data.weekStart === weekData.weekStart && data.weekEnd === weekData.weekEnd
      );
      
      if (existingIndex >= 0) {
        // Update existing data
        historicalData[existingIndex] = weekData;
      } else {
        // Add new data
        historicalData.push(weekData);
      }
      
      // Keep only last 52 weeks (1 year)
      const sortedData = historicalData
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 52);
      
      await AsyncStorage.setItem(HISTORICAL_DATA_KEY, JSON.stringify(sortedData));
    } catch (error) {
      console.error('Error archiving weekly health data:', error);
    }
  }

  private static calculateSummaryStats(allWeeks: StoredWeeklyData[]) {
    if (allWeeks.length === 0) {
      return {
        totalWeeksTracked: 0,
        averageStepsPerWeek: 0,
        averageHeartRatePerWeek: 0,
        averageWaterIntakePerWeek: 0,
        averageTemperaturePerWeek: 0,
      };
    }

    const weeklyAverages = allWeeks.map(week => ({
      steps: this.calculateWeeklyAverage(week.data.steps.map(d => d.value)),
      heartRate: this.calculateWeeklyAverage(week.data.heartRate.map(d => d.value)),
      water: this.calculateWeeklyAverage(week.data.water.map(d => d.value)),
      temperature: this.calculateWeeklyAverage(week.data.temperature.map(d => d.value)),
    }));

    return {
      totalWeeksTracked: allWeeks.length,
      averageStepsPerWeek: Math.round(
        weeklyAverages.reduce((sum, week) => sum + week.steps, 0) / weeklyAverages.length
      ),
      averageHeartRatePerWeek: Math.round(
        weeklyAverages.reduce((sum, week) => sum + week.heartRate, 0) / weeklyAverages.length
      ),
      averageWaterIntakePerWeek: Math.round(
        (weeklyAverages.reduce((sum, week) => sum + week.water, 0) / weeklyAverages.length) * 100
      ) / 100,
      averageTemperaturePerWeek: Math.round(
        (weeklyAverages.reduce((sum, week) => sum + week.temperature, 0) / weeklyAverages.length) * 100
      ) / 100,
    };
  }

  private static calculateWeeklyAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  static async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([WEEKLY_DATA_KEY, HISTORICAL_DATA_KEY]);
    } catch (error) {
      console.error('Error clearing health data:', error);
    }
  }
}