import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/services/api';
import { spacing, typography, theme, shadows } from '@/utils/theme';

interface PrescriptionItem {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions?: string;
}

interface Prescription {
  id: string;
  created_at: string;
  doctor_name: string;
  status: string;
  expires_at: string;
  items: PrescriptionItem[];
  allergy_warnings?: string[];
}

function PrescriptionCard({ rx }: { rx: Prescription }) {
  const isActive = rx.status === 'active';
  const isExpired = rx.status === 'expired';

  return (
    <View style={[styles.card, isExpired && styles.cardExpired]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.doctorName}>{rx.doctor_name}</Text>
          <Text style={styles.date}>{rx.created_at.slice(0, 10)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: isActive ? '#dcfce7' : isExpired ? '#fee2e2' : '#f1f5f9' }]}>
          <Text style={[styles.badgeText, { color: isActive ? '#16a34a' : isExpired ? '#dc2626' : '#64748b' }]}>
            {rx.status}
          </Text>
        </View>
      </View>

      {/* Allergy warnings */}
      {rx.allergy_warnings && rx.allergy_warnings.length > 0 && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={14} color="#92400e" style={{ marginRight: 4 }} />
          <Text style={styles.warningText}>{rx.allergy_warnings.join(', ')}</Text>
        </View>
      )}

      {/* Items */}
      <View style={styles.itemList}>
        {rx.items.map((item, idx) => (
          <View key={idx} style={[styles.item, idx < rx.items.length - 1 && styles.itemBorder]}>
            <Text style={styles.drugName}>{item.drug_name}</Text>
            <Text style={styles.drugDetails}>
              {item.dosage} · {item.frequency} · {item.duration_days} days
            </Text>
            {item.instructions && (
              <Text style={styles.instructions}>{item.instructions}</Text>
            )}
          </View>
        ))}
      </View>

      <Text style={styles.expiryNote}>
        {isExpired ? 'Expired' : `Expires`}: {rx.expires_at?.slice(0, 10)}
      </Text>
    </View>
  );
}

export default function PrescriptionsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-prescriptions'],
    queryFn: () => api.get('/prescriptions/my').then((r) => r.data.data),
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Prescriptions</Text>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item: Prescription) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="medkit-outline" size={56} color="#cbd5e1" style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No prescriptions yet</Text>
            </View>
          ) : null
        }
        renderItem={({ item }: { item: Prescription }) => <PrescriptionCard rx={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { ...typography.heading2 },
  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    ...shadows.md,
  },
  cardExpired: { opacity: 0.7 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  doctorName: { ...typography.body, fontWeight: '600', color: '#0f172a' },
  date: { ...typography.caption, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  warningText: { fontSize: 12, color: '#92400e' },
  itemList: { paddingHorizontal: spacing.md },
  item: { paddingVertical: spacing.sm },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  drugName: { ...typography.body, fontWeight: '600', color: '#0f172a' },
  drugDetails: { ...typography.caption, color: '#475569', marginTop: 2 },
  instructions: { ...typography.caption, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' },
  expiryNote: { ...typography.caption, color: '#94a3b8', padding: spacing.md, paddingTop: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { marginBottom: spacing.md },
  emptyText: { ...typography.body, color: '#94a3b8' },
});
