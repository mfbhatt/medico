import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/services/api';
import { spacing, typography, shadows } from '@/utils/theme';

interface MedicalRecord {
  id: string;
  visit_date: string;
  doctor_name: string;
  clinic_name: string;
  chief_complaint: string;
  diagnosis_codes: string[];
  assessment: string;
  plan: string;
  is_signed: boolean;
}

function RecordCard({ record }: { record: MedicalRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.visitDate}>{record.visit_date.slice(0, 10)}</Text>
            <Text style={styles.doctorName}>{record.doctor_name}</Text>
            <Text style={styles.clinicName}>{record.clinic_name}</Text>
          </View>
          {record.is_signed && (
            <View style={styles.signedBadge}>
              <Text style={styles.signedText}>✓ Signed</Text>
            </View>
          )}
        </View>

        <Text style={styles.complaint} numberOfLines={expanded ? undefined : 2}>
          {record.chief_complaint}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.details}>
          {record.diagnosis_codes?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Diagnoses (ICD-10)</Text>
              <View style={styles.codeList}>
                {record.diagnosis_codes.map((code, idx) => (
                  <View key={idx} style={styles.codeChip}>
                    <Text style={styles.codeText}>{code}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {record.assessment && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Assessment</Text>
              <Text style={styles.sectionBody}>{record.assessment}</Text>
            </View>
          )}
          {record.plan && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Plan</Text>
              <Text style={styles.sectionBody}>{record.plan}</Text>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity onPress={() => setExpanded((e) => !e)} style={styles.expandBtn}>
        <Text style={styles.expandText}>{expanded ? 'Show less' : 'Show more'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function MedicalRecordsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-records'],
    queryFn: () => api.get('/medical-records/my').then((r) => r.data.data),
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Medical Records</Text>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item: MedicalRecord) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={56} color="#cbd5e1" style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No medical records yet</Text>
            </View>
          ) : null
        }
        renderItem={({ item }: { item: MedicalRecord }) => <RecordCard record={item} />}
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
    paddingBottom: spacing.sm,
  },
  visitDate: { ...typography.label, color: '#0ea5e9' },
  doctorName: { ...typography.body, fontWeight: '600', color: '#0f172a', marginTop: 2 },
  clinicName: { ...typography.caption, marginTop: 1 },
  signedBadge: { backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  signedText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  complaint: { ...typography.body, color: '#334155', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  details: { borderTopWidth: 1, borderTopColor: '#f1f5f9', padding: spacing.md, gap: spacing.sm },
  section: { gap: 4 },
  sectionTitle: { ...typography.label, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 },
  sectionBody: { ...typography.body, color: '#334155' },
  codeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  codeChip: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  codeText: { fontSize: 12, color: '#1d4ed8', fontWeight: '500', fontFamily: 'monospace' },
  expandBtn: { padding: spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  expandText: { ...typography.caption, color: '#0ea5e9', fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { marginBottom: spacing.md },
  emptyText: { ...typography.body, color: '#94a3b8' },
});
