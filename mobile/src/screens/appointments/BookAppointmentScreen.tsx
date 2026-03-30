/**
 * Book Appointment Screen — step-by-step booking flow for patients.
 * Steps: Select Doctor → Select Date → Select Slot → Confirm
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import { format, addDays, isBefore, startOfDay } from "date-fns";

import { appointmentApi } from "../../services/appointmentApi";
import { useAppSelector } from "../../store/hooks";

type Step = 1 | 2 | 3 | 4;

interface DoctorOption {
  id: string;
  name: string;
  specialization: string;
  consultation_fee: number;
  average_rating: number;
}

export default function BookAppointmentScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAppSelector((state) => state.auth);

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [visitType, setVisitType] = useState<"new" | "follow_up">("new");

  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [slots, setSlots] = useState<{ start_time: string; end_time: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  const clinicId = useAppSelector((s) => s.tenant.currentClinicId);

  // ── Step 2: Load slots for selected date ─────────────────────
  const handleDateSelect = async (day: { dateString: string }) => {
    setSelectedDate(day.dateString);
    setSelectedSlot(null);

    if (!selectedDoctor) return;

    setLoadingSlots(true);
    try {
      const res = await appointmentApi.getAvailableSlots({
        doctor_id: selectedDoctor.id,
        clinic_id: clinicId!,
        date: day.dateString,
      });
      setSlots(res.data.data.available_slots);
    } catch {
      Alert.alert("Error", "Could not load available slots. Please try again.");
    } finally {
      setLoadingSlots(false);
    }
  };

  // ── Book appointment ─────────────────────────────────────────
  const handleConfirmBooking = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot || !user) return;

    setBooking(true);
    try {
      const res = await appointmentApi.bookAppointment({
        patient_id: user.patient_id!,
        doctor_id: selectedDoctor.id,
        clinic_id: clinicId!,
        appointment_date: selectedDate,
        start_time: selectedSlot.start,
        appointment_type: "in_person",
        priority: "routine",
        chief_complaint: chiefComplaint,
        visit_type: visitType,
      });

      navigation.navigate("AppointmentConfirmation", {
        appointmentId: res.data.data.appointment_id,
        date: selectedDate,
        time: selectedSlot.start,
        doctorName: selectedDoctor.name,
      });
    } catch (error: any) {
      const msg = error.response?.data?.message || "Booking failed. Please try again.";
      Alert.alert("Booking Failed", msg);
    } finally {
      setBooking(false);
    }
  };

  // ── Min date (today) ─────────────────────────────────────────
  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

  const StepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              currentStep >= s ? styles.stepActive : styles.stepInactive,
            ]}
          >
            <Text
              style={[
                styles.stepNum,
                currentStep >= s ? styles.stepNumActive : styles.stepNumInactive,
              ]}
            >
              {s}
            </Text>
          </View>
          {s < 4 && (
            <View
              style={[
                styles.stepLine,
                currentStep > s ? styles.stepLineActive : styles.stepLineInactive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StepIndicator />

      <ScrollView style={styles.content}>
        {/* Step 1: Select Doctor */}
        {currentStep === 1 && (
          <View>
            <Text style={styles.stepTitle}>Choose a Doctor</Text>
            <FlatList
              data={doctors}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.doctorCard,
                    selectedDoctor?.id === item.id && styles.doctorCardSelected,
                  ]}
                  onPress={() => setSelectedDoctor(item)}
                >
                  <View style={styles.doctorAvatar}>
                    <Text style={styles.doctorAvatarText}>
                      {item.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.doctorInfo}>
                    <Text style={styles.doctorName}>Dr. {item.name}</Text>
                    <Text style={styles.doctorSpec}>{item.specialization}</Text>
                    <View style={styles.doctorMeta}>
                      <Text style={styles.doctorRating}>
                        ★ {item.average_rating.toFixed(1)}
                      </Text>
                      <Text style={styles.doctorFee}>
                        ${item.consultation_fee}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No doctors available</Text>
              }
            />
          </View>
        )}

        {/* Step 2: Select Date */}
        {currentStep === 2 && (
          <View>
            <Text style={styles.stepTitle}>Select Date</Text>
            <Calendar
              onDayPress={handleDateSelect}
              minDate={minDate}
              maxDate={maxDate}
              markedDates={
                selectedDate
                  ? {
                      [selectedDate]: {
                        selected: true,
                        selectedColor: "#1e40af",
                      },
                    }
                  : {}
              }
              theme={{
                todayTextColor: "#1e40af",
                selectedDayBackgroundColor: "#1e40af",
                arrowColor: "#1e40af",
              }}
            />
          </View>
        )}

        {/* Step 3: Select Time Slot */}
        {currentStep === 3 && (
          <View>
            <Text style={styles.stepTitle}>
              Available Slots — {format(new Date(selectedDate), "MMM d, yyyy")}
            </Text>
            {loadingSlots ? (
              <ActivityIndicator color="#1e40af" style={{ marginTop: 40 }} />
            ) : slots.length === 0 ? (
              <View style={styles.noSlots}>
                <Text style={styles.noSlotsText}>
                  No slots available on this date
                </Text>
                <TouchableOpacity onPress={() => setCurrentStep(2)}>
                  <Text style={styles.changeDateText}>Choose another date</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.slotChip,
                      selectedSlot?.start === slot.start_time &&
                        styles.slotChipSelected,
                    ]}
                    onPress={() =>
                      setSelectedSlot({
                        start: slot.start_time,
                        end: slot.end_time,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.slotText,
                        selectedSlot?.start === slot.start_time &&
                          styles.slotTextSelected,
                      ]}
                    >
                      {slot.start_time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Step 4: Confirm */}
        {currentStep === 4 && (
          <View>
            <Text style={styles.stepTitle}>Confirm Appointment</Text>

            <View style={styles.summary}>
              <SummaryRow label="Doctor" value={`Dr. ${selectedDoctor?.name}`} />
              <SummaryRow label="Specialization" value={selectedDoctor?.specialization || ""} />
              <SummaryRow
                label="Date"
                value={format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
              />
              <SummaryRow label="Time" value={selectedSlot?.start || ""} />
              <SummaryRow label="Type" value={visitType === "new" ? "New Patient" : "Follow-up"} />
              <SummaryRow
                label="Consultation Fee"
                value={`$${selectedDoctor?.consultation_fee}`}
              />
            </View>

            {/* Visit type */}
            <Text style={styles.sectionLabel}>Visit Type</Text>
            <View style={styles.visitTypeRow}>
              {(["new", "follow_up"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.visitTypeBtn,
                    visitType === type && styles.visitTypeBtnActive,
                  ]}
                  onPress={() => setVisitType(type)}
                >
                  <Text
                    style={[
                      styles.visitTypeBtnText,
                      visitType === type && styles.visitTypeBtnTextActive,
                    ]}
                  >
                    {type === "new" ? "New Visit" : "Follow-up"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.footer}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setCurrentStep((s) => (s - 1) as Step)}
          >
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}

        {currentStep < 4 ? (
          <TouchableOpacity
            style={[
              styles.nextBtn,
              !_canProceed(currentStep, selectedDoctor, selectedDate, selectedSlot) &&
                styles.nextBtnDisabled,
            ]}
            onPress={() => setCurrentStep((s) => (s + 1) as Step)}
            disabled={
              !_canProceed(currentStep, selectedDoctor, selectedDate, selectedSlot)
            }
          >
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, booking && styles.nextBtnDisabled]}
            onPress={handleConfirmBooking}
            disabled={booking}
          >
            {booking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextBtnText}>Confirm Booking</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function _canProceed(
  step: Step,
  doctor: DoctorOption | null,
  date: string,
  slot: { start: string; end: string } | null
): boolean {
  if (step === 1) return !!doctor;
  if (step === 2) return !!date;
  if (step === 3) return !!slot;
  return true;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  stepIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 20, paddingHorizontal: 24, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  stepItem: { flexDirection: "row", alignItems: "center" },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  stepActive: { backgroundColor: "#1e40af" },
  stepInactive: { backgroundColor: "#e2e8f0" },
  stepNum: { fontSize: 14, fontWeight: "700" },
  stepNumActive: { color: "#fff" },
  stepNumInactive: { color: "#94a3b8" },
  stepLine: { width: 40, height: 2 },
  stepLineActive: { backgroundColor: "#1e40af" },
  stepLineInactive: { backgroundColor: "#e2e8f0" },
  content: { flex: 1, padding: 20 },
  stepTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 20 },
  doctorCard: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: "#e2e8f0" },
  doctorCardSelected: { borderColor: "#1e40af", backgroundColor: "#eff6ff" },
  doctorAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#1e40af", alignItems: "center", justifyContent: "center", marginRight: 14 },
  doctorAvatarText: { fontSize: 22, fontWeight: "700", color: "#fff" },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  doctorSpec: { fontSize: 13, color: "#64748b", marginTop: 2 },
  doctorMeta: { flexDirection: "row", marginTop: 6, gap: 12 },
  doctorRating: { fontSize: 13, color: "#f59e0b", fontWeight: "600" },
  doctorFee: { fontSize: 13, color: "#10b981", fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#94a3b8", marginTop: 40, fontSize: 15 },
  noSlots: { alignItems: "center", paddingTop: 40 },
  noSlotsText: { fontSize: 15, color: "#64748b", marginBottom: 12 },
  changeDateText: { color: "#1e40af", fontWeight: "600", fontSize: 15 },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  slotChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1.5, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  slotChipSelected: { backgroundColor: "#1e40af", borderColor: "#1e40af" },
  slotText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  slotTextSelected: { color: "#fff" },
  summary: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 20 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  summaryLabel: { fontSize: 14, color: "#64748b" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#1e293b", maxWidth: "55%", textAlign: "right" },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 10 },
  visitTypeRow: { flexDirection: "row", gap: 12 },
  visitTypeBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1.5, borderColor: "#e2e8f0", alignItems: "center" },
  visitTypeBtnActive: { backgroundColor: "#1e40af", borderColor: "#1e40af" },
  visitTypeBtnText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  visitTypeBtnTextActive: { color: "#fff" },
  footer: { flexDirection: "row", gap: 12, padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  backBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderColor: "#e2e8f0", alignItems: "center" },
  backBtnText: { fontSize: 15, fontWeight: "600", color: "#64748b" },
  nextBtn: { flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: "#1e40af", alignItems: "center" },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
