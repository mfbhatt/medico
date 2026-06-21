// ─── Pharmacy Constants ────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  // { value: 'insurance', label: 'Insurance' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  // { value: 'wallet', label: 'Wallet' },
];

export const DRUG_FORMS = [
  'tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops',
  'inhaler', 'patch', 'suppository', 'powder', 'gel', 'other',
];

export const DOSE_OPTIONS: Record<string, string[]> = {
  tablet:      ['½ tablet', '1 tablet', '1½ tablets', '2 tablets', '3 tablets'],
  capsule:     ['1 capsule', '2 capsules'],
  syrup:       ['2.5 ml', '5 ml', '7.5 ml', '10 ml', '15 ml', '20 ml'],
  injection:   ['1 ampule', '½ vial', '1 vial'],
  cream:       ['thin layer', 'small amount'],
  gel:         ['thin layer', 'small amount'],
  drops:       ['1 drop', '2 drops', '3 drops', '4 drops', '5 drops'],
  inhaler:     ['1 puff', '2 puffs'],
  patch:       ['1 patch'],
  suppository: ['1 suppository'],
  powder:      ['1 sachet', '½ sachet'],
};

export const FREQ_OPTIONS = [
  'once daily', 'twice daily', 'three times daily', 'four times daily',
  'every 4 hours', 'every 6 hours', 'every 8 hours', 'every 12 hours',
  'at bedtime', 'once weekly', 'as needed',
];

export const TIMING_OPTIONS = [
  { value: '',                 label: '—' },
  { value: 'before food',      label: 'before food' },
  { value: 'after food',       label: 'after food' },
  { value: 'with food',        label: 'with food' },
  { value: 'on empty stomach', label: 'on empty stomach' },
  { value: 'with water',       label: 'with water' },
  { value: 'at bedtime',       label: 'at bedtime' },
  { value: 'in the morning',   label: 'in the morning' },
];

export const FORM_COLOR: Record<string, string> = {
  tablet:      'bg-blue-100 text-blue-700',
  capsule:     'bg-violet-100 text-violet-700',
  syrup:       'bg-emerald-100 text-emerald-700',
  injection:   'bg-red-100 text-red-700',
  cream:       'bg-pink-100 text-pink-700',
  gel:         'bg-fuchsia-100 text-fuchsia-700',
  drops:       'bg-cyan-100 text-cyan-700',
  inhaler:     'bg-sky-100 text-sky-700',
  patch:       'bg-orange-100 text-orange-700',
  suppository: 'bg-amber-100 text-amber-700',
  powder:      'bg-lime-100 text-lime-700',
};

export const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
];

export const OVERVIEW_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const EXPIRY_FILTERS = [
  { value: 'expired', label: 'Expired' },
  { value: 'expiring', label: 'Expiring Soon (≤60d)' },
  { value: '', label: 'All Batches' },
] as const;
