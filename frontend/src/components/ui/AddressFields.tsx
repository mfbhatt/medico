import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { ALL_COUNTRIES, type Country } from "@/utils/addressData";

export interface AddressValue {
  country: string;
  state: string;
  city: string;
  postal_code: string;
}

interface ApiState {
  id: string;
  code: string;
  name: string;
  country_code: string;
}

interface ApiCity {
  id: string;
  name: string;
  state_id: string;
  country_code: string;
}

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (val: AddressValue) => void;
  countries: Country[];
  required?: { country?: boolean; state?: boolean; city?: boolean; postal_code?: boolean };
  inputCls?: string;
  showLabels?: boolean;
}

export default function AddressFields({
  value,
  onChange,
  countries,
  required = {},
  inputCls = "input",
  showLabels = true,
}: AddressFieldsProps) {
  const selectedCountry =
    countries.find((c) => c.code === value.country) ??
    ALL_COUNTRIES.find((c) => c.code === value.country) ??
    null;

  // Fetch states from DB for the selected country
  const { data: statesData = [] } = useQuery<ApiState[]>({
    queryKey: ["location-states", value.country],
    queryFn: () =>
      api
        .get(`/locations/countries/${value.country}/states`)
        .then((r) => r.data.data),
    enabled: !!value.country,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch cities from DB for the selected state
  const { data: citiesData = [] } = useQuery<ApiCity[]>({
    queryKey: ["location-cities", value.country, value.state],
    queryFn: () =>
      api
        .get(`/locations/countries/${value.country}/states/${value.state}/cities`)
        .then((r) => r.data.data),
    enabled: !!value.country && !!value.state,
    staleTime: 10 * 60 * 1000,
  });

  // When country changes: clear state, city, and postal_code
  const handleCountryChange = (countryCode: string) => {
    onChange({ country: countryCode, state: "", city: "", postal_code: "" });
  };

  // When state changes: clear city
  const handleStateChange = (stateCode: string) => {
    onChange({ ...value, state: stateCode, city: "" });
  };

  const set = (field: keyof AddressValue) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...value, [field]: e.target.value });

  const stateLabel = selectedCountry?.stateLabel ?? "State / Region";
  const postalLabel = selectedCountry?.postalLabel ?? "Postal Code";
  const hasStates = statesData.length > 0;
  const hasCities = citiesData.length > 0;

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
          onChange={(e) => handleCountryChange(e.target.value)}
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

      {/* State / City / Postal in a row — order: State, City, Postal */}
      <div className="grid grid-cols-3 gap-3">
        {/* State */}
        <div>
          {showLabels && (
            <label className={labelCls}>
              {stateLabel}{required.state ? " *" : ""}
            </label>
          )}
          {hasStates ? (
            <select
              value={value.state}
              onChange={(e) => handleStateChange(e.target.value)}
              required={required.state}
              className={inputCls}
            >
              <option value="">Select…</option>
              {statesData.map((s) => (
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

        {/* City */}
        <div>
          {showLabels && (
            <label className={labelCls}>
              City{required.city ? " *" : ""}
            </label>
          )}
          {hasCities ? (
            <select
              value={value.city}
              onChange={set("city")}
              required={required.city}
              className={inputCls}
            >
              <option value="">Select…</option>
              {citiesData.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="City"
              value={value.city}
              onChange={set("city")}
              required={required.city}
              className={inputCls}
            />
          )}
        </div>

        {/* Postal code */}
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
