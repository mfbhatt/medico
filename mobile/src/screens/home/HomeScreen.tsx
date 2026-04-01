/**
 * Patient Home Screen — upcoming appointments, quick actions, health summary.
 */
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import appointmentApi from "../../services/appointmentApi";
import { useAppSelector } from "../../store/hooks";
import { shadows } from "../../utils/theme";

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAppSelector((s) => s.auth);

  const {
    data: appointmentsRes,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["upcomingAppointments", user?.patient_id],
    queryFn: () =>
      appointmentApi.getMyAppointments({
        status: "scheduled,checked_in",
        limit: 5,
      }),
    enabled: !!user,
  });

  const appointments = appointmentsRes ?? [];

  const quickActions = [
    {
      label: "Book Appointment",
      icon: "calendar-outline" as const,
      onPress: () => navigation.navigate("BookAppointment"),
      color: "#1e40af",
    },
    {
      label: "My Prescriptions",
      icon: "medkit-outline" as const,
      onPress: () => navigation.navigate("Prescriptions"),
      color: "#059669",
    },
    {
      label: "Lab Reports",
      icon: "flask-outline" as const,
      onPress: () => navigation.navigate("LabReports"),
      color: "#7c3aed",
    },
    {
      label: "Medical Records",
      icon: "document-text-outline" as const,
      onPress: () => navigation.navigate("MedicalRecords"),
      color: "#dc2626",
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Greeting */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.greeting} numberOfLines={1}>
            Good {getGreeting()}, {user?.first_name || "Patient"}
          </Text>
          <Text style={styles.subGreeting}>How are you feeling today?</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => navigation.navigate("Profile")}
        >
          <Text style={styles.avatarText}>
            {(user?.first_name || "P").charAt(0)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={[styles.quickAction, { borderTopColor: action.color }]}
            onPress={action.onPress}
          >
            <Ionicons name={action.icon} size={28} color={action.color} style={styles.quickActionIcon} />
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Upcoming Appointments */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Appointments")}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#1e40af" style={{ marginTop: 20 }} />
      ) : appointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={56} color="#cbd5e1" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No upcoming appointments</Text>
          <Text style={styles.emptySubtitle}>
            Book an appointment to get started
          </Text>
          <TouchableOpacity
            style={styles.bookNowBtn}
            onPress={() => navigation.navigate("BookAppointment")}
          >
            <Text style={styles.bookNowText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        appointments.map((appt: any) => (
          <TouchableOpacity
            key={appt.id}
            style={styles.appointmentCard}
            onPress={() =>
              navigation.navigate("AppointmentDetail", { appointmentId: appt.id })
            }
          >
            <View style={styles.apptLeft}>
              <View style={styles.apptDateBox}>
                <Text style={styles.apptDay}>
                  {new Date(appt.scheduled_date).getDate()}
                </Text>
                <Text style={styles.apptMonth}>
                  {new Date(appt.scheduled_date).toLocaleString("en", {
                    month: "short",
                  })}
                </Text>
              </View>
            </View>
            <View style={styles.apptRight}>
              <Text style={styles.apptDoctor} numberOfLines={1}>
                {appt.doctor_name || "Doctor"}
              </Text>
              <Text style={styles.apptTime}>{appt.scheduled_time}</Text>
              <View
                style={[
                  styles.apptStatus,
                  { backgroundColor: getStatusColor(appt.status) },
                ]}
              >
                <Text style={styles.apptStatusText}>{appt.status}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.apptAction}
              onPress={() =>
                navigation.navigate("AppointmentDetail", {
                  appointmentId: appt.id,
                })
              }
            >
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}

      {/* Health Tips */}
      <Text style={styles.sectionTitle}>Health Tips</Text>
      <View style={styles.healthTipCard}>
        <Ionicons name="bulb-outline" size={36} color="#f59e0b" style={styles.healthTipIcon} />
        <View style={styles.healthTipContent}>
          <Text style={styles.healthTipTitle}>Stay Hydrated</Text>
          <Text style={styles.healthTipBody}>
            Drink at least 8 glasses of water daily to maintain optimal health.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

function getStatusColor(status: string): string {
  switch (status) {
    case "scheduled": return "#dbeafe";
    case "confirmed": return "#d1fae5";
    case "completed": return "#e0e7ff";
    case "cancelled": return "#fee2e2";
    case "no_show": return "#fef3c7";
    default: return "#f1f5f9";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 16, backgroundColor: "#1e40af" },
  greeting: { fontSize: 22, fontWeight: "700", color: "#fff" },
  subGreeting: { fontSize: 14, color: "#bfdbfe", marginTop: 2 },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#fff" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1e293b", paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  seeAll: { fontSize: 14, color: "#1e40af", fontWeight: "600" },
  quickActionsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  quickAction: { flex: 1, flexBasis: '45%', backgroundColor: "#fff", borderRadius: 12, padding: 16, borderTopWidth: 3, ...shadows.sm },
  quickActionIcon: { marginBottom: 8 },
  quickActionLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  emptyState: { alignItems: "center", paddingVertical: 40, marginHorizontal: 20 },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#1e293b", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#64748b", textAlign: "center" },
  bookNowBtn: { marginTop: 20, backgroundColor: "#1e40af", paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10 },
  bookNowText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  appointmentCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 20, marginBottom: 12, borderRadius: 12, padding: 16, ...shadows.sm },
  apptLeft: { marginRight: 14 },
  apptDateBox: { width: 50, height: 56, backgroundColor: "#eff6ff", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  apptDay: { fontSize: 22, fontWeight: "800", color: "#1e40af" },
  apptMonth: { fontSize: 11, color: "#3b82f6", fontWeight: "600", textTransform: "uppercase" },
  apptRight: { flex: 1 },
  apptDoctor: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  apptTime: { fontSize: 13, color: "#64748b", marginTop: 2 },
  apptStatus: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 6 },
  apptStatusText: { fontSize: 11, fontWeight: "600", color: "#374151", textTransform: "capitalize" },
  apptAction: { paddingLeft: 8 },
  healthTipCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 20, marginBottom: 40, borderRadius: 12, padding: 16, ...shadows.sm },
  healthTipIcon: { marginRight: 14 },
  healthTipContent: { flex: 1 },
  healthTipTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  healthTipBody: { fontSize: 13, color: "#64748b", lineHeight: 18 },
});
