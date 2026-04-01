import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toastRef, type ToastType } from '../utils/toast';

const useNativeDriver = Platform.OS !== 'web';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

const CONFIG: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> = {
  error:   { bg: '#fef2f2', border: '#ef4444', icon: 'alert-circle',       iconColor: '#ef4444' },
  success: { bg: '#f0fdf4', border: '#22c55e', icon: 'checkmark-circle',   iconColor: '#22c55e' },
  warning: { bg: '#fffbeb', border: '#f59e0b', icon: 'warning',             iconColor: '#f59e0b' },
  info:    { bg: '#eff6ff', border: '#3b82f6', icon: 'information-circle', iconColor: '#3b82f6' },
};

function ToastBanner({ item, onHide }: { item: ToastItem; onHide: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const { bg, border, icon, iconColor } = CONFIG[item.type];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 220, useNativeDriver }),
      Animated.timing(translateY,  { toValue: 0, duration: 220, useNativeDriver }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 200, useNativeDriver }),
        Animated.timing(translateY, { toValue: -16, duration: 200, useNativeDriver }),
      ]).start(onHide);
    }, item.duration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: bg, borderLeftColor: border, opacity, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name={icon as never} size={20} color={iconColor} style={styles.icon} />
      <Text style={styles.message} numberOfLines={4}>{item.message}</Text>
    </Animated.View>
  );
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    toastRef.register({
      show: (message, type, duration) => {
        const id = ++counter.current;
        setToasts((prev) => [...prev, { id, message, type, duration }]);
      },
    });
    return () => toastRef.unregister();
  }, []);

  if (toasts.length === 0) return null;

  const hide = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <View style={styles.container}>
      {toasts.map((t) => (
        <ToastBanner key={t.id} item={t} onHide={() => hide(t.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 9999,
    pointerEvents: 'none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.10)',
  },
  icon:    { marginRight: 10, flexShrink: 0 },
  message: { flex: 1, fontSize: 14, color: '#1e293b', lineHeight: 20 },
});
