import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { Slot } from 'expo-router';
import { View } from 'react-native';
import { store } from '@/store';
import { clearAuth } from '@/store/slices/authSlice';
import { setSessionExpiredCallback } from '@/services/api';
import ToastProvider from '@/components/Toast';

// Wire up the session-expired callback here, where the store is available,
// to avoid a circular dependency (api → store → authSlice → authApi → api).
setSessionExpiredCallback(() => store.dispatch(clearAuth()));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 2 * 60 * 1000 },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1 }}>
          <Slot />
          <ToastProvider />
        </View>
      </QueryClientProvider>
    </Provider>
  );
}
