import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import appointmentApi from '../../services/appointmentApi';
import { useAppSelector } from '../../store/hooks';
import { spacing, typography, theme, shadows } from '../../utils/theme';

// ─── Quick Action config ──────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Book Appointment', icon: 'calendar' as const, screen: 'BookAppointment', bg: '#eff6ff', iconColor: '#2563eb' },
  { label: 'Prescriptions',    icon: 'medkit' as const,   screen: 'Prescriptions',   bg: '#f0fdf4', iconColor: '#16a34a' },
  { label: 'Lab Reports',      icon: 'flask' as const,    screen: 'LabReports',      bg: '#faf5ff', iconColor: '#7c3aed' },
  { label: 'Medical Records',  icon: 'document-text' as const, screen: 'MedicalRecords', bg: '#fff7ed', iconColor: '#ea580c' },
];

// ─── Status helpers ───────────────────────────────────────────────
function statusStyle(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'scheduled':   return { bg: '#dbeafe', text: '#1d4ed8', label: 'Scheduled' };
    case 'confirmed':   return { bg: '#dcfce7', text: '#15803d', label: 'Confirmed' };
    case 'checked_in':  return { bg: '#fef9c3', text: '#a16207', label: 'Checked In' };
    case 'completed':   return { bg: '#e0e7ff', text: '#4338ca', label: 'Completed' };
    case 'cancelled':   return { bg: '#fee2e2', text: '#b91c1c', label: 'Cancelled' };
    case 'no_show':     return { bg: '#f3f4f6', text: '#4b5563', label: 'No Show' };
    default:            return { bg: '#f1f5f9', text: '#475569', label: status };
  }
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDate(dateStr: string): { day: string; month: string; weekday: string } {
  const d = new Date(dateStr);
  return {
    day: d.getDate().toString(),
    month: d.toLocaleString('en', { month: 'short' }).toUpperCase(),
    weekday: d.toLocaleString('en', { weekday: 'short' }).toUpperCase(),
  };
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Sub-components ───────────────────────────────────────────────
function QuickActionTile({ item, onPress }: { item: typeof QUICK_ACTIONS[0]; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.tileIcon, { backgroundColor: item.bg }]}>
        <Ionicons name={item.icon} size={22} color={item.iconColor} />
      </View>
      <Text style={styles.tileLabel}>{item.label}</Text>
    </TouchableOpacity>
  );
}

function AppointmentCard({ appt, onPress }: { appt: any; onPress: () => void }) {
  const { day, month, weekday } = formatDate(appt.scheduled_date);
  const s = statusStyle(appt.status);
  return (
    <TouchableOpacity style={styles.apptCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.apptDateBlock}>
        <Text style={styles.apptWeekday}>{weekday}</Text>
        <Text style={styles.apptDay}>{day}</Text>
        <Text style={styles.apptMonth}>{month}</Text>
      </View>

      <View style={styles.apptDivider} />

      <View style={styles.apptInfo}>
        <Text style={styles.apptDoctor} numberOfLines={1}>
          {appt.doctor_name ? `Dr. ${appt.doctor_name}` : 'Doctor'}
        </Text>
        {appt.specialization && (
          <Text style={styles.apptSpecialty} numberOfLines={1}>{appt.specialization}</Text>
        )}
        <View style={styles.apptMeta}>
          <Ionicons name="time-outline" size={13} color="#94a3b8" />
          <Text style={styles.apptTime}>{formatTime(appt.scheduled_time)}</Text>
          {appt.clinic_name && (
            <>
              <Text style={styles.apptMetaDot}>·</Text>
              <Ionicons name="location-outline" size={13} color="#94a3b8" />
              <Text style={styles.apptTime} numberOfLines={1}>{appt.clinic_name}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.apptRight}>
        <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
          <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#cbd5e1" style={{ marginTop: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAppSelector((s) => s.auth);

  const firstName = user?.full_name?.split(' ')[0] || 'Patient';
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'P';

  const { data: appointmentsRes, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['upcomingAppointments'],
    queryFn: () => appointmentApi.getMyAppointments({ filter: 'upcoming', limit: 5 }),
    enabled: !!user,
  });

  const appointments: any[] = appointmentsRes ?? [];
  const nextAppt = appointments[0];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />}
    >
      {/* ── Hero Header ─────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>{getGreeting()}</Text>
            <Text style={styles.heroName} numberOfLines={1}>{firstName}</Text>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroBell}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroAvatar}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.heroAvatarText}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Next appointment banner inside hero */}
        {nextAppt && (
          <TouchableOpacity
            style={styles.heroBanner}
            onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: nextAppt.id })}
            activeOpacity={0.85}
          >
            <View style={styles.heroBannerLeft}>
              <Text style={styles.heroBannerLabel}>NEXT APPOINTMENT</Text>
              <Text style={styles.heroBannerDoctor} numberOfLines={1}>
                {nextAppt.doctor_name ? `Dr. ${nextAppt.doctor_name}` : 'Doctor'}
              </Text>
              <View style={styles.heroBannerMeta}>
                <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.75)" />
                <Text style={styles.heroBannerMetaText}>
                  {new Date(nextAppt.scheduled_date).toLocaleDateString('en', {
                    weekday: 'short', month: 'short', day: 'numeric',
                  })}
                </Text>
                {nextAppt.scheduled_time && (
                  <>
                    <Text style={styles.heroBannerMetaDot}>·</Text>
                    <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.75)" />
                    <Text style={styles.heroBannerMetaText}>{formatTime(nextAppt.scheduled_time)}</Text>
                  </>
                )}
              </View>
            </View>
            <View style={styles.heroBannerChevron}>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Quick Actions ────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.tilesRow}>
          {QUICK_ACTIONS.map((item) => (
            <QuickActionTile
              key={item.label}
              item={item}
              onPress={() => navigation.navigate(item.screen)}
            />
          ))}
        </View>
      </View>

      {/* ── Upcoming Appointments ────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24, marginBottom: 8 }} />
        ) : appointments.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No upcoming appointments</Text>
            <Text style={styles.emptyBody}>Schedule a visit with one of our doctors</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('BookAppointment')}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Book Appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          appointments.map((appt: any) => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: appt.id })}
            />
          ))
        )}
      </View>

      {/* ── Health Tip ───────────────────────────────────────────── */}
      <View style={[styles.section, { marginBottom: 32 }]}>
        <Text style={styles.sectionTitle}>Daily Health Tip</Text>
        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <Ionicons name="water" size={20} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>Stay Hydrated</Text>
            <Text style={styles.tipBody}>
              Drink at least 8 glasses of water daily to maintain optimal health and energy levels.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const HERO_BG = '#0369a1'; // sky-700 — professional deep blue

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },

  // Hero
  hero: { backgroundColor: HERO_BG, paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  heroGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', letterSpacing: 0.3 },
  heroName: { ...typography.heading2, color: '#fff', marginTop: 2 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroBell: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroAvatarText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Hero banner
  heroBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, padding: spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  heroBannerLeft: { flex: 1 },
  heroBannerLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 4 },
  heroBannerDoctor: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  heroBannerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroBannerMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  heroBannerMetaDot: { color: 'rgba(255,255,255,0.5)', marginHorizontal: 2 },
  heroBannerChevron: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Sections
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.md },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: spacing.sm, letterSpacing: 0.1 },
  seeAll: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },

  // Quick action tiles
  tilesRow: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    padding: spacing.sm + 4, alignItems: 'center',
    ...shadows.md,
  },
  tileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs + 2 },
  tileLabel: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center', lineHeight: 14 },

  // Appointment cards
  apptCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm,
    ...shadows.md,
  },
  apptDateBlock: { alignItems: 'center', width: 44 },
  apptWeekday: { fontSize: 9, fontWeight: '700', color: theme.colors.primary, letterSpacing: 0.5 },
  apptDay: { fontSize: 26, fontWeight: '800', color: '#0f172a', lineHeight: 30 },
  apptMonth: { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 0.5 },
  apptDivider: { width: 1, height: 44, backgroundColor: '#f1f5f9', marginHorizontal: spacing.sm },
  apptInfo: { flex: 1 },
  apptDoctor: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  apptSpecialty: { fontSize: 12, color: '#64748b', marginTop: 1 },
  apptMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  apptTime: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  apptMetaDot: { color: '#cbd5e1', marginHorizontal: 2 },
  apptRight: { alignItems: 'flex-end', marginLeft: spacing.sm },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Empty state
  empty: {
    alignItems: 'center', paddingVertical: spacing.xl,
    backgroundColor: '#fff', borderRadius: 14, ...shadows.md,
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  emptyBody: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: spacing.xl },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.lg, backgroundColor: theme.colors.primary,
    paddingVertical: 11, paddingHorizontal: spacing.lg,
    borderRadius: 10,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Health tip
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff',
    borderRadius: 14, padding: spacing.md, gap: spacing.sm,
    ...shadows.md,
  },
  tipIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  tipTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  tipBody: { fontSize: 13, color: '#64748b', lineHeight: 19 },
});
