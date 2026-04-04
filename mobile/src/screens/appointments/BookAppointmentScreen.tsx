/**
 * Book Appointment Screen
 * Step 1: Find a Doctor  — search nearby clinics, by clinic name, doctor name, or specialty
 * Step 2: Select Date
 * Step 3: Select Time Slot
 * Step 4: Confirm Booking
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import { format, addDays } from "date-fns";

import appointmentApi, {
  type ClinicOption,
  type DoctorOption,
} from "../../services/appointmentApi";
import { useAppSelector } from "../../store/hooks";
import { toast } from "../../utils/toast";
import { shadows } from "../../utils/theme";

type SearchTab = "nearby" | "clinic" | "doctor" | "specialty";
type Step = 1 | 2 | 3 | 4;

const SPECIALTIES = [
  "Cardiology", "Dermatology", "Orthopedics", "Neurology",
  "Pediatrics", "Gynecology", "Ophthalmology", "ENT",
  "Psychiatry", "Urology", "Endocrinology", "Gastroenterology",
  "General Medicine", "Oncology",
];

const STEP_LABELS = ["Find Doctor", "Choose Date", "Pick Slot", "Confirm"];

export default function BookAppointmentScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAppSelector((s) => s.auth);

  // ── Booking state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<"new" | "follow_up">("new");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"razorpay" | "pay_later">("pay_later");

  // ── Discovery state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SearchTab>("nearby");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);
  const [clinicDoctorsMap, setClinicDoctorsMap] = useState<Record<string, DoctorOption[]>>({});
  const [loadingClinicDoctors, setLoadingClinicDoctors] = useState<string | null>(null);

  const [searchResults, setSearchResults] = useState<DoctorOption[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // ── Slots state ────────────────────────────────────────────────────────────
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  // ── Payment state ──────────────────────────────────────────────────────────
  const [bookedAppointmentId, setBookedAppointmentId] = useState<string | null>(null);

  // ── Load nearby clinics on mount ───────────────────────────────────────────
  useEffect(() => {
    fetchClinics();
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 1) return;
    const timer = setTimeout(() => {
      if (activeTab === "clinic") {
        fetchClinics(searchQuery);
      } else if (activeTab === "doctor" && searchQuery.length >= 2) {
        doSearchDoctors({ search: searchQuery });
      } else if (activeTab === "specialty" && selectedSpecialty) {
        doSearchDoctors({ specialization: selectedSpecialty, search: searchQuery || undefined });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSpecialty]);

  const fetchClinics = async (search?: string) => {
    setLoadingClinics(true);
    try {
      const data = await appointmentApi.getClinics(search ? { search } : undefined);
      setClinics(data);
    } catch {
      toast.error("Failed to load clinics.");
    } finally {
      setLoadingClinics(false);
    }
  };

  const doSearchDoctors = async (params: { search?: string; specialization?: string }) => {
    setLoadingSearch(true);
    try {
      const data = await appointmentApi.searchDoctors(params);
      setSearchResults(data);
    } catch {
      toast.error("Failed to search doctors.");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    setSearchQuery("");
    setSelectedSpecialty(null);
    setExpandedClinicId(null);
    setSearchResults([]);
    if (tab === "nearby" || tab === "clinic") {
      fetchClinics();
    }
  };

  const toggleClinic = useCallback(async (clinicId: string) => {
    if (expandedClinicId === clinicId) {
      setExpandedClinicId(null);
      return;
    }
    setExpandedClinicId(clinicId);
    if (!clinicDoctorsMap[clinicId]) {
      setLoadingClinicDoctors(clinicId);
      try {
        const data = await appointmentApi.getClinicDoctors(clinicId);
        setClinicDoctorsMap((prev) => ({ ...prev, [clinicId]: data }));
      } catch {
        toast.error("Failed to load doctors for this clinic.");
      } finally {
        setLoadingClinicDoctors(null);
      }
    }
  }, [expandedClinicId, clinicDoctorsMap]);

  const handleSelectDoctor = (doctor: DoctorOption) => {
    setSelectedDoctor(doctor);
    setSelectedDate("");
    setSelectedSlot(null);
    setSlots([]);
    setStep(2);
  };

  // ── Date selection ─────────────────────────────────────────────────────────
  const handleDateSelect = async (day: { dateString: string }) => {
    setSelectedDate(day.dateString);
    setSelectedSlot(null);
    setSlots([]);
    if (!selectedDoctor) return;

    setLoadingSlots(true);
    try {
      const data = await appointmentApi.getSlots(
        selectedDoctor.id,
        selectedDoctor.clinic_id,
        day.dateString
      );
      const available = data.filter((s) => s.available).map((s) => s.time);
      setSlots(available);
      if (available.length > 0) {
        setStep(3);
      }
    } catch {
      toast.error("Could not load available slots.");
    } finally {
      setLoadingSlots(false);
    }
  };

  // ── Booking ────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot) return;
    setBooking(true);
    try {
      const appt = await appointmentApi.book({
        doctor_id: selectedDoctor.id,
        clinic_id: selectedDoctor.clinic_id,
        appointment_date: selectedDate,
        start_time: selectedSlot,
        appointment_type: visitType === "new" ? "new_visit" : "follow_up",
        chief_complaint: chiefComplaint || undefined,
      });
      toast.success("Appointment booked!");
      if (paymentChoice === "razorpay") {
        // Navigate to detail screen where Razorpay payment can be initiated
        navigation.navigate("AppointmentDetail", { appointmentId: appt.id });
      } else {
        navigation.navigate("AppointmentDetail", { appointmentId: appt.id });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  const canProceed = (): boolean => {
    if (step === 1) return !!selectedDoctor;
    if (step === 2) return !!selectedDate;
    if (step === 3) return !!selectedSlot;
    return true;
  };

  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

  const TABS: { key: SearchTab; label: string; icon: string }[] = [
    { key: "nearby", label: "Nearby", icon: "location" },
    { key: "clinic", label: "By Clinic", icon: "business" },
    { key: "doctor", label: "By Doctor", icon: "person" },
    { key: "specialty", label: "By Specialty", icon: "medical" },
  ];

  // ── Render: Clinic card with expandable doctor list ────────────────────────
  const renderClinicCard = (clinic: ClinicOption) => {
    const isExpanded = expandedClinicId === clinic.id;
    const doctors = clinicDoctorsMap[clinic.id] ?? [];
    const isLoadingDocs = loadingClinicDoctors === clinic.id;

    return (
      <View key={clinic.id} style={styles.clinicCard}>
        <TouchableOpacity
          style={styles.clinicHeader}
          onPress={() => toggleClinic(clinic.id)}
          activeOpacity={0.7}
        >
          <View style={styles.clinicIconWrap}>
            <Ionicons name="business" size={22} color="#1e40af" />
          </View>
          <View style={styles.clinicInfo}>
            <Text style={styles.clinicName}>{clinic.name}</Text>
            <Text style={styles.clinicAddress} numberOfLines={1}>
              {clinic.address}
            </Text>
            <View style={styles.clinicMeta}>
              {clinic.distance_km !== undefined && (
                <View style={styles.metaPill}>
                  <Ionicons name="location-outline" size={12} color="#64748b" />
                  <Text style={styles.metaPillText}>{clinic.distance_km.toFixed(1)} km</Text>
                </View>
              )}
              <View style={styles.metaPill}>
                <Ionicons name="people-outline" size={12} color="#64748b" />
                <Text style={styles.metaPillText}>{clinic.doctor_count} doctors</Text>
              </View>
            </View>
            {(clinic.specializations?.length ?? 0) > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 6 }}
              >
                {clinic.specializations.slice(0, 5).map((sp) => (
                  <View key={sp} style={styles.specTag}>
                    <Text style={styles.specTagText}>{sp}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#94a3b8"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.clinicDoctorList}>
            {isLoadingDocs ? (
              <ActivityIndicator color="#1e40af" style={{ paddingVertical: 20 }} />
            ) : doctors.length === 0 ? (
              <Text style={styles.emptyText}>No doctors available at this clinic</Text>
            ) : (
              doctors.map((doc) => (
                <DoctorCard
                  key={doc.id}
                  doctor={doc}
                  selected={selectedDoctor?.id === doc.id}
                  onSelect={handleSelectDoctor}
                  showClinic={false}
                />
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <View key={s} style={[styles.stepItem, s < 4 && { flex: 1 }]}>
            <View style={[styles.stepCircle, step >= s ? styles.stepActive : styles.stepInactive]}>
              {step > s ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Text style={[styles.stepNum, step >= s ? styles.stepNumActive : styles.stepNumInactive]}>
                  {s}
                </Text>
              )}
            </View>
            {s < 4 && (
              <View style={[styles.stepLine, step > s ? styles.stepLineActive : styles.stepLineInactive]} />
            )}
          </View>
        ))}
      </View>
      <Text style={styles.stepLabel}>{STEP_LABELS[step - 1]}</Text>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Step 1: Find a Doctor ───────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            {/* Search bar */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  activeTab === "nearby"   ? "Search clinics or doctors..."
                  : activeTab === "clinic"  ? "Search by clinic name..."
                  : activeTab === "doctor"  ? "Search by doctor name..."
                  : "Search within specialty..."
                }
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94a3b8"
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>

            {/* Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsRow}
              contentContainerStyle={styles.tabsContent}
              nestedScrollEnabled
            >
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                  onPress={() => handleTabChange(tab.key)}
                >
                  <Ionicons
                    name={tab.icon as never}
                    size={14}
                    color={activeTab === tab.key ? "#fff" : "#64748b"}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Nearby / By Clinic: clinic accordion list ── */}
            {(activeTab === "nearby" || activeTab === "clinic") && (
              <View>
                {activeTab === "nearby" && (
                  <View style={styles.nearbyHeader}>
                    <Ionicons name="location" size={16} color="#1e40af" />
                    <Text style={styles.nearbyHeaderText}>Clinics near you</Text>
                  </View>
                )}
                {loadingClinics ? (
                  <ActivityIndicator color="#1e40af" style={{ marginTop: 40 }} />
                ) : clinics.length === 0 ? (
                  <Text style={styles.emptyText}>No clinics found</Text>
                ) : (
                  clinics.map(renderClinicCard)
                )}
              </View>
            )}

            {/* ── By Doctor ── */}
            {activeTab === "doctor" && (
              <View>
                {searchQuery.length < 2 ? (
                  <View style={styles.hintBox}>
                    <Ionicons name="search" size={32} color="#cbd5e1" />
                    <Text style={styles.hintText}>Type at least 2 characters to search doctors</Text>
                  </View>
                ) : loadingSearch ? (
                  <ActivityIndicator color="#1e40af" style={{ marginTop: 40 }} />
                ) : searchResults.length === 0 ? (
                  <Text style={styles.emptyText}>No doctors found for "{searchQuery}"</Text>
                ) : (
                  searchResults.map((doc) => (
                    <DoctorCard
                      key={doc.id}
                      doctor={doc}
                      selected={selectedDoctor?.id === doc.id}
                      onSelect={handleSelectDoctor}
                      showClinic
                    />
                  ))
                )}
              </View>
            )}

            {/* ── By Specialty ── */}
            {activeTab === "specialty" && (
              <View>
                <Text style={styles.sectionLabel}>Select a specialty</Text>
                <View style={styles.specialtyGrid}>
                  {SPECIALTIES.map((sp) => (
                    <TouchableOpacity
                      key={sp}
                      style={[
                        styles.specialtyChip,
                        selectedSpecialty === sp && styles.specialtyChipActive,
                      ]}
                      onPress={() =>
                        setSelectedSpecialty((prev) => (prev === sp ? null : sp))
                      }
                    >
                      <Text
                        style={[
                          styles.specialtyChipText,
                          selectedSpecialty === sp && styles.specialtyChipTextActive,
                        ]}
                      >
                        {sp}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {selectedSpecialty && (
                  <View style={{ marginTop: 20 }}>
                    <Text style={styles.sectionLabel}>
                      Doctors in {selectedSpecialty}
                    </Text>
                    {loadingSearch ? (
                      <ActivityIndicator color="#1e40af" style={{ marginTop: 20 }} />
                    ) : searchResults.length === 0 ? (
                      <Text style={styles.emptyText}>
                        No doctors found for {selectedSpecialty}
                      </Text>
                    ) : (
                      searchResults.map((doc) => (
                        <DoctorCard
                          key={doc.id}
                          doctor={doc}
                          selected={selectedDoctor?.id === doc.id}
                          onSelect={handleSelectDoctor}
                          showClinic
                        />
                      ))
                    )}
                  </View>
                )}

                {!selectedSpecialty && (
                  <View style={styles.hintBox}>
                    <Ionicons name="medical" size={32} color="#cbd5e1" />
                    <Text style={styles.hintText}>Tap a specialty to see available doctors</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Step 2: Select Date ─────────────────────────────────────────────── */}
        {step === 2 && (
          <View>
            {/* Selected doctor banner */}
            <View style={styles.docBanner}>
              <View style={styles.docBannerAvatar}>
                <Text style={styles.docBannerAvatarText}>
                  {selectedDoctor?.name.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.docBannerName} numberOfLines={1}>Dr. {selectedDoctor?.name}</Text>
                <Text style={styles.docBannerSpec} numberOfLines={1}>
                  {[selectedDoctor?.specialization, selectedDoctor?.clinic_name].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>

            <Calendar
              onDayPress={handleDateSelect}
              minDate={minDate}
              maxDate={maxDate}
              markedDates={
                selectedDate
                  ? { [selectedDate]: { selected: true, selectedColor: "#1e40af" } }
                  : {}
              }
              style={{ width: '100%' }}
              theme={{
                todayTextColor: "#1e40af",
                selectedDayBackgroundColor: "#1e40af",
                arrowColor: "#1e40af",
              }}
            />
            {!!selectedDate && loadingSlots && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#1e40af" size="small" />
                <Text style={styles.loadingText}>Checking availability...</Text>
              </View>
            )}
            {!!selectedDate && !loadingSlots && slots.length === 0 && (
              <View style={styles.noSlotsInline}>
                <Ionicons name="calendar-outline" size={20} color="#b45309" />
                <Text style={styles.noSlotsInlineText}>
                  No available slots for this date. Please select another date.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Step 3: Select Slot ─────────────────────────────────────────────── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>
              {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d, yyyy")}
            </Text>
            {loadingSlots ? (
              <ActivityIndicator color="#1e40af" style={{ marginTop: 40 }} />
            ) : slots.length === 0 ? (
              <View style={styles.noSlots}>
                <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
                <Text style={styles.noSlotsText}>No slots available on this date</Text>
                <TouchableOpacity onPress={() => setStep(2)}>
                  <Text style={styles.changeDateText}>Choose another date</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[styles.slotChip, selectedSlot === time && styles.slotChipSelected]}
                    onPress={() => setSelectedSlot(time)}
                  >
                    <Text
                      style={[styles.slotText, selectedSlot === time && styles.slotTextSelected]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Step 4: Confirm ─────────────────────────────────────────────────── */}
        {step === 4 && (
          <View>
            <View style={styles.summary}>
              <SummaryRow label="Doctor" value={`Dr. ${selectedDoctor?.name}`} />
              <SummaryRow label="Specialty" value={selectedDoctor?.specialization ?? ""} />
              <SummaryRow label="Clinic" value={selectedDoctor?.clinic_name ?? ""} />
              <SummaryRow
                label="Date"
                value={format(new Date(selectedDate + "T00:00:00"), "EEE, MMM d, yyyy")}
              />
              <SummaryRow label="Time" value={selectedSlot ?? ""} />
              <SummaryRow
                label="Consultation Fee"
                value={`${selectedDoctor?.consultation_fee ?? 0}`}
                highlight
              />
            </View>

            <Text style={styles.sectionLabel}>Visit Type</Text>
            <View style={styles.visitTypeRow}>
              {(["new", "follow_up"] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.visitTypeBtn, visitType === type && styles.visitTypeBtnActive]}
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

            <View style={styles.complaintLabelRow}>
              <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>Chief Complaint</Text>
              <Text style={styles.optionalLabel}>(optional)</Text>
            </View>
            <TextInput
              style={styles.complaintInput}
              placeholder="Describe your main concern..."
              placeholderTextColor="#94a3b8"
              value={chiefComplaint}
              onChangeText={setChiefComplaint}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* ── Payment selection ─────────────────────────────────────────── */}
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <TouchableOpacity
              style={[styles.payOptionCard, paymentChoice === "razorpay" && styles.payOptionCardActive]}
              onPress={() => setPaymentChoice("razorpay")}
              activeOpacity={0.8}
            >
              <View style={styles.payOptionLeft}>
                <Ionicons name="card" size={22} color={paymentChoice === "razorpay" ? "#2563eb" : "#64748b"} />
                <View>
                  <Text style={[styles.payOptionTitle, paymentChoice === "razorpay" && { color: "#2563eb" }]}>Pay Online</Text>
                  <Text style={styles.payOptionSub}>Razorpay · UPI · Cards · Net Banking</Text>
                </View>
              </View>
              <View style={[styles.payOptionRadio, paymentChoice === "razorpay" && styles.payOptionRadioActive]}>
                {paymentChoice === "razorpay" && <View style={styles.payOptionRadioDot} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payOptionCard, paymentChoice === "pay_later" && styles.payOptionCardActive]}
              onPress={() => setPaymentChoice("pay_later")}
              activeOpacity={0.8}
            >
              <View style={styles.payOptionLeft}>
                <Ionicons name="cash" size={22} color={paymentChoice === "pay_later" ? "#2563eb" : "#64748b"} />
                <View>
                  <Text style={[styles.payOptionTitle, paymentChoice === "pay_later" && { color: "#2563eb" }]}>Pay at Clinic</Text>
                  <Text style={styles.payOptionSub}>Cash · Pay when you arrive</Text>
                </View>
              </View>
              <View style={[styles.payOptionRadio, paymentChoice === "pay_later" && styles.payOptionRadioActive]}>
                {paymentChoice === "pay_later" && <View style={styles.payOptionRadioDot} />}
              </View>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Footer navigation */}
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep((s) => (s - 1) as Step)}
          >
            <Ionicons name="arrow-back" size={18} color="#64748b" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}

        {step < 4 ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={() => setStep((s) => (s + 1) as Step)}
            disabled={!canProceed()}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, booking && styles.nextBtnDisabled]}
            onPress={handleConfirm}
            disabled={booking}
          >
            {booking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.nextBtnText}>Confirm Booking</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DoctorCard({
  doctor,
  selected,
  onSelect,
  showClinic,
}: {
  doctor: DoctorOption;
  selected: boolean;
  onSelect: (d: DoctorOption) => void;
  showClinic: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.doctorCard, selected && styles.doctorCardSelected]}
      onPress={() => onSelect(doctor)}
      activeOpacity={0.75}
    >
      <View style={[styles.doctorAvatar, selected && styles.doctorAvatarSelected]}>
        <Text style={styles.doctorAvatarText}>{doctor.name.charAt(0)}</Text>
      </View>
      <View style={styles.doctorInfo}>
        <Text style={styles.doctorName}>Dr. {doctor.name}</Text>
        <Text style={styles.doctorSpec}>{doctor.specialization}</Text>
        {showClinic && doctor.clinic_name ? (
          <View style={styles.doctorClinicRow}>
            <Ionicons name="business-outline" size={12} color="#64748b" />
            <Text style={styles.doctorClinic}>{doctor.clinic_name}</Text>
          </View>
        ) : null}
        <View style={styles.doctorMeta}>
          <Text style={styles.doctorRating}>{`★ ${(doctor.average_rating ?? 0).toFixed(1)}`}</Text>
          <Text style={styles.doctorFee}>{doctor.consultation_fee}</Text>
        </View>
      </View>
      <Ionicons
        name={selected ? "checkmark-circle" : "chevron-forward"}
        size={22}
        color={selected ? "#1e40af" : "#94a3b8"}
      />
    </TouchableOpacity>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  // Step indicator
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  stepItem: { flexDirection: "row", alignItems: "center" },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  stepActive: { backgroundColor: "#1e40af" },
  stepInactive: { backgroundColor: "#e2e8f0" },
  stepNum: { fontSize: 13, fontWeight: "700" },
  stepNumActive: { color: "#fff" },
  stepNumInactive: { color: "#94a3b8" },
  stepLine: { flex: 1, height: 2 },
  stepLineActive: { backgroundColor: "#1e40af" },
  stepLineInactive: { backgroundColor: "#e2e8f0" },
  stepLabel: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  content: { flex: 1, padding: 16 },
  stepTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 14,
  },

  // Search bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 15, color: "#1e293b" },

  // Tabs
  tabsRow: { marginBottom: 16 },
  tabsContent: { gap: 8, paddingRight: 4 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabActive: { backgroundColor: "#1e40af", borderColor: "#1e40af" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  tabTextActive: { color: "#fff" },

  // Nearby header
  nearbyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  nearbyHeaderText: { fontSize: 14, fontWeight: "600", color: "#1e40af" },

  // Clinic card
  clinicCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    ...shadows.sm,
  },
  clinicHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
  },
  clinicIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  clinicInfo: { flex: 1 },
  clinicName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  clinicAddress: { fontSize: 13, color: "#64748b", marginTop: 2 },
  clinicMeta: { flexDirection: "row", gap: 10, marginTop: 6 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  metaPillText: { fontSize: 12, color: "#64748b", fontWeight: "500" },
  specTag: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  specTagText: { fontSize: 11, color: "#1e40af", fontWeight: "600" },
  clinicDoctorList: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fafafa",
  },

  // Doctor card
  doctorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    gap: 12,
    ...shadows.sm,
  },
  doctorCardSelected: { borderColor: "#1e40af", backgroundColor: "#eff6ff" },
  doctorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#1e40af",
    alignItems: "center",
    justifyContent: "center",
  },
  doctorAvatarSelected: { backgroundColor: "#1d4ed8" },
  doctorAvatarText: { fontSize: 20, fontWeight: "700", color: "#fff" },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  doctorSpec: { fontSize: 13, color: "#64748b", marginTop: 2 },
  doctorClinicRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  doctorClinic: { fontSize: 12, color: "#64748b" },
  doctorMeta: { flexDirection: "row", gap: 12, marginTop: 6 },
  doctorRating: { fontSize: 13, color: "#f59e0b", fontWeight: "600" },
  doctorFee: { fontSize: 13, color: "#10b981", fontWeight: "600" },

  // Hints / empty
  hintBox: { alignItems: "center", paddingVertical: 48, gap: 12 },
  hintText: { fontSize: 14, color: "#94a3b8", textAlign: "center" },
  emptyText: { textAlign: "center", color: "#94a3b8", marginTop: 40, fontSize: 15 },

  // Specialty chips
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 10 },
  specialtyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  specialtyChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  specialtyChipActive: { backgroundColor: "#1e40af", borderColor: "#1e40af" },
  specialtyChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  specialtyChipTextActive: { color: "#fff" },

  // Doctor banner (step 2)
  docBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  docBannerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1e40af",
    alignItems: "center",
    justifyContent: "center",
  },
  docBannerAvatarText: { fontSize: 18, fontWeight: "700", color: "#fff" },
  docBannerName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  docBannerSpec: { fontSize: 13, color: "#64748b", marginTop: 2 },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  loadingText: { fontSize: 13, color: "#64748b" },
  noSlotsInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  noSlotsInlineText: { fontSize: 13, color: "#92400e", flex: 1 },

  // Slots
  noSlots: { alignItems: "center", paddingTop: 40, gap: 12 },
  noSlotsText: { fontSize: 15, color: "#64748b" },
  changeDateText: { color: "#1e40af", fontWeight: "700", fontSize: 14 },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  slotChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  slotChipSelected: { backgroundColor: "#1e40af", borderColor: "#1e40af" },
  slotText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  slotTextSelected: { color: "#fff" },

  // Summary (step 4)
  summary: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  summaryLabel: { fontSize: 14, color: "#64748b" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#1e293b", maxWidth: "55%", textAlign: "right" },
  summaryValueHighlight: { color: "#10b981", fontSize: 15 },

  visitTypeRow: { flexDirection: "row", gap: 12 },
  visitTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  visitTypeBtnActive: { backgroundColor: "#1e40af", borderColor: "#1e40af" },
  visitTypeBtnText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  visitTypeBtnTextActive: { color: "#fff" },

  complaintLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, marginBottom: 10 },
  optionalLabel: { fontSize: 13, color: "#94a3b8", fontWeight: "400" },
  complaintInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#1e293b",
    minHeight: 90,
  },

  // Footer
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  backBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  backBtnText: { fontSize: 15, fontWeight: "600", color: "#64748b" },
  nextBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#1e40af",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Payment selection (Step 4)
  payOptionCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 14,
    padding: 16, marginBottom: 10, backgroundColor: "#fff",
  },
  payOptionCardActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  payOptionLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  payOptionTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  payOptionSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  payOptionRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#cbd5e1",
    alignItems: "center", justifyContent: "center",
  },
  payOptionRadioActive: { borderColor: "#2563eb" },
  payOptionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2563eb" },
});
