import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { useAppDispatch } from '@/store/hooks';
import { addToast } from '@/store/slices/uiSlice';

const TYPE_ICONS: Record<string, string> = {
  appointment_reminder: '📅',
  appointment_cancelled: '❌',
  lab_result: '🔬',
  prescription: '💊',
  billing: '💳',
  critical_lab: '🚨',
  system: 'ℹ️',
};

export default function NotificationsPage() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/').then((r) => r.data.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      dispatch(addToast({ message: 'All notifications marked as read', variant: 'success' }));
    },
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n: { is_read: boolean }) => !n.is_read).length;

  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            className="btn-secondary"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-gray-500">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n: {
            id: string;
            notification_type: string;
            title: string;
            body: string;
            is_read: boolean;
            created_at: string;
          }) => (
            <div
              key={n.id}
              className={`card p-4 cursor-pointer transition-all hover:shadow-sm ${
                !n.is_read ? 'border-primary-200 bg-primary-50/30' : ''
              }`}
              onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">
                  {TYPE_ICONS[n.notification_type] ?? '🔔'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${!n.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                      {n.title}
                    </p>
                    {!n.is_read && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
