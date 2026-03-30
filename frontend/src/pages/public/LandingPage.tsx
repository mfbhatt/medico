import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Calendar,
  Shield,
  Clock,
  MapPin,
  Star,
  ChevronRight,
  Building2,
  UserCheck,
  HeartPulse,
} from "lucide-react";
import axios from "axios";

const publicApi = axios.create({ baseURL: "http://localhost:8000/api/v1" });

interface PublicClinic {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  services: string[];
  logo_url?: string;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: clinicsData } = useQuery({
    queryKey: ["public", "clinics", "featured"],
    queryFn: () => publicApi.get("/public/clinics?limit=6").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const featuredClinics: PublicClinic[] = clinicsData?.clinics ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/clinics${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ""}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Find & Book Your
              <br />
              <span className="text-blue-200">Doctor Appointment</span>
            </h1>
            <p className="text-lg text-blue-100 mb-10 max-w-xl">
              Search verified clinics and specialist doctors near you. Book appointments online in minutes — no phone calls needed.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex gap-3 max-w-xl">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by clinic name, city, or specialty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <button
                type="submit"
                className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors flex-shrink-0"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap gap-3 mt-6">
              {["Cardiology", "Dermatology", "Pediatrics", "Orthopedics", "General Practice"].map((s) => (
                <button
                  key={s}
                  onClick={() => navigate(`/clinics?search=${encodeURIComponent(s)}`)}
                  className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full border border-white/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: "200+", label: "Verified Clinics", icon: Building2 },
              { value: "1,500+", label: "Expert Doctors", icon: UserCheck },
              { value: "50k+", label: "Appointments Booked", icon: Calendar },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-2">
                <stat.icon className="h-7 w-7 text-blue-600" />
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Clinics */}
      {featuredClinics.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Featured Clinics</h2>
                <p className="text-gray-500 mt-1 text-sm">Verified and highly-rated healthcare providers</p>
              </div>
              <Link
                to="/clinics"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredClinics.map((clinic) => (
                <Link
                  key={clinic.id}
                  to={`/clinics/${clinic.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      {clinic.logo_url ? (
                        <img src={clinic.logo_url} alt="" className="w-8 h-8 object-contain" />
                      ) : (
                        <Building2 className="h-6 w-6 text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {clinic.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {clinic.city}, {clinic.state}
                      </div>
                    </div>
                  </div>
                  {clinic.services && clinic.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {clinic.services.slice(0, 3).map((s: string) => (
                        <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-gray-700 font-medium">4.8</span>
                      <span className="text-gray-400">(120)</span>
                    </div>
                    <span className="text-blue-600 font-medium text-xs group-hover:underline">
                      Book now →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how-it-works" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">
              Book your appointment in 3 simple steps — no registration required.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                icon: Search,
                title: "Find a Clinic",
                desc: "Search by specialty, doctor name, or location to find the right clinic for your needs.",
                color: "bg-blue-50 text-blue-600",
              },
              {
                step: "2",
                icon: Calendar,
                title: "Choose a Slot",
                desc: "Browse available time slots and pick one that works best for your schedule.",
                color: "bg-purple-50 text-purple-600",
              },
              {
                step: "3",
                icon: HeartPulse,
                title: "Confirm & Attend",
                desc: "Receive a confirmation with all the details. Show up and get the care you need.",
                color: "bg-green-50 text-green-600",
              },
            ].map((step) => (
              <div key={step.step} className="text-center">
                <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <step.icon className="h-8 w-8" />
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Step {step.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why trust us */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Verified Providers", desc: "All clinics are verified and licensed healthcare providers.", color: "text-blue-600 bg-blue-50" },
              { icon: Clock, title: "Real-time Availability", desc: "Live slot availability — no double bookings, no waiting on hold.", color: "text-purple-600 bg-purple-50" },
              { icon: Star, title: "Rated by Patients", desc: "Genuine patient reviews to help you choose the right doctor.", color: "text-yellow-600 bg-yellow-50" },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl border border-gray-200 p-6 flex gap-4">
                <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to book your appointment?</h2>
          <p className="text-blue-100 mb-8 text-sm max-w-md mx-auto">
            Find a doctor near you and get the care you deserve — right now.
          </p>
          <Link
            to="/clinics"
            className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors"
          >
            <Search className="h-4 w-4" />
            Find Clinics Near You
          </Link>
        </div>
      </section>
    </div>
  );
}
