import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getMedications,
  getDoseHistory,
  recordDose,
  Medication,
  DoseHistory,
} from "../../utils/storage";
import { useFocusEffect } from "@react-navigation/native";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseHistory, setDoseHistory] = useState<DoseHistory[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [meds, history] = await Promise.all([
        getMedications(),
        getDoseHistory(),
      ]);
      setMedications(meds);
      setDoseHistory(history);
    } catch (error) {
      console.error("Error loading calendar data:", error);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days, firstDay } = getDaysInMonth(selectedDate);

  const renderCalendar = () => {
    const calendar: JSX.Element[] = [];
    let week: JSX.Element[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      week.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    // Add days of the month
    for (let day = 1; day <= days; day++) {
      const date = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        day
      );
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate.toDateString() === date.toDateString();
      const hasDoses = doseHistory.some(
        (dose) =>
          new Date(dose.timestamp).toDateString() === date.toDateString() && dose.taken
      );

      week.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday && styles.today,
            isSelected && styles.selectedDay,
            hasDoses && styles.hasEvents,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <Text style={[
            styles.dayText, 
            isToday && styles.todayText,
            isSelected && styles.selectedDayText
          ]}>
            {day}
          </Text>
          {hasDoses && <View style={styles.eventDot} />}
        </TouchableOpacity>
      );

      if ((firstDay + day) % 7 === 0 || day === days) {
        calendar.push(
          <View key={day} style={styles.calendarWeek}>
            {week}
          </View>
        );
        week = [];
      }
    }

    return calendar;
  };

  const renderMedicationsForDate = () => {
    const dateStr = selectedDate.toDateString();
    const isToday = new Date().toDateString() === dateStr;
    const isPastOrFuture = !isToday;
    
    const dayDoses = doseHistory.filter(
      (dose) => new Date(dose.timestamp).toDateString() === dateStr
    );

    const medicationCards: JSX.Element[] = [];

    medications.forEach((medication) => {
      // Skip "As needed" medications or medications with no scheduled times
      if (!medication.times || medication.times.length === 0) {
        return;
      }

      // Create a card for each scheduled time
      medication.times.forEach((time, timeIndex) => {
        const timeSlotId = `${medication.id}-${time}`;
        const taken = dayDoses.some(
          (dose) => 
            dose.medicationId === medication.id && 
            dose.taken &&
            (dose.scheduledTime === time || 
             new Date(dose.timestamp).toTimeString().slice(0, 5) === time)
        );

        medicationCards.push(
          <View key={timeSlotId} style={styles.medicationCard}>
            <View
              style={[
                styles.medicationColor,
                { backgroundColor: medication.color },
              ]}
            />
            <View style={styles.medicationInfo}>
              <Text style={styles.medicationName}>{medication.name}</Text>
              <Text style={styles.medicationDosage}>{medication.dosage}</Text>
              <View style={styles.timeContainer}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.medicationTime}>{time}</Text>
              </View>
            </View>
            {taken ? (
              <View style={styles.takenBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.takenText}>Taken</Text>
              </View>
            ) : isPastOrFuture ? (
              <View style={styles.disabledBadge}>
                <Text style={styles.disabledText}>
                  {new Date(dateStr) < new Date() ? "Past" : "Future"}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.takeDoseButton,
                  { backgroundColor: medication.color },
                ]}
                onPress={async () => {
                  // Create timestamp with the specific scheduled time
                  const today = new Date();
                  const [hours, minutes] = time.split(':').map(Number);
                  const scheduledTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
                  
                  await recordDose(medication.id, true, scheduledTime.toISOString(), time);
                  loadData();
                }}
              >
                <Text style={styles.takeDoseText}>Take</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      });
    });

    if (medicationCards.length === 0) {
      return (
        <View style={styles.noMedicationsContainer}>
          <Ionicons name="medical-outline" size={48} color="#ccc" />
          <Text style={styles.noMedicationsText}>
            No scheduled medications for this day
          </Text>
        </View>
      );
    }

    return medicationCards;
  };

  return (
    <View style={styles.container}>
      <View style={styles.calendarContainer}>
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={() =>
              setSelectedDate(
                new Date(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth() - 1,
                  1
                )
              )
            }
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {selectedDate.toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <TouchableOpacity
            onPress={() =>
              setSelectedDate(
                new Date(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth() + 1,
                  1
                )
              )
            }
          >
            <Ionicons name="chevron-forward" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.weekdayHeader}>
          {WEEKDAYS.map((day) => (
            <Text key={day} style={styles.weekdayText}>
              {day}
            </Text>
          ))}
        </View>

        {renderCalendar()}
      </View>

      <View style={styles.scheduleContainer}>
        <Text style={styles.scheduleTitle}>
          {selectedDate.toLocaleDateString("default", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {renderMedicationsForDate()}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 140 : 120,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginLeft: 15,
  },
  calendarContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    margin: 20,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  monthText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  weekdayHeader: {
    flexDirection: "row",
    marginBottom: 10,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    color: "#666",
    fontWeight: "500",
  },
  calendarWeek: {
    flexDirection: "row",
    marginBottom: 5,
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  dayText: {
    fontSize: 16,
    color: "#333",
  },
  today: {
    backgroundColor: "#1a8e2d15",
  },
  selectedDay: {
    backgroundColor: "#1a8e2d",
  },
  todayText: {
    color: "#1a8e2d",
    fontWeight: "600",
  },
  selectedDayText: {
    color: "white",
    fontWeight: "600",
  },
  hasEvents: {
    position: "relative",
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1a8e2d",
    position: "absolute",
    bottom: "15%",
  },
  scheduleContainer: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scheduleTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 15,
  },
  medicationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  medicationColor: {
    width: 12,
    height: 40,
    borderRadius: 6,
    marginRight: 15,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  medicationTime: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  takeDoseButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 12,
  },
  takeDoseText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  takenBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  takenText: {
    color: "#4CAF50",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
  disabledBadge: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  disabledText: {
    color: "#999",
    fontWeight: "500",
    fontSize: 14,
  },
  noMedicationsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  noMedicationsText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
    textAlign: "center",
  },
});
