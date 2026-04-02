import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import appointmentApi from '@/services/appointmentApi';
import { spacing, typography, theme, shadows } from '@/utils/theme';
import { toast } from '@/utils/toast';
import type { AppStackParamList } from '@/navigation';

type Route = RouteProp<AppStackParamList, 'AppointmentDetail'>;

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',
  checked_in: '#f59e0b',
  in_progress: '#f59e0b',
  completed: '#10b981',
  cancelled: '#94a3b8',
  no_show: '#ef4444',
};

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function AppointmentDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const qc = useQueryClient();
  const { appointmentId } = route.params;

  const { data: appt, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => appointmentApi.getDetail(appointmentId),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => appointmentApi.cancel(appointmentId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      toast.success('Appointment cancelled');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Cancellation failed');
    },
  });

  const handleCancel = () => {
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Appointment',
        style: 'destructive',
        onPress: () => cancelMutation.mutate('Patient requested cancellation'),
      },
    ]);
  };

  if (isLoading || !appt) {
    return (
      <View style={styles.center}>
        <Text style={typography.body}>Loading…</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[appt.status] ?? '#94a3b8';
  const canCancel = appt.status === 'scheduled' || appt.status === 'checked_in';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Status banner */}
      <View style={[styles.statusBanner, { backgroundColor: `${statusColor}15` }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {appt.status.replace(/_/g, ' ')}
        </Text>
      </View>

      {/* Details card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Appointment Details</Text>
        <Row label="Doctor" value={appt.doctor_name} />
        <Row label="Clinic" value={appt.clinic_name} />
        <Row label="Date" value={appt.scheduled_date} />
        <Row label="Time" value={appt.scheduled_time} />
        <Row label="Type" value={appt.appointment_type?.replace(/_/g, ' ')} />
        {appt.chief_complaint && <Row label="Reason" value={appt.chief_complaint} />}
      </View>

      {/* Telemedicine link */}
      {appt.telemedicine_url && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Telemedicine</Text>
          <TouchableOpacity style={styles.joinBtn}>
            <Ionicons name="videocam" size={18} color="#fff" />
            <Text style={styles.joinBtnText}>Join Video Call</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancel button */}
      {canCancel && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
          disabled={cancelMutation.isPending}
        >
          <Text style={styles.cancelBtnText}>
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Appointment'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: spacing.md, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.md,
  },
  sectionTitle: { ...typography.heading3, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { ...typography.label, flex: 1 },
  rowValue: { ...typography.body, flex: 2, textAlign: 'right', color: '#1e293b' },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  joinBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
