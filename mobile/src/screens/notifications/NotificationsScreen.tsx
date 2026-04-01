import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '@/services/api';
import { spacing, typography, theme } from '@/utils/theme';

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, { name: string; color: string }> = {
  appointment_reminder: { name: 'calendar-outline', color: '#3b82f6' },
  appointment_cancelled: { name: 'close-circle-outline', color: '#ef4444' },
  lab_result: { name: 'flask-outline', color: '#7c3aed' },
  prescription: { name: 'medkit-outline', color: '#059669' },
  billing: { name: 'card-outline', color: '#0ea5e9' },
  critical_lab: { name: 'alert-circle', color: '#ef4444' },
  system: { name: 'information-circle-outline', color: '#64748b' },
};

function NotificationItem({ item, onPress }: { item: Notification; onPress: () => void }) {
  const iconDef = TYPE_ICONS[item.notification_type] ?? { name: 'notifications-outline', color: '#64748b' };
  return (
    <TouchableOpacity
      style={[styles.item, !item.is_read && styles.itemUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${iconDef.color}15` }]}>
        <Ionicons name={iconDef.name as never} size={20} color={iconDef.color} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, !item.is_read && styles.itemTitleUnread]}>
          {item.title}
        </Text>
        <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.itemTime}>
          {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/').then((r) => r.data.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications: Notification[] = data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.subtitle}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            style={styles.markAllBtn}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={56} color="#cbd5e1" style={styles.emptyIcon} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <NotificationItem
            item={item}
            onPress={() => !item.is_read && markReadMutation.mutate(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { ...typography.heading2 },
  subtitle: { ...typography.caption, color: theme.colors.primary, marginTop: 2 },
  markAllBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f1f5f9', borderRadius: 8 },
  markAllText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  item: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, backgroundColor: '#fff' },
  itemUnread: { backgroundColor: '#f0f9ff' },
  iconContainer: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, marginTop: 1 },
  itemContent: { flex: 1 },
  itemTitle: { ...typography.body, color: '#475569' },
  itemTitleUnread: { color: '#0f172a', fontWeight: '600' },
  itemBody: { ...typography.caption, color: '#64748b', marginTop: 3, lineHeight: 18 },
  itemTime: { ...typography.caption, color: '#94a3b8', marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 6 },
  separator: { height: 1, backgroundColor: '#f1f5f9' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { marginBottom: spacing.md },
  emptyText: { ...typography.body, color: '#94a3b8' },
});
