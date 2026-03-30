import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Bell, Lock, User, Eye, DollarSign, Globe, Info } from 'lucide-react';
import api from '@/services/api';
import { ALL_COUNTRIES } from '@/utils/addressData';
import { useAppSelector } from '@/store/hooks';

const INPUT_CLS = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500";
const LABEL_CLS = "block text-gray-700 font-semibold mb-2";

/** Returns true if the tenant has its own value for this key (not inherited from platform). */
function isOverridden(tenantRaw: any, key: string): boolean {
  return tenantRaw?.settings != null && Object.prototype.hasOwnProperty.call(tenantRaw.settings, key);
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const role = useAppSelector((s) => s.auth.user?.role);
  const isSuperAdmin = role === 'super_admin';

  // Platform defaults (readable by everyone)
  const { data: platformSettings } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => api.get('/settings/platform').then((r) => r.data.data ?? {}),
    staleTime: 5 * 60 * 1000,
  });

  // Tenant data (null for super admin)
  const { data: tenantRaw } = useQuery({
    queryKey: ['tenant-me'],
    queryFn: () => api.get('/tenants/me').then((r) => r.data.data),
    enabled: !isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Effective settings: for super admin, this is the platform settings form;
  // for tenant admin, merged settings are returned by the backend (platform + tenant overrides)
  const effectiveSettings = isSuperAdmin ? (platformSettings ?? {}) : (tenantRaw?.settings ?? {});

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    clinicName: '',
    clinicEmail: '',
    clinicPhone: '',
    timezone: 'UTC',
    language: 'en',
    currency: 'USD',
    appointmentDuration: 30,
    cancelationDeadline: 24,
    emailNotifications: true,
    smsNotifications: true,
    twoFactorAuth: true,
  });

  useEffect(() => {
    if (isSuperAdmin) return; // super admin form is separate
    if (tenantRaw) {
      setForm({
        clinicName: tenantRaw.name ?? '',
        clinicEmail: tenantRaw.primary_email ?? '',
        clinicPhone: tenantRaw.primary_phone ?? '',
        timezone: tenantRaw.timezone ?? 'UTC',
        language: effectiveSettings.language ?? 'en',
        currency: effectiveSettings.currency ?? 'USD',
        appointmentDuration: effectiveSettings.appointment_duration ?? 30,
        cancelationDeadline: effectiveSettings.cancelation_deadline ?? 24,
        emailNotifications: effectiveSettings.email_notifications ?? true,
        smsNotifications: effectiveSettings.sms_notifications ?? true,
        twoFactorAuth: effectiveSettings.two_factor_auth ?? true,
      });
    }
  }, [tenantRaw]);

  // ── Platform form (super admin only) ────────────────────────────────────────
  const [platformForm, setPlatformForm] = useState({
    language: 'en',
    currency: 'USD',
    appointmentDuration: 30,
    cancelationDeadline: 24,
    emailNotifications: true,
    smsNotifications: true,
    twoFactorAuth: true,
  });

  useEffect(() => {
    if (!isSuperAdmin || !platformSettings) return;
    setPlatformForm({
      language: platformSettings.language ?? 'en',
      currency: platformSettings.currency ?? 'USD',
      appointmentDuration: platformSettings.appointment_duration ?? 30,
      cancelationDeadline: platformSettings.cancelation_deadline ?? 24,
      emailNotifications: platformSettings.email_notifications ?? true,
      smsNotifications: platformSettings.sms_notifications ?? true,
      twoFactorAuth: platformSettings.two_factor_auth ?? true,
    });
  }, [platformSettings, isSuperAdmin]);

  // ── Country selection ────────────────────────────────────────────────────────
  const [enabledCountries, setEnabledCountries] = useState<string[]>([]);

  useEffect(() => {
    if (isSuperAdmin) {
      setEnabledCountries(platformSettings?.enabled_countries ?? ['US']);
    } else if (tenantRaw) {
      // Show tenant's own override if present; otherwise inherit from platform
      const tenantOwn = tenantRaw.settings?.enabled_countries;
      setEnabledCountries(tenantOwn ?? platformSettings?.enabled_countries ?? ['US']);
    }
  }, [platformSettings, tenantRaw, isSuperAdmin]);

  const toggleCountry = (code: string) =>
    setEnabledCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [countrySaved, setCountrySaved] = useState(false);

  const invalidateBoth = () => {
    queryClient.invalidateQueries({ queryKey: ['tenant-me'] });
    queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
  };

  // Tenant admin: save tenant settings
  const saveTenantMutation = useMutation({
    mutationFn: () =>
      api.patch('/tenants/me', {
        name: form.clinicName,
        primary_email: form.clinicEmail,
        primary_phone: form.clinicPhone,
        timezone: form.timezone,
        settings: {
          language: form.language,
          currency: form.currency,
          appointment_duration: form.appointmentDuration,
          cancelation_deadline: form.cancelationDeadline,
          email_notifications: form.emailNotifications,
          sms_notifications: form.smsNotifications,
          two_factor_auth: form.twoFactorAuth,
        },
      }),
    onSuccess: () => {
      invalidateBoth();
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => setError(err.response?.data?.message ?? 'Failed to save settings'),
  });

  // Super admin: save platform defaults
  const savePlatformMutation = useMutation({
    mutationFn: () =>
      api.patch('/settings/platform', {
        language: platformForm.language,
        currency: platformForm.currency,
        appointment_duration: platformForm.appointmentDuration,
        cancelation_deadline: platformForm.cancelationDeadline,
        email_notifications: platformForm.emailNotifications,
        sms_notifications: platformForm.smsNotifications,
        two_factor_auth: platformForm.twoFactorAuth,
      }),
    onSuccess: () => {
      invalidateBoth();
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => setError(err.response?.data?.message ?? 'Failed to save platform settings'),
  });

  // Country save (both roles)
  const saveCountryMutation = useMutation({
    mutationFn: () => {
      if (isSuperAdmin) {
        return api.patch('/settings/platform', { enabled_countries: enabledCountries });
      }
      return api.patch('/tenants/me', { settings: { enabled_countries: enabledCountries } });
    },
    onSuccess: () => {
      invalidateBoth();
      setCountrySaved(true);
      setTimeout(() => setCountrySaved(false), 3000);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const v = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setForm((p) => ({ ...p, [name]: v }));
  };

  const handlePlatformChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const v = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setPlatformForm((p) => ({ ...p, [name]: v }));
  };

  const isPending = isSuperAdmin ? savePlatformMutation.isPending : saveTenantMutation.isPending;
  const handleSave = () => isSuperAdmin ? savePlatformMutation.mutate() : saveTenantMutation.mutate();
  const onChange = isSuperAdmin ? handlePlatformChange : handleChange;
  const values = isSuperAdmin ? {
    language: platformForm.language,
    currency: platformForm.currency,
    appointmentDuration: platformForm.appointmentDuration,
    cancelationDeadline: platformForm.cancelationDeadline,
    emailNotifications: platformForm.emailNotifications,
    smsNotifications: platformForm.smsNotifications,
    twoFactorAuth: platformForm.twoFactorAuth,
  } : {
    language: form.language,
    currency: form.currency,
    appointmentDuration: form.appointmentDuration,
    cancelationDeadline: form.cancelationDeadline,
    emailNotifications: form.emailNotifications,
    smsNotifications: form.smsNotifications,
    twoFactorAuth: form.twoFactorAuth,
  };

  /** Shows a small badge if the tenant has overridden a platform-level key. */
  const OverrideBadge = ({ settingKey }: { settingKey: string }) => {
    if (isSuperAdmin || !isOverridden(tenantRaw, settingKey)) return null;
    return <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">overridden</span>;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">
          {isSuperAdmin
            ? 'Manage platform-wide default settings. Tenant admins can override these per tenant.'
            : 'Manage your organization settings. Platform-level defaults apply where not overridden.'}
        </p>
      </div>

      {isSuperAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            You are editing <strong>platform-wide defaults</strong>. These apply to all tenants unless a tenant admin overrides them.
          </p>
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          ✓ Settings saved successfully!
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Clinic Information — tenant admin only */}
        {!isSuperAdmin && (
          <div className="bg-white rounded-lg shadow-lg">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
              <User className="w-6 h-6 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-900">Clinic Information</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={LABEL_CLS}>Clinic Name</label>
                <input type="text" name="clinicName" value={form.clinicName} onChange={handleChange} className={INPUT_CLS} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Email</label>
                  <input type="email" name="clinicEmail" value={form.clinicEmail} onChange={handleChange} className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Phone</label>
                  <input type="tel" name="clinicPhone" value={form.clinicPhone} onChange={handleChange} className={INPUT_CLS} />
                </div>
              </div>
              <div className="max-w-xs">
                <label className={LABEL_CLS}>Timezone</label>
                <select name="timezone" value={form.timezone} onChange={handleChange} className={INPUT_CLS}>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern (EST/EDT)</option>
                  <option value="America/Chicago">Central (CST/CDT)</option>
                  <option value="America/Denver">Mountain (MST/MDT)</option>
                  <option value="America/Los_Angeles">Pacific (PST/PDT)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Paris (CET/CEST)</option>
                  <option value="Asia/Dubai">Dubai (GST)</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Appointment Settings */}
        <div className="bg-white rounded-lg shadow-lg">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
            <Eye className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Appointment Settings
              {!isSuperAdmin && <span className="ml-2 text-sm text-gray-400 font-normal">(platform default)</span>}
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLS}>
                  Default Appointment Duration (minutes)
                  <OverrideBadge settingKey="appointment_duration" />
                </label>
                <input type="number" name="appointmentDuration" value={values.appointmentDuration} onChange={onChange}
                  min="10" step="5" className={INPUT_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>
                  Cancellation Deadline (hours)
                  <OverrideBadge settingKey="cancelation_deadline" />
                </label>
                <input type="number" name="cancelationDeadline" value={values.cancelationDeadline} onChange={onChange}
                  min="1" className={INPUT_CLS} />
              </div>
            </div>
          </div>
        </div>

        {/* Locale Settings */}
        <div className="bg-white rounded-lg shadow-lg">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Locale & Billing
              {!isSuperAdmin && <span className="ml-2 text-sm text-gray-400 font-normal">(platform default)</span>}
            </h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>
                Language
                <OverrideBadge settingKey="language" />
              </label>
              <select name="language" value={values.language} onChange={onChange} className={INPUT_CLS}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>
                Default Currency
                <OverrideBadge settingKey="currency" />
              </label>
              <select name="currency" value={values.currency} onChange={onChange} className={INPUT_CLS}>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="AED">AED — UAE Dirham (د.إ)</option>
                <option value="SAR">SAR — Saudi Riyal (﷼)</option>
                <option value="CAD">CAD — Canadian Dollar (CA$)</option>
                <option value="AUD">AUD — Australian Dollar (A$)</option>
                <option value="SGD">SGD — Singapore Dollar (S$)</option>
                <option value="MYR">MYR — Malaysian Ringgit (RM)</option>
                <option value="PKR">PKR — Pakistani Rupee (₨)</option>
                <option value="BDT">BDT — Bangladeshi Taka (৳)</option>
                <option value="NGN">NGN — Nigerian Naira (₦)</option>
                <option value="KES">KES — Kenyan Shilling (KSh)</option>
                <option value="ZAR">ZAR — South African Rand (R)</option>
                <option value="EGP">EGP — Egyptian Pound (E£)</option>
                <option value="TRY">TRY — Turkish Lira (₺)</option>
                <option value="BRL">BRL — Brazilian Real (R$)</option>
                <option value="MXN">MXN — Mexican Peso (MX$)</option>
                <option value="JPY">JPY — Japanese Yen (¥)</option>
                <option value="CNY">CNY — Chinese Yuan (¥)</option>
                <option value="CHF">CHF — Swiss Franc (CHF)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address & Location */}
        <div className="bg-white rounded-lg shadow-lg">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
            <Globe className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Address & Location</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isSuperAdmin
                  ? 'Set which countries are available platform-wide. Tenant admins can restrict or expand this list.'
                  : 'Select which countries are available in address forms. Inherits platform defaults if not overridden.'}
              </p>
            </div>
          </div>
          <div className="p-6">
            {!isSuperAdmin && platformSettings?.enabled_countries && !tenantRaw?.settings?.enabled_countries && (
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
                <Info className="w-4 h-4 flex-shrink-0" />
                Using platform default ({platformSettings.enabled_countries.length} countries). Select countries below to override.
              </div>
            )}
            {countrySaved && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                ✓ Country settings saved!
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4 max-h-72 overflow-y-auto border border-gray-100 rounded-lg p-3">
              {ALL_COUNTRIES.map((c) => (
                <label key={c.code} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-lg">
                  <input
                    type="checkbox"
                    checked={enabledCountries.includes(c.code)}
                    onChange={() => toggleCountry(c.code)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700 truncate" title={c.name}>
                    <span className="font-mono text-xs text-gray-400 mr-1">{c.code}</span>{c.name}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{enabledCountries.length} of {ALL_COUNTRIES.length} countries enabled</p>
              <button
                onClick={() => saveCountryMutation.mutate()}
                disabled={saveCountryMutation.isPending || enabledCountries.length === 0}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium px-4 py-2 rounded-lg text-sm transition"
              >
                <Save className="w-4 h-4" />
                {saveCountryMutation.isPending ? 'Saving…' : 'Save Country List'}
              </button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg shadow-lg">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
            <Bell className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Notification Settings
              {!isSuperAdmin && <span className="ml-2 text-sm text-gray-400 font-normal">(platform default)</span>}
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="emailNotifications" checked={values.emailNotifications} onChange={onChange}
                className="w-5 h-5 text-indigo-600 rounded" />
              <span className="text-gray-900 font-semibold">
                Enable Email Notifications
                <OverrideBadge settingKey="email_notifications" />
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="smsNotifications" checked={values.smsNotifications} onChange={onChange}
                className="w-5 h-5 text-indigo-600 rounded" />
              <span className="text-gray-900 font-semibold">
                Enable SMS Notifications
                <OverrideBadge settingKey="sms_notifications" />
              </span>
            </label>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg shadow-lg">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center gap-3">
            <Lock className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">Security Settings</h2>
          </div>
          <div className="p-6 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="twoFactorAuth" checked={values.twoFactorAuth} onChange={onChange}
                className="w-5 h-5 text-indigo-600 rounded" />
              <span className="text-gray-900 font-semibold">
                Require Two-Factor Authentication
                <OverrideBadge settingKey="two_factor_auth" />
              </span>
            </label>
            {!isSuperAdmin && (
              <button className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition">
                Change Password
              </button>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-lg transition"
          >
            <Save className="w-5 h-5" />
            {isPending ? 'Saving…' : isSuperAdmin ? 'Save Platform Defaults' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
