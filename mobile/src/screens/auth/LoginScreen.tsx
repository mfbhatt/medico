/**
 * Patient Login Screen
 * Supports: Phone OTP  |  Email & Password  |  Google  |  Facebook
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { shadows } from '@/utils/theme';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { toast } from '../../utils/toast';
import { storage } from '../../utils/storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Localization from 'expo-localization';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { makeRedirectUri } from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import authApi, { LoginResponse } from '../../services/authApi';
import { useAppDispatch } from '../../store/hooks';
import { setCredentials } from '../../store/slices/authSlice';

// Required for expo-auth-session to dismiss the browser on redirect
WebBrowser.maybeCompleteAuthSession();

// ─── Country data ─────────────────────────────────────────────────────────────
type Country = { code: string; name: string; dial: string; flag: string };

const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', dial: '+93', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', dial: '+355', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', dial: '+213', flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩' },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { code: 'HR', name: 'Croatia', dial: '+385', flag: '🇭🇷' },
  { code: 'CZ', name: 'Czech Republic', dial: '+420', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { code: 'ET', name: 'Ethiopia', dial: '+251', flag: '🇪🇹' },
  { code: 'FI', name: 'Finland', dial: '+358', flag: '🇫🇮' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷' },
  { code: 'HK', name: 'Hong Kong', dial: '+852', flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary', dial: '+36', flag: '🇭🇺' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', dial: '+98', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', dial: '+964', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', dial: '+962', flag: '🇯🇴' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼' },
  { code: 'LB', name: 'Lebanon', dial: '+961', flag: '🇱🇧' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'MA', name: 'Morocco', dial: '+212', flag: '🇲🇦' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', dial: '+40', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal', dial: '+221', flag: '🇸🇳' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
  { code: 'TW', name: 'Taiwan', dial: '+886', flag: '🇹🇼' },
  { code: 'TZ', name: 'Tanzania', dial: '+255', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭' },
  { code: 'TN', name: 'Tunisia', dial: '+216', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
  { code: 'UG', name: 'Uganda', dial: '+256', flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine', dial: '+380', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', dial: '+967', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia', dial: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', dial: '+263', flag: '🇿🇼' },
];

const DEFAULT_COUNTRY: Country = { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' };

function detectCountry(): Country {
  try {
    const region = Localization.getLocales()[0]?.regionCode ?? '';
    return COUNTRIES.find((c) => c.code === region) ?? DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'phone' | 'email';
type PhoneStep = 'phone' | 'otp';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID;

async function persistSession(data: LoginResponse) {
  try {
    await storage.setItemAsync('access_token', data.access_token);
    await storage.setItemAsync('refresh_token', data.refresh_token);
    await storage.setItemAsync('user_data', JSON.stringify(data.user));
    const tenantId = data.user.tenant_id || TENANT_ID;
    if (tenantId) {
      await storage.setItemAsync('tenant_id', tenantId);
    }
  } catch (e) {
    console.warn('[persistSession] SecureStore unavailable, session will not persist:', e);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  // Tab
  const [tab, setTab] = useState<Tab>('phone');

  // Phone OTP state
  const [country, setCountry] = useState<Country>(detectCountry);
  const [phone, setPhone] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const otpRefs = useRef<TextInput[]>([]);

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Shared loading
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);

  // ── OAuth hooks ─────────────────────────────────────────────────────────────
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  });

  const [fbRequest, fbResponse, promptFacebook] = Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '',
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const token = googleResponse.authentication?.accessToken;
      if (token) handleSocialCallback('google', token);
    }
  }, [googleResponse]);

  useEffect(() => {
    if (fbResponse?.type === 'success') {
      const token = fbResponse.authentication?.accessToken;
      if (token) handleSocialCallback('facebook', token);
    }
  }, [fbResponse]);

  // ── Session helpers ─────────────────────────────────────────────────────────
  const finishLogin = async (data: LoginResponse) => {
    if (!data.access_token) {
      toast.error('Could not complete login. Please contact support.');
      return;
    }
    await persistSession(data);
    dispatch(setCredentials(data));
    if ((data as any).is_new_user) navigation.navigate('CompleteProfile');
  };

  // ── Phone OTP ───────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 5) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setLoading(true);
    try {
      await authApi.requestOtp(`${country.dial}${clean}`);
      setPhoneStep('otp');
      startCountdown();
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const data = await authApi.verifyOtp(`${country.dial}${phone.replace(/\D/g, '')}`, code, TENANT_ID);
      await finishLogin(data);
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = () => {
    setCountdown(60);
    const iv = setInterval(() => {
      setCountdown((p) => {
        if (p <= 1) { clearInterval(iv); return 0; }
        return p - 1;
      });
    }, 1000);
  };

  const handleOtpChange = (value: string, i: number) => {
    const next = [...otp];
    next[i] = value;
    setOtp(next);
    if (value && i < 5) otpRefs.current[i + 1]?.focus();
    if (value && i === 5 && next.join('').length === 6) handleVerifyOtp();
  };

  const handleOtpKey = (key: string, i: number) => {
    if (key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  // ── Email / Password ────────────────────────────────────────────────────────
  const handleEmailLogin = async () => {
    console.log('[Login] Sign In pressed', { email: email.trim(), hasPassword: !!password });
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.login(email.trim(), password);
      await finishLogin(data);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.response?.data?.detail ?? e?.message ?? 'Invalid credentials';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Social ──────────────────────────────────────────────────────────────────
  const handleSocialCallback = async (provider: 'google' | 'facebook', token: string) => {
    setSocialLoading(provider);
    try {
      const data = await authApi.socialLogin(provider, token);
      await finishLogin(data);
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? `Could not sign in with ${provider}`);
    } finally {
      setSocialLoading(null);
    }
  };

  // ── Biometric ───────────────────────────────────────────────────────────────
  const handleBiometric = async () => {
    const ok = await LocalAuthentication.hasHardwareAsync();
    if (!ok) { toast.info('Biometrics not supported on this device'); return; }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      fallbackLabel: 'Use Passcode',
    });
    if (result.success) {
      const token = await storage.getItemAsync('access_token');
      const raw = await storage.getItemAsync('user_data');
      if (token && raw) {
        const user = JSON.parse(raw);
        const refreshToken = await storage.getItemAsync('refresh_token') ?? '';
        dispatch(setCredentials({ access_token: token, refresh_token: refreshToken, user }));
      } else {
        toast.error('No saved session. Please log in first.');
      }
    }
  };

  // ── Country search ──────────────────────────────────────────────────────────
  const filteredCountries = useMemo(
    () =>
      search.trim()
        ? COUNTRIES.filter(
            (c) =>
              c.name.toLowerCase().includes(search.toLowerCase()) ||
              c.dial.includes(search) ||
              c.code.toLowerCase().includes(search.toLowerCase())
          )
        : COUNTRIES,
    [search]
  );

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>CM</Text>
          </View>
          <Text style={styles.title}>ClinicManagement</Text>
          <Text style={styles.subtitle}>Your health, simplified</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'phone' && styles.tabActive]}
              onPress={() => setTab('phone')}
            >
              <Ionicons name="phone-portrait-outline" size={15} color={tab === 'phone' ? '#1e40af' : '#94a3b8'} />
              <Text style={[styles.tabText, tab === 'phone' && styles.tabTextActive]}>Phone OTP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'email' && styles.tabActive]}
              onPress={() => setTab('email')}
            >
              <Ionicons name="mail-outline" size={15} color={tab === 'email' ? '#1e40af' : '#94a3b8'} />
              <Text style={[styles.tabText, tab === 'email' && styles.tabTextActive]}>Email</Text>
            </TouchableOpacity>
          </View>

          {/* ── Phone OTP tab ────────────────────────────────────────────── */}
          {tab === 'phone' && phoneStep === 'phone' && (
            <View>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity style={styles.dialBtn} onPress={() => setPickerVisible(true)}>
                  <Text style={styles.dialFlag}>{country.flag}</Text>
                  <Text style={styles.dialCode}>{country.dial}</Text>
                  <Ionicons name="chevron-down" size={13} color="#64748b" />
                </TouchableOpacity>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus
                />
              </View>
              <Text style={styles.hint}>
                We'll send a 6-digit code to {country.dial} {phone || 'your number'}
              </Text>
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </View>
          )}

          {tab === 'phone' && phoneStep === 'otp' && (
            <View>
              <Text style={styles.otpTitle}>Verify Your Number</Text>
              <Text style={styles.otpSubtitle}>
                Code sent to {country.flag} {country.dial} {phone}
              </Text>
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { if (r) otpRefs.current[i] = r; }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : undefined]}
                    value={digit}
                    onChangeText={(v) => handleOtpChange(v.slice(-1), i)}
                    onKeyPress={({ nativeEvent }) => handleOtpKey(nativeEvent.key, i)}
                    keyboardType="numeric"
                    maxLength={1}
                    textAlign="center"
                    autoFocus={i === 0}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify OTP</Text>}
              </TouchableOpacity>
              <View style={styles.resendRow}>
                {countdown > 0 ? (
                  <Text style={styles.resendGray}>Resend in {countdown}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleSendOtp}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => { setPhoneStep('phone'); setOtp(['','','','','','']); }}>
                <Text style={styles.changeLink}>Change phone number</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Email tab ────────────────────────────────────────────────── */}
          {tab === 'email' && (
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                autoFocus
              />

              <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Your password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={handleEmailLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleEmailLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Divider ──────────────────────────────────────────────────── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Social buttons ───────────────────────────────────────────── */}
          <View style={styles.socialRow}>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => promptGoogle()}
              disabled={!googleRequest || socialLoading !== null}
            >
              {socialLoading === 'google' ? (
                <ActivityIndicator size="small" color="#ea4335" />
              ) : (
                <>
                  <Text style={styles.socialIcon}>G</Text>
                  <Text style={styles.socialText}>Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => promptFacebook()}
              disabled={!fbRequest || socialLoading !== null}
            >
              {socialLoading === 'facebook' ? (
                <ActivityIndicator size="small" color="#1877f2" />
              ) : (
                <>
                  <Ionicons name="logo-facebook" size={18} color="#1877f2" />
                  <Text style={styles.socialText}>Facebook</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Biometric ────────────────────────────────────────────────── */}
          <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric}>
            <Ionicons name="finger-print" size={18} color="#1e40af" />
            <Text style={styles.biometricText}>Use Biometric Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => { setPickerVisible(false); setSearch(''); }}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search country or dial code…"
              value={search}
              onChangeText={setSearch}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.countryRow, item.code === country.code && styles.countryRowActive]}
                onPress={() => { setCountry(item); setPickerVisible(false); setSearch(''); }}
              >
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryDial}>{item.dial}</Text>
                {item.code === country.code && <Ionicons name="checkmark" size={18} color="#1e40af" />}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  // Header
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 68, height: 68, borderRadius: 18, backgroundColor: '#1e40af', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1e293b' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 24, ...shadows.lg },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 24 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 8 },
  tabActive: { backgroundColor: '#fff', ...shadows.sm },
  tabText: { fontSize: 13, fontWeight: '500', color: '#94a3b8' },
  tabTextActive: { color: '#1e40af', fontWeight: '600' },

  // Label
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },

  // Phone row
  phoneRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#f8fafc', overflow: 'hidden' },
  dialBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 13, gap: 4, borderRightWidth: 1, borderRightColor: '#e2e8f0', backgroundColor: '#f1f5f9' },
  dialFlag: { fontSize: 18 },
  dialCode: { fontSize: 13, fontWeight: '600', color: '#374151' },
  phoneInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#1e293b' },

  // Text input (email)
  textInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#1e293b', backgroundColor: '#f8fafc' },

  // Password
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#f8fafc' },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#1e293b' },
  eyeBtn: { paddingHorizontal: 14 },

  forgotBtn: { alignSelf: 'flex-end', marginTop: 8, marginBottom: 4 },
  forgotText: { fontSize: 13, color: '#1e40af', fontWeight: '500' },

  hint: { fontSize: 12, color: '#94a3b8', marginTop: 6, marginBottom: 16 },

  // Main button
  btn: { backgroundColor: '#1e40af', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // OTP
  otpTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  otpSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  otpBox: { width: 44, height: 50, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, fontSize: 20, fontWeight: '700', color: '#1e293b', backgroundColor: '#f8fafc' },
  otpBoxFilled: { borderColor: '#1e40af', backgroundColor: '#eff6ff' },
  resendRow: { alignItems: 'center', marginTop: 14 },
  resendGray: { color: '#94a3b8', fontSize: 13 },
  resendLink: { color: '#1e40af', fontSize: 13, fontWeight: '600' },
  changeLink: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 10 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  // Social
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingVertical: 12, backgroundColor: '#f8fafc' },
  socialIcon: { fontSize: 16, fontWeight: '700', color: '#ea4335' },
  socialText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  // Biometric
  biometricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 10 },
  biometricText: { color: '#1e40af', fontSize: 14, fontWeight: '500' },

  // Country picker modal
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#1e293b' },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  countryRowActive: { backgroundColor: '#eff6ff' },
  countryFlag: { fontSize: 22, width: 32 },
  countryName: { flex: 1, fontSize: 15, color: '#1e293b' },
  countryDial: { fontSize: 13, color: '#64748b', fontWeight: '500', marginRight: 4 },
});
