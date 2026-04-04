import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import appointmentApi, { type PaymentInitResponse } from '@/services/appointmentApi';
import { useAppSelector } from '@/store/hooks';
import { spacing, typography, theme, shadows } from '@/utils/theme';
import { toast } from '@/utils/toast';
import type { AppStackParamList } from '@/navigation';

// WebView is only available on native — require lazily to avoid crashing on Expo web
const WebView: React.ComponentType<any> = Platform.OS !== 'web'
  ? require('react-native-webview').WebView
  : () => null;

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

function getRazorpayHTML(order: PaymentInitResponse): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    body { margin: 0; background: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, sans-serif; }
    .loading { text-align: center; color: #64748b; font-size: 15px; }
  </style>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <div class="loading">Opening payment…</div>
  <script>
    window.onload = function() {
      var rzp = new Razorpay({
        key: "${order.key_id}",
        amount: "${order.amount}",
        currency: "${order.currency ?? 'INR'}",
        order_id: "${order.order_id}",
        description: "${(order.description ?? 'Consultation Fee').replace(/"/g, '\\"')}",
        handler: function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            success: true,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          }));
        },
        modal: {
          ondismiss: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ cancelled: true }));
          }
        }
      });
      rzp.on('payment.failed', function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          error: true,
          message: response.error.description || 'Payment failed',
        }));
      });
      rzp.open();
    };
  </script>
</body>
</html>`;
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

  const { user } = useAppSelector((s) => s.auth);
  const isPatient = user?.role === 'patient';
  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<PaymentInitResponse | null>(null);
  const [showRazorpay, setShowRazorpay] = useState(false);

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

  const handleCashPayment = async () => {
    setPaying(true);
    try {
      await appointmentApi.initiatePayment(appointmentId, 'cash');
      qc.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      setShowPayModal(false);
      toast.success('Cash payment recorded');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleRazorpayPayment = async () => {
    setPaying(true);
    try {
      const order = await appointmentApi.initiatePayment(appointmentId, 'razorpay');
      setShowPayModal(false);

      if (Platform.OS === 'web') {
        // Web: dynamically load Razorpay checkout.js and open widget
        let Rzp = (window as any).Razorpay;
        if (!Rzp) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
            s.onload = () => resolve();
            s.onerror = () => reject();
            document.body.appendChild(s);
          });
          Rzp = (window as any).Razorpay;
        }
        const rzp = new Rzp({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency ?? 'INR',
          order_id: order.order_id,
          description: order.description ?? 'Consultation Fee',
          handler: async (response: any) => {
            try {
              await appointmentApi.verifyPayment(appointmentId, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              qc.invalidateQueries({ queryKey: ['appointment', appointmentId] });
              qc.invalidateQueries({ queryKey: ['my-appointments'] });
              toast.success('Payment successful!');
            } catch (err: any) {
              toast.error(err?.response?.data?.message ?? 'Payment verification failed');
            }
          },
        });
        rzp.open();
      } else {
        // Native iOS/Android: use WebView
        setRazorpayOrder(order);
        setShowRazorpay(true);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to initiate payment');
    } finally {
      setPaying(false);
    }
  };

  const handleWebViewMessage = async (event: { nativeEvent: { data: string } }) => {
    let data: any;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (data.success) {
      setShowRazorpay(false);
      setPaying(true);
      try {
        await appointmentApi.verifyPayment(appointmentId, {
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        });
        qc.invalidateQueries({ queryKey: ['appointment', appointmentId] });
        qc.invalidateQueries({ queryKey: ['my-appointments'] });
        toast.success('Payment successful!');
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? 'Payment verification failed');
      } finally {
        setPaying(false);
      }
    } else if (data.cancelled) {
      setShowRazorpay(false);
    } else if (data.error) {
      setShowRazorpay(false);
      toast.error(data.message ?? 'Payment failed');
    }
  };

  const handleRefund = () => {
    Alert.alert('Issue Refund', 'Process a refund for this cancelled appointment?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Issue Refund',
        onPress: async () => {
          try {
            await appointmentApi.refundPayment(appointmentId);
            qc.invalidateQueries({ queryKey: ['appointment', appointmentId] });
            qc.invalidateQueries({ queryKey: ['my-appointments'] });
            toast.success('Refund processed');
          } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Refund failed');
          }
        },
      },
    ]);
  };

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
  const canPay =
    !['cancelled', 'no_show'].includes(appt.status) &&
    (!appt.payment_status || appt.payment_status === 'issued' || appt.payment_status === 'overdue');
  const canRefund = appt.status === 'cancelled' && appt.payment_status === 'paid';

  const PAYMENT_COLOR: Record<string, string> = {
    paid: '#10b981',
    issued: '#f59e0b',
    partially_paid: '#f59e0b',
    overdue: '#ef4444',
    voided: '#94a3b8',
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
          <Row label="Date" value={appt.appointment_date ?? appt.scheduled_date} />
          <Row
            label="Time"
            value={
              appt.start_time
                ? appt.end_time
                  ? `${appt.start_time} – ${appt.end_time}`
                  : appt.start_time
                : appt.scheduled_time
            }
          />
          <Row label="Type" value={appt.appointment_type?.replace(/_/g, ' ')} />
          {appt.chief_complaint && <Row label="Reason" value={appt.chief_complaint} />}
        </View>

        {/* Payment card */}
        <View style={styles.card}>
          <View style={styles.paymentHeader}>
            <Text style={styles.sectionTitle}>Payment</Text>
            {appt.payment_status ? (
              <View
                style={[
                  styles.payBadge,
                  { backgroundColor: `${PAYMENT_COLOR[appt.payment_status] ?? '#94a3b8'}20` },
                ]}
              >
                <Text
                  style={[
                    styles.payBadgeText,
                    { color: PAYMENT_COLOR[appt.payment_status] ?? '#94a3b8' },
                  ]}
                >
                  {appt.payment_status.replace(/_/g, ' ')}
                </Text>
              </View>
            ) : (
              <View style={[styles.payBadge, { backgroundColor: '#f1f5f9' }]}>
                <Text style={[styles.payBadgeText, { color: '#64748b' }]}>Unpaid</Text>
              </View>
            )}
          </View>
          {appt.consultation_fee != null && (
            <Text style={styles.feeText}>₹{appt.consultation_fee.toLocaleString()}</Text>
          )}
          {canPay && (
            <TouchableOpacity style={styles.payBtn} onPress={() => setShowPayModal(true)}>
              <Ionicons name="card" size={16} color="#fff" />
              <Text style={styles.payBtnText}>Pay Now</Text>
            </TouchableOpacity>
          )}
          {canRefund && (
            <TouchableOpacity style={styles.refundBtn} onPress={handleRefund}>
              <Ionicons name="return-down-back" size={16} color="#ea580c" />
              <Text style={styles.refundBtnText}>Issue Refund</Text>
            </TouchableOpacity>
          )}
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

      {/* Payment method modal */}
      <Modal
        visible={showPayModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Payment Method</Text>
            {appt.consultation_fee != null && (
              <Text style={styles.modalFee}>₹{appt.consultation_fee.toLocaleString()}</Text>
            )}
            {!isPatient && (
              <TouchableOpacity
                style={[styles.methodBtn, { backgroundColor: '#10b981' }]}
                onPress={handleCashPayment}
                disabled={paying}
              >
                {paying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cash" size={18} color="#fff" />
                    <Text style={styles.methodBtnText}>Pay with Cash</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.methodBtn, { backgroundColor: '#2563eb', marginTop: 10 }]}
              onPress={handleRazorpayPayment}
              disabled={paying}
            >
              {paying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="card" size={18} color="#fff" />
                  <Text style={styles.methodBtnText}>Pay Online (Razorpay)</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodBtn, { backgroundColor: '#f1f5f9', marginTop: 10 }]}
              onPress={() => setShowPayModal(false)}
            >
              <Text style={[styles.methodBtnText, { color: '#64748b' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Razorpay WebView modal — native only */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={showRazorpay}
          animationType="slide"
          onRequestClose={() => setShowRazorpay(false)}
        >
          <SafeAreaView style={styles.webViewContainer}>
            <View style={styles.webViewHeader}>
              <Text style={styles.webViewTitle}>Secure Payment</Text>
              <TouchableOpacity onPress={() => setShowRazorpay(false)} style={styles.webViewClose}>
                <Ionicons name="close" size={22} color="#1e293b" />
              </TouchableOpacity>
            </View>
            {razorpayOrder && (
              <WebView
                source={{ html: getRazorpayHTML(razorpayOrder) }}
                onMessage={handleWebViewMessage}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                  </View>
                )}
              />
            )}
          </SafeAreaView>
        </Modal>
      )}
    </>
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
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  payBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  payBadgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  feeText: { fontSize: 24, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 12,
  },
  payBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  refundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  refundBtnText: { color: '#ea580c', fontWeight: '600', fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 360,
    ...shadows.md,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  modalFee: { fontSize: 26, fontWeight: '800', color: '#1e293b', marginBottom: 20 },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 13,
  },
  methodBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  webViewContainer: { flex: 1, backgroundColor: '#fff' },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  webViewTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  webViewClose: { padding: 4 },
});
