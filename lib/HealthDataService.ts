import { WeeklyHealthData } from '../hooks/health/types';

export interface HealthReportData {
    patientName: string;
    reportDate: string;
    weeklyData: WeeklyHealthData;
    summary: {
        averageSteps: number;
        averageHeartRate: number;
        averageWaterIntake: number;
        averageTemperature: number;
        stepsGoalAchievement: number; // percentage
        heartRateVariability: string;
        hydrationStatus: string;
        temperatureStatus: string;
    };
}

export class HealthDataService {
    static async generateWeeklyReport(
        weeklyData: WeeklyHealthData,
        patientName: string,
        stepsGoal: number = 10000
    ): Promise<HealthReportData> {
        const summary = {
            averageSteps: this.calculateAverage(weeklyData.steps.map(d => d.value)),
            averageHeartRate: this.calculateAverage(weeklyData.heartRate.map(d => d.value)),
            averageWaterIntake: this.calculateAverage(weeklyData.water.map(d => d.value)),
            averageTemperature: this.calculateAverage(weeklyData.temperature.map(d => d.value)),
            stepsGoalAchievement: this.calculateGoalAchievement(weeklyData.steps.map(d => d.value), stepsGoal),
            heartRateVariability: this.analyzeHeartRateVariability(weeklyData.heartRate.map(d => d.value)),
            hydrationStatus: this.analyzeHydrationStatus(weeklyData.water.map(d => d.value)),
            temperatureStatus: this.analyzeTemperatureStatus(weeklyData.temperature.map(d => d.value)),
        };

        return {
            patientName,
            reportDate: new Date().toISOString().split('T')[0],
            weeklyData,
            summary,
        };
    }

    static async sendReportToDoctor(reportData: HealthReportData, doctorInfo: {
        name: string;
        phone: string;
        email?: string;
    }): Promise<boolean> {
        try {
            // Format the report for sending
            const reportText = this.formatReportForDoctor(reportData);

            // Here you would implement the actual sending logic
            // This could be email, SMS, or API call to a healthcare platform
            console.log('Sending health report to doctor:', {
                doctor: doctorInfo,
                report: reportText
            });

            // For now, just log the report
            return true;
        } catch (error) {
            console.error('Error sending report to doctor:', error);
            return false;
        }
    }

    private static calculateAverage(values: number[]): number {
        if (values.length === 0) return 0;
        const sum = values.reduce((acc, val) => acc + val, 0);
        return Math.round((sum / values.length) * 100) / 100;
    }

    private static calculateGoalAchievement(steps: number[], goal: number): number {
        if (steps.length === 0) return 0;
        const achievedDays = steps.filter(s => s >= goal).length;
        return Math.round((achievedDays / steps.length) * 100);
    }

    private static analyzeHeartRateVariability(heartRates: number[]): string {
        if (heartRates.length === 0) return 'No data';

        const avg = this.calculateAverage(heartRates);
        const variance = heartRates.reduce((acc, hr) => acc + Math.pow(hr - avg, 2), 0) / heartRates.length;
        const standardDeviation = Math.sqrt(variance);

        if (standardDeviation < 5) return 'Low variability';
        if (standardDeviation < 15) return 'Normal variability';
        return 'High variability';
    }

    private static analyzeHydrationStatus(waterIntake: number[]): string {
        const avgIntake = this.calculateAverage(waterIntake);

        if (avgIntake < 1.5) return 'Below recommended (needs improvement)';
        if (avgIntake < 2.5) return 'Adequate hydration';
        if (avgIntake < 3.5) return 'Good hydration';
        return 'Excellent hydration';
    }

    private static analyzeTemperatureStatus(temperatures: number[]): string {
        const avgTemp = this.calculateAverage(temperatures);

        if (avgTemp < 36.1) return 'Below normal range';
        if (avgTemp > 37.2) return 'Above normal range';
        return 'Normal range';
    }

    private static formatReportForDoctor(reportData: HealthReportData): string {
        const { patientName, reportDate, summary } = reportData;

        return `
WEEKLY HEALTH REPORT

Patient: ${patientName}
Report Date: ${reportDate}

SUMMARY:
- Average Daily Steps: ${summary.averageSteps.toLocaleString()} (${summary.stepsGoalAchievement}% goal achievement)
- Average Heart Rate: ${summary.averageHeartRate} bpm (${summary.heartRateVariability})
- Average Water Intake: ${summary.averageWaterIntake.toFixed(1)}L (${summary.hydrationStatus})
- Average Body Temperature: ${summary.averageTemperature.toFixed(1)}°C (${summary.temperatureStatus})

DETAILED DATA:
${this.formatWeeklyDataDetails(reportData.weeklyData)}

This report was automatically generated from the patient's health monitoring app.
    `.trim();
    }

    private static formatWeeklyDataDetails(weeklyData: WeeklyHealthData): string {
        const dates = weeklyData.steps.map(d => d.date);

        let details = 'Daily Breakdown:\n';

        dates.forEach(date => {
            const steps = weeklyData.steps.find(d => d.date === date)?.value || 0;
            const heartRate = weeklyData.heartRate.find(d => d.date === date)?.value || 0;
            const water = weeklyData.water.find(d => d.date === date)?.value || 0;
            const temp = weeklyData.temperature.find(d => d.date === date)?.value || 0;

            details += `${date}: ${steps.toLocaleString()} steps, ${heartRate} bpm, ${water.toFixed(1)}L, ${temp.toFixed(1)}°C\n`;
        });

        return details;
    }
}
