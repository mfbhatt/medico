import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import appointmentApi, { Appointment } from '@/services/appointmentApi';
import { spacing, typography, theme } from '@/utils/theme';
import type { AppStackParamList } from '@/navigation';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',
  checked_in: '#f59e0b',
  in_progress: '#f59e0b',
  completed: '#10b981',
  cancelled: '#94a3b8',
  no_show: '#ef4444',
};

function AppointmentCard({ appointment, onPress }: { appointment: Appointment; onPress: () => void }) {
  const statusColor = STATUS_COLORS[appointment.status] ?? '#94a3b8';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.doctorName}>{appointment.doctor_name}</Text>
          <Text style={styles.clinicName}>{appointment.clinic_name}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {appointment.status.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.dateTime}>
          {appointment.scheduled_date} · {appointment.scheduled_time}
        </Text>
        <Text style={styles.appointmentType}>{appointment.appointment_type}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AppointmentsScreen() {
  const navigation = useNavigation<NavProp>();
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-appointments', filter],
    queryFn: () =>
      appointmentApi.getMyAppointments({
        status: filter === 'upcoming' ? 'scheduled,checked_in' : 'completed,cancelled,no_show',
      }),
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Appointments</Text>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => navigation.navigate('BookAppointment')}
        >
          <Text style={styles.bookBtnText}>+ Book</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['upcoming', 'past'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {filter === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <AppointmentCard
            appointment={item}
            onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { ...typography.heading2 },
  bookBtn: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bookBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterBtnActive: { backgroundColor: theme.colors.primaryContainer },
  filterText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  filterTextActive: { color: theme.colors.primary },
  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  doctorName: { ...typography.body, fontWeight: '600', color: '#0f172a' },
  clinicName: { ...typography.caption, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateTime: { ...typography.caption, color: '#475569' },
  appointmentType: { ...typography.caption, textTransform: 'capitalize' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { ...typography.body, color: '#94a3b8' },
});
