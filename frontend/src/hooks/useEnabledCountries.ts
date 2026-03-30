import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { ALL_COUNTRIES, type Country } from "@/utils/addressData";

/**
 * Returns the effective list of countries for the current user:
 * - Platform defaults set by super admin
 * - Overridden per-tenant by tenant admin
 * - Merged: tenant setting wins; if tenant has none, platform default applies
 * - Super admin sees all countries (no restriction)
 */
export function useEnabledCountries(): { countries: Country[]; isLoading: boolean } {
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

  const isLoading = tenantLoading || platformLoading;

  // Super admin has no tenant (tenant === null) — show all countries
  if (!isLoading && tenant === null) {
    return { countries: ALL_COUNTRIES, isLoading: false };
  }

  // Tenant's own override takes priority; fall back to platform setting; fall back to ["US"]
  const tenantCodes: string[] | undefined = tenant?.settings?.enabled_countries;
  const platformCodes: string[] | undefined = platformSettings?.enabled_countries;
  const effectiveCodes = tenantCodes ?? platformCodes ?? ["US"];

  const codeSet = new Set(effectiveCodes);
  const countries = ALL_COUNTRIES.filter((c) => codeSet.has(c.code));

  return { countries: countries.length > 0 ? countries : ALL_COUNTRIES.filter((c) => c.code === "US"), isLoading };
}
