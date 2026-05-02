import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { ALL_COUNTRIES, type Country } from "@/utils/addressData";

interface ApiCountry {
  code: string;
  name: string;
  state_label: string;
  postal_label: string;
}

function mapApiCountry(c: ApiCountry): Country {
  return {
    code: c.code,
    name: c.name,
    stateLabel: c.state_label,
    postalLabel: c.postal_label,
    states: [],
  };
}

/**
 * Returns the effective list of countries for the current user:
 * - Super admin: all active countries from DB
 * - Tenant user: filtered by tenant.settings.enabled_countries (or platform default)
 * Falls back to hardcoded ALL_COUNTRIES while loading.
 */
export function useEnabledCountries(): { countries: Country[]; isLoading: boolean } {
  const { data: allCountries, isLoading: countriesLoading } = useQuery<Country[]>({
    queryKey: ["location-countries"],
    queryFn: () =>
      api
        .get("/locations/countries")
        .then((r) => (r.data.data as ApiCountry[]).map(mapApiCountry)),
    staleTime: 10 * 60 * 1000,
    placeholderData: ALL_COUNTRIES,
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-me"],
    queryFn: () => api.get("/tenants/me").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: platformSettings, isLoading: platformLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => api.get("/settings/platform").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = countriesLoading || tenantLoading || platformLoading;
  const countries = (allCountries && allCountries.length > 0) ? allCountries : ALL_COUNTRIES;

  // Super admin has no tenant — show all countries
  if (!isLoading && tenant === null) {
    return { countries, isLoading: false };
  }

  const tenantCodes: string[] | undefined = tenant?.settings?.enabled_countries;
  const platformCodes: string[] | undefined = platformSettings?.enabled_countries;
  const effectiveCodes = tenantCodes ?? platformCodes ?? ["US"];

  const codeSet = new Set(effectiveCodes);
  const filtered = countries.filter((c) => codeSet.has(c.code));

  return {
    countries: filtered.length > 0 ? filtered : countries.filter((c) => c.code === "US"),
    isLoading,
  };
}
