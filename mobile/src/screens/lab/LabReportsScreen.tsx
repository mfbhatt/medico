import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/services/api';
import { spacing, typography, theme, shadows } from '@/utils/theme';

interface LabResult {
  test_name: string;
  result: string;
  unit: string;
  normal_range: string;
  is_critical: boolean;
  is_abnormal: boolean;
}

interface LabReport {
  id: string;
  order_date: string;
  reported_at?: string;
  lab_name: string;
  doctor_name: string;
  status: string;
  results: LabResult[];
}

function ResultRow({ result }: { result: LabResult }) {
  return (
    <View style={[styles.resultRow, result.is_critical && styles.resultCritical]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.testName}>{result.test_name}</Text>
        <Text style={styles.normalRange}>Normal: {result.normal_range} {result.unit}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[
          styles.resultValue,
          result.is_critical ? styles.criticalText : result.is_abnormal ? styles.abnormalText : styles.normalText,
        ]}>
          {result.result} {result.unit}
        </Text>
        {result.is_critical && <Text style={styles.criticalLabel}>CRITICAL</Text>}
        {!result.is_critical && result.is_abnormal && <Text style={styles.abnormalLabel}>Abnormal</Text>}
      </View>
    </View>
  );
}

function LabReportCard({ report }: { report: LabReport }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = report.status === 'pending' || report.status === 'specimen_collected';

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.labName}>{report.lab_name}</Text>
            <Text style={styles.orderDate}>Ordered: {report.order_date.slice(0, 10)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isPending ? '#fef3c7' : '#dcfce7' }]}>
            <Text style={[styles.badgeText, { color: isPending ? '#92400e' : '#15803d' }]}>
              {report.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <Text style={styles.doctorRef}>Dr. {report.doctor_name}</Text>
      </TouchableOpacity>

      {expanded && report.results?.length > 0 && (
        <View style={styles.resultsList}>
          {report.results.map((r, idx) => (
            <ResultRow key={idx} result={r} />
          ))}
        </View>
      )}

      {report.results?.length > 0 && (
        <TouchableOpacity onPress={() => setExpanded((e) => !e)} style={styles.expandBtn}>
          <Text style={styles.expandText}>{expanded ? 'Hide results' : `View ${report.results.length} result(s)`}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function LabReportsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-lab-reports'],
    queryFn: () => api.get('/lab/my').then((r) => r.data.data),
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Lab Reports</Text>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item: LabReport) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="flask-outline" size={56} color="#cbd5e1" style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No lab reports yet</Text>
            </View>
          ) : null
        }
        renderItem={({ item }: { item: LabReport }) => <LabReportCard report={item} />}
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: spacing.xs,
  },
  labName: { ...typography.body, fontWeight: '600', color: '#0f172a' },
  orderDate: { ...typography.caption, marginTop: 2 },
  doctorRef: { ...typography.caption, color: '#475569', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  resultsList: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: spacing.md },
  resultCritical: { backgroundColor: '#fef2f2' },
  testName: { ...typography.label },
  normalRange: { ...typography.caption, marginTop: 2 },
  resultValue: { ...typography.body, fontWeight: '700' },
  normalText: { color: '#16a34a' },
  abnormalText: { color: '#d97706' },
  criticalText: { color: '#dc2626' },
  criticalLabel: { fontSize: 9, fontWeight: '700', color: '#dc2626', letterSpacing: 0.5 },
  abnormalLabel: { fontSize: 9, fontWeight: '600', color: '#d97706' },
  expandBtn: { padding: spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  expandText: { ...typography.caption, color: theme.colors.primary, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { marginBottom: spacing.md },
  emptyText: { ...typography.body, color: '#94a3b8' },
});
