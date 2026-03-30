import { useEffect } from "react";
import { type Country } from "@/utils/addressData";

export interface AddressValue {
  country: string;
  state: string;
  city: string;
  postal_code: string;
}

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (val: AddressValue) => void;
  /** List of countries to show in the dropdown (from useEnabledCountries) */
  countries: Country[];
  /** Field-level required flags */
  required?: { country?: boolean; state?: boolean; city?: boolean; postal_code?: boolean };
  /** Tailwind class applied to each input/select */
  inputCls?: string;
  /** Show inline labels above each field */
  showLabels?: boolean;
}

export default function AddressFields({
  value,
  onChange,
  countries,
  required = {},
  inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
  showLabels = true,
}: AddressFieldsProps) {
  const selectedCountry = countries.find((c) => c.code === value.country) ?? null;

  // Reset state when country changes
  useEffect(() => {
    if (value.state && selectedCountry && selectedCountry.states.length > 0) {
      const valid = selectedCountry.states.some((s) => s.code === value.state);
      if (!valid) onChange({ ...value, state: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.country]);

  const set = (field: keyof AddressValue) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...value, [field]: e.target.value });

  const stateLabel = selectedCountry?.stateLabel ?? "State / Region";
  const postalLabel = selectedCountry?.postalLabel ?? "Postal Code";
  const hasStateList = (selectedCountry?.states.length ?? 0) > 0;

  const labelCls = "text-xs text-slate-500 mb-1 block";

  return (
    <div className="space-y-3">
      {/* Country */}
      <div>
        {showLabels && (
          <label className={labelCls}>
            Country{required.country ? " *" : ""}
          </label>
        )}
        <select
          value={value.country}
          onChange={(e) => onChange({ ...value, country: e.target.value, state: "" })}
          required={required.country}
          className={inputCls}
        >
          <option value="">Select country…</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* City / State / Postal in a row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          {showLabels && (
            <label className={labelCls}>
              City{required.city ? " *" : ""}
            </label>
          )}
          <input
            type="text"
            placeholder="City"
            value={value.city}
            onChange={set("city")}
            required={required.city}
            className={inputCls}
          />
        </div>

        <div>
          {showLabels && (
            <label className={labelCls}>
              {stateLabel}{required.state ? " *" : ""}
            </label>
          )}
          {hasStateList ? (
            <select
              value={value.state}
              onChange={set("state")}
              required={required.state}
              className={inputCls}
            >
              <option value="">Select…</option>
              {selectedCountry!.states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder={stateLabel}
              value={value.state}
              onChange={set("state")}
              required={required.state}
              className={inputCls}
            />
          )}
        </div>

        <div>
          {showLabels && (
            <label className={labelCls}>
              {postalLabel}{required.postal_code ? " *" : ""}
            </label>
          )}
          <input
            type="text"
            placeholder={postalLabel}
            value={value.postal_code}
            onChange={set("postal_code")}
            required={required.postal_code}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
