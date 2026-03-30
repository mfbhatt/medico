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

import { appointmentApi } from "../../services/appointmentApi";
import { useAppSelector } from "../../store/hooks";

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAppSelector((s) => s.auth);

  const {
    data: appointmentsRes,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["upcomingAppointments", user?.patient_id],
    queryFn: () =>
      appointmentApi.listAppointments({
        patient_id: user?.patient_id,
        date_from: new Date().toISOString().split("T")[0],
        status: "scheduled",
        page_size: 5,
      }),
    enabled: !!user?.patient_id,
  });

  const appointments = appointmentsRes?.data?.data || [];

  const quickActions = [
    {
      label: "Book Appointment",
      icon: "📅",
      onPress: () => navigation.navigate("BookAppointment"),
      color: "#1e40af",
    },
    {
      label: "My Prescriptions",
      icon: "💊",
      onPress: () => navigation.navigate("Prescriptions"),
      color: "#059669",
    },
    {
      label: "Lab Reports",
      icon: "🧪",
      onPress: () => navigation.navigate("LabReports"),
      color: "#7c3aed",
    },
    {
      label: "Medical Records",
      icon: "📋",
      onPress: () => navigation.navigate("MedicalRecords"),
      color: "#dc2626",
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Greeting */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
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
            <Text style={styles.quickActionIcon}>{action.icon}</Text>
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
          <Text style={styles.emptyIcon}>📅</Text>
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
                  {new Date(appt.appointment_date).getDate()}
                </Text>
                <Text style={styles.apptMonth}>
                  {new Date(appt.appointment_date).toLocaleString("en", {
                    month: "short",
                  })}
                </Text>
              </View>
            </View>
            <View style={styles.apptRight}>
              <Text style={styles.apptDoctor}>
                Dr. {appt.doctor_id.slice(0, 8)}
              </Text>
              <Text style={styles.apptTime}>{appt.start_time}</Text>
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
              <Text style={styles.apptActionText}>›</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}

      {/* Health Tips */}
      <Text style={styles.sectionTitle}>Health Tips</Text>
      <View style={styles.healthTipCard}>
        <Text style={styles.healthTipIcon}>💡</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 48, backgroundColor: "#1e40af" },
  greeting: { fontSize: 22, fontWeight: "700", color: "#fff" },
  subGreeting: { fontSize: 14, color: "#bfdbfe", marginTop: 2 },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#fff" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1e293b", paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  seeAll: { fontSize: 14, color: "#1e40af", fontWeight: "600" },
  quickActionsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  quickAction: { width: "47%", backgroundColor: "#fff", borderRadius: 12, padding: 16, borderTopWidth: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  quickActionIcon: { fontSize: 28, marginBottom: 8 },
  quickActionLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  emptyState: { alignItems: "center", paddingVertical: 40, marginHorizontal: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#1e293b", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#64748b", textAlign: "center" },
  bookNowBtn: { marginTop: 20, backgroundColor: "#1e40af", paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10 },
  bookNowText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  appointmentCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 20, marginBottom: 12, borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
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
  apptActionText: { fontSize: 24, color: "#94a3b8" },
  healthTipCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 20, marginBottom: 40, borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  healthTipIcon: { fontSize: 36, marginRight: 14 },
  healthTipContent: { flex: 1 },
  healthTipTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  healthTipBody: { fontSize: 13, color: "#64748b", lineHeight: 18 },
});
