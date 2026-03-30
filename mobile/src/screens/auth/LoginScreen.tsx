/**
 * Patient Login Screen — OTP-based phone authentication.
 */
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { useNavigation } from "@react-navigation/native";

import { authApi } from "../../services/authApi";
import { useAppDispatch } from "../../store/hooks";
import { setCredentials } from "../../store/slices/authSlice";
import { colors } from "../../utils/theme";

type Step = "phone" | "otp" | "profile";

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpRefs = useRef<TextInput[]>([]);

  // ── Biometric Login ───────────────────────────────────────────
  const handleBiometricLogin = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      Alert.alert("Biometrics not available on this device");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to access ClinicManagement",
      fallbackLabel: "Use Passcode",
    });

    if (result.success) {
      const savedToken = await SecureStore.getItemAsync("access_token");
      if (savedToken) {
        // Restore session from secure storage
        const userData = await SecureStore.getItemAsync("user_data");
        if (userData) {
          dispatch(setCredentials({ ...JSON.parse(userData), access_token: savedToken }));
        }
      } else {
        Alert.alert("No saved session found. Please login with OTP.");
      }
    }
  };

  // ── Send OTP ──────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number");
      return;
    }

    setIsLoading(true);
    try {
      await authApi.sendOtp(`+1${cleanPhone}`);
      setStep("otp");
      startCountdown();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter all 6 digits");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.verifyOtp({
        phone: `+1${phone.replace(/\D/g, "")}`,
        otp: otpString,
      });

      const { access_token, refresh_token, user, is_new_user } = response.data.data;

      // Save to secure storage for biometric login
      await SecureStore.setItemAsync("access_token", access_token);
      await SecureStore.setItemAsync("refresh_token", refresh_token);
      await SecureStore.setItemAsync("user_data", JSON.stringify({ user, refresh_token }));

      dispatch(setCredentials({ access_token, refresh_token, user }));

      if (is_new_user) {
        navigation.navigate("CompleteProfile");
      }
    } catch (error: any) {
      Alert.alert("Invalid OTP", error.response?.data?.message || "Please try again");
    } finally {
      setIsLoading(false);
    }
  };

  const startCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next field
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    // Auto-submit when complete
    if (value && index === 5) {
      const complete = newOtp.join("");
      if (complete.length === 6) {
        handleVerifyOtp();
      }
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>CM</Text>
          </View>
          <Text style={styles.title}>ClinicManagement</Text>
          <Text style={styles.subtitle}>Your health, simplified</Text>
        </View>

        {/* Phone Step */}
        {step === "phone" && (
          <View style={styles.form}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneInput}>
              <Text style={styles.countryCode}>+1</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
                autoFocus
              />
            </View>
            <Text style={styles.hint}>
              We'll send a 6-digit verification code to this number
            </Text>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>

            {/* Biometric Login */}
            <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricLogin}>
              <Text style={styles.biometricText}>Use Biometric Login</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OTP Step */}
        {step === "otp" && (
          <View style={styles.form}>
            <Text style={styles.otpTitle}>Verify Your Number</Text>
            <Text style={styles.otpSubtitle}>
              Enter the 6-digit code sent to +1 {phone}
            </Text>

            <View style={styles.otpContainer}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => {
                    if (ref) otpRefs.current[i] = ref;
                  }}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={(val) => handleOtpChange(val.slice(-1), i)}
                  onKeyPress={({ nativeEvent }) =>
                    handleOtpKeyPress(nativeEvent.key, i)
                  }
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={i === 0}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify OTP</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              {countdown > 0 ? (
                <Text style={styles.resendText}>Resend OTP in {countdown}s</Text>
              ) : (
                <TouchableOpacity onPress={handleSendOtp}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={() => setStep("phone")}>
              <Text style={styles.backText}>Change Phone Number</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 40 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#1e40af",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", color: "#1e293b" },
  subtitle: { fontSize: 15, color: "#64748b", marginTop: 4 },
  form: { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  phoneInput: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, backgroundColor: "#f8fafc" },
  countryCode: { paddingHorizontal: 12, fontSize: 16, color: "#374151", borderRightWidth: 1, borderRightColor: "#e2e8f0", paddingVertical: 14 },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: "#1e293b" },
  hint: { fontSize: 12, color: "#94a3b8", marginTop: 8, marginBottom: 20 },
  button: { backgroundColor: "#1e40af", borderRadius: 10, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  biometricBtn: { marginTop: 16, alignItems: "center", paddingVertical: 12 },
  biometricText: { color: "#1e40af", fontSize: 15, fontWeight: "500" },
  otpTitle: { fontSize: 20, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  otpSubtitle: { fontSize: 14, color: "#64748b", marginBottom: 24 },
  otpContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  otpBox: { width: 46, height: 52, borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 10, fontSize: 22, fontWeight: "700", color: "#1e293b", backgroundColor: "#f8fafc" },
  otpBoxFilled: { borderColor: "#1e40af", backgroundColor: "#eff6ff" },
  resendContainer: { alignItems: "center", marginTop: 16 },
  resendText: { color: "#94a3b8", fontSize: 14 },
  resendLink: { color: "#1e40af", fontSize: 14, fontWeight: "600" },
  backText: { color: "#64748b", fontSize: 14, textAlign: "center", marginTop: 12 },
});
