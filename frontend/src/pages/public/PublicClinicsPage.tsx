import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ALL_COUNTRIES } from "@/utils/addressData";

function resolveStateName(countryCode: string, stateCode: string): string {
  if (!stateCode) return "";
  const country = ALL_COUNTRIES.find((c) => c.code === countryCode);
  if (!country || country.states.length === 0) return stateCode;
  const state = country.states.find((s) => s.code === stateCode);
  return state ? state.name : stateCode;
}
import {
  Search,
  MapPin,
  Phone,
  Building2,
  ChevronRight,
  SlidersHorizontal,
  Clock,
} from "lucide-react";
import axios from "axios";

const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1" });

interface PublicClinic {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  services: string[];
  logo_url?: string;
  operating_hours?: Record<string, { open: string; close: string; closed?: boolean }>;
  appointment_slot_duration: number;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function getTodayHours(hours?: PublicClinic["operating_hours"]) {
  if (!hours) return null;
  const day = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const h = hours[day];
  if (!h || h.closed) return "Closed today";
  return `${h.open} – ${h.close}`;
}

export default function PublicClinicsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [city, setCity] = useState(searchParams.get("city") ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["public", "clinics", search, city],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (city) params.set("city", city);
      params.set("limit", "24");
      return publicApi.get(`/public/clinics?${params}`).then((r) => r.data.data);
    },
    staleTime: 2 * 60 * 1000,
  });

  const clinics: PublicClinic[] = data?.clinics ?? [];
  const total: number = data?.total ?? 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (city) params.city = city;
    setSearchParams(params);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Search header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by clinic name or specialty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="relative sm:w-48">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="City..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Result count */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {search || city ? `Results for "${search || city}"` : "All Clinics"}
            </h1>
            {!isLoading && (
              <p className="text-sm text-gray-500 mt-0.5">{total} clinic{total !== 1 ? "s" : ""} found</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Sort: Relevance</span>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clinic cards */}
        {!isLoading && clinics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {clinics.map((clinic) => {
              const todayHours = getTodayHours(clinic.operating_hours);
              return (
                <Link
                  key={clinic.id}
                  to={`/clinics/${clinic.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all group flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      {clinic.logo_url ? (
                        <img src={clinic.logo_url} alt="" className="w-8 h-8 object-contain rounded" />
                      ) : (
                        <Building2 className="h-6 w-6 text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
                        {clinic.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {clinic.address}, {clinic.city}, {resolveStateName(clinic.country, clinic.state)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Services */}
                  {clinic.services && clinic.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {clinic.services.slice(0, 3).map((s: string) => (
                        <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {s}
                        </span>
                      ))}
                      {clinic.services.length > 3 && (
                        <span className="text-xs text-gray-400">+{clinic.services.length - 3} more</span>
                      )}
                    </div>
                  )}

                  <div className="flex-1" />

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                    <div className="space-y-1">
                      {clinic.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          {clinic.phone}
                        </div>
                      )}
                      {todayHours && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {todayHours}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-blue-600 text-xs font-medium">
                      Book <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && clinics.length === 0 && (
          <div className="text-center py-20">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No clinics found</h3>
            <p className="text-gray-500 text-sm mb-6">
              Try adjusting your search terms or browse all available clinics.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setCity("");
                setSearchParams({});
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
