import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { toast } from '@/utils/toast';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
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

export default function ProfileScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { user } = useAppSelector((s) => s.auth);

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
    { label: 'Personal Information', icon: 'person-outline', onPress: () => {} },
    { label: 'Insurance Policies', icon: 'shield-checkmark-outline', onPress: () => {} },
    { label: 'Emergency Contacts', icon: 'alert-circle-outline', onPress: () => {} },
    { label: 'Notification Preferences', icon: 'notifications-outline', onPress: () => {} },
    { label: 'Biometric Login', icon: 'finger-print-outline', onPress: handleBiometric },
    { label: 'Privacy & Data', icon: 'lock-closed-outline', onPress: () => {} },
    { label: 'Help & Support', icon: 'help-circle-outline', onPress: () => {} },
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
