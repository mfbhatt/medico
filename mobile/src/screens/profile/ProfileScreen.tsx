import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useState } from 'react';
import { toast } from '@/utils/toast';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutThunk } from '@/store/slices/authSlice';
import { spacing, typography, theme, shadows } from '@/utils/theme';

interface MenuItem {
  label: string;
  icon: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuRow({ item }: { item: MenuItem }) {
  const iconColor = item.danger ? '#ef4444' : '#64748b';
  return (
    <TouchableOpacity
      style={[styles.menuRow, item.danger && styles.menuRowDanger]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconContainer, item.danger && styles.menuIconContainerDanger]}>
        <Ionicons name={item.icon as never} size={18} color={iconColor} />
      </View>
      <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>{item.label}</Text>
      {!item.danger && <Ionicons name="chevron-forward" size={17} color="#cbd5e1" />}
    </TouchableOpacity>
  );
}

function InfoModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={modalStyles.body}>{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={modalStyles.infoRow}>
      <Text style={modalStyles.infoLabel}>{label}</Text>
      <Text style={modalStyles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { user } = useAppSelector((s) => s.auth);
  const [activeModal, setActiveModal] = useState<'personal' | 'contacts' | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/patients/me').then((r) => r.data.data),
  });

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => dispatch(logoutThunk()),
      },
    ]);
  };

  const handleBiometric = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      toast.info('Biometric authentication is not available on this device.');
      return;
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      toast.warning('Please set up biometrics in your device settings first.');
      return;
    }
    toast.success('Biometric login is enabled.');
  };

  const menuItems: MenuItem[] = [
    { label: 'Personal Information', icon: 'person-outline', onPress: () => setActiveModal('personal') },
    { label: 'Insurance Policies', icon: 'shield-checkmark-outline', onPress: () => toast.info('Insurance management coming soon') },
    { label: 'Emergency Contacts', icon: 'alert-circle-outline', onPress: () => setActiveModal('contacts') },
    { label: 'Notification Preferences', icon: 'notifications-outline', onPress: () => toast.info('Notification preferences coming soon') },
    { label: 'Biometric Login', icon: 'finger-print-outline', onPress: handleBiometric },
    { label: 'Privacy & Data', icon: 'lock-closed-outline', onPress: () => toast.info('Privacy settings coming soon') },
    { label: 'Help & Support', icon: 'help-circle-outline', onPress: () => toast.info('Help & support coming soon') },
    { label: 'Sign Out', icon: 'log-out-outline', onPress: handleLogout, danger: true },
  ];

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Avatar */}
      <View style={[styles.avatarSection, { paddingTop: insets.top + 24 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.full_name ?? profile?.first_name}</Text>
        <Text style={styles.email}>{user?.email ?? profile?.email}</Text>
        {profile?.mrn && (
          <View style={styles.mrnBadge}>
            <Text style={styles.mrnText}>MRN: {profile.mrn}</Text>
          </View>
        )}
      </View>

      {/* Health Summary */}
      {profile && (
        <View style={styles.healthCard}>
          <Text style={styles.sectionTitle}>Health Summary</Text>
          <View style={styles.healthGrid}>
            {[
              { label: 'Blood Type', value: profile.blood_type ?? '—' },
              { label: 'Age', value: profile.age ? `${profile.age}y` : '—' },
              { label: 'Allergies', value: `${profile.allergies?.length ?? 0}` },
              { label: 'Conditions', value: `${profile.chronic_conditions?.length ?? 0}` },
            ].map((item) => (
              <View key={item.label} style={styles.healthItem}>
                <Text style={styles.healthValue}>{item.value}</Text>
                <Text style={styles.healthLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Menu */}
      <View style={styles.menu}>
        {menuItems.map((item) => (
          <MenuRow key={item.label} item={item} />
        ))}
      </View>

      {/* Personal Information Modal */}
      {activeModal === 'personal' && (
        <InfoModal title="Personal Information" onClose={() => setActiveModal(null)}>
          <InfoRow label="First Name" value={profile?.first_name} />
          <InfoRow label="Last Name" value={profile?.last_name} />
          <InfoRow label="Email" value={profile?.email ?? user?.email} />
          <InfoRow label="Phone" value={profile?.phone} />
          <InfoRow label="Date of Birth" value={profile?.date_of_birth} />
          <InfoRow label="Gender" value={profile?.gender} />
          <InfoRow label="Blood Group" value={profile?.blood_group} />
          <InfoRow label="City" value={profile?.city} />
          <InfoRow label="State" value={profile?.state} />
          <InfoRow label="Country" value={profile?.country} />
          <InfoRow label="MRN" value={profile?.mrn} />
          {!profile && (
            <Text style={modalStyles.emptyText}>Profile information not available.</Text>
          )}
        </InfoModal>
      )}

      {/* Emergency Contacts Modal */}
      {activeModal === 'contacts' && (
        <InfoModal title="Emergency Contacts" onClose={() => setActiveModal(null)}>
          {profile?.emergency_contacts?.length > 0 ? (
            profile.emergency_contacts.map((ec: any, i: number) => (
              <View key={ec.id ?? i} style={modalStyles.contactCard}>
                <Text style={modalStyles.contactName}>{ec.name}</Text>
                <Text style={modalStyles.contactMeta}>{ec.relationship} · {ec.phone}</Text>
                {ec.is_primary && <Text style={modalStyles.primaryBadge}>Primary</Text>}
              </View>
            ))
          ) : (
            <Text style={modalStyles.emptyText}>No emergency contacts on file.</Text>
          )}
        </InfoModal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingTop: 24, paddingBottom: spacing.xl, backgroundColor: '#fff' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: theme.colors.primary },
  name: { ...typography.heading3, marginBottom: 4 },
  email: { ...typography.caption },
  mrnBadge: {
    marginTop: spacing.sm,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  mrnText: { fontSize: 12, fontFamily: 'monospace', color: '#475569' },
  healthCard: {
    margin: spacing.md,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.md,
    ...shadows.md,
  },
  sectionTitle: { ...typography.label, marginBottom: spacing.sm, color: '#64748b' },
  healthGrid: { flexDirection: 'row', gap: spacing.sm },
  healthItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: spacing.sm,
  },
  healthValue: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  healthLabel: { ...typography.caption, marginTop: 2, textAlign: 'center' },
  menu: {
    marginHorizontal: spacing.md,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.md,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuRowDanger: { borderBottomWidth: 0 },
  menuIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  menuIconContainerDanger: { backgroundColor: '#fee2e2' },
  menuLabel: { flex: 1, ...typography.body, color: '#1e293b' },
  menuLabelDanger: { color: '#ef4444' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: { ...typography.heading3 },
  body: { padding: spacing.md, gap: spacing.sm },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: { ...typography.label, color: '#64748b', flex: 1 },
  infoValue: { ...typography.body, color: '#0f172a', flex: 2, textAlign: 'right' },
  contactCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  contactName: { ...typography.body, fontWeight: '600', color: '#0f172a' },
  contactMeta: { ...typography.caption, marginTop: 2, color: '#64748b' },
  primaryBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  emptyText: { ...typography.body, color: '#94a3b8', textAlign: 'center', marginTop: 40 },
});
