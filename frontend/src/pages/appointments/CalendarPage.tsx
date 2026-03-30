import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Link } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import api from "@/services/api";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 border-l-4 border-blue-500 text-blue-900",
  checked_in: "bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900",
  in_progress: "bg-purple-100 border-l-4 border-purple-500 text-purple-900",
  completed: "bg-green-100 border-l-4 border-green-500 text-green-900",
  cancelled: "bg-gray-100 border-l-4 border-gray-400 text-gray-700",
  no_show: "bg-red-100 border-l-4 border-red-500 text-red-900",
};

export default function CalendarPage() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(today.toISOString().slice(0, 10));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: apptData } = useQuery({
    queryKey: ["appointments-calendar", year, month],
    queryFn: () =>
      api.get("/appointments/", {
        params: { date_from: dateFrom, date_to: dateTo, page_size: 200 },
      }).then((r) => r.data),
  });

  const appointments: any[] = apptData?.data ?? [];

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const apptsByDate: Record<string, any[]> = {};
  for (const a of appointments) {
    const d = a.appointment_date;
    if (!apptsByDate[d]) apptsByDate[d] = [];
    apptsByDate[d].push(a);
  }

  const selectedDateAppts = selectedDate ? (apptsByDate[selectedDate] ?? []) : [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Appointment Calendar</h1>
        <p className="text-sm text-slate-500 mt-1">Monthly view of all scheduled appointments</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900">{monthName}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ChevronLeft className="h-5 w-5 text-slate-600" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 border border-blue-200 rounded-lg"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ChevronRight className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const ds = getDateStr(day);
              const count = apptsByDate[ds]?.length ?? 0;
              const isToday = ds === today.toISOString().slice(0, 10);
              const isSelected = selectedDate === ds;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(ds)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : isToday
                      ? "bg-blue-50 text-blue-700 border-2 border-blue-400"
                      : count > 0
                      ? "bg-slate-50 text-slate-900 border border-slate-200"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {day}
                  {count > 0 && (
                    <span className={`text-xs mt-0.5 font-semibold ${isSelected ? "text-blue-200" : "text-blue-600"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day appointments */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            {selectedDate
              ? new Date(selectedDate + "T00:00:00").toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" })
              : "Select a date"}
          </h3>

          {!selectedDate && <p className="text-sm text-slate-400">Click on a date to see appointments</p>}

          {selectedDate && selectedDateAppts.length === 0 && (
            <p className="text-sm text-slate-400">No appointments on this day.</p>
          )}

          <div className="space-y-2.5">
            {selectedDateAppts
              .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
              .map((a: any) => (
                <RouterLink
                  key={a.id}
                  to={`/appointments/${a.id}`}
                  className={`block p-3 rounded-lg text-xs ${STATUS_COLORS[a.status] ?? "bg-gray-100"}`}
                >
                  <p className="font-semibold">{a.start_time} {a.end_time ? `– ${a.end_time}` : ""}</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    {a.patient_id?.slice(0, 8)} · {a.chief_complaint ?? a.appointment_type ?? "Appointment"}
                  </p>
                  <p className="mt-0.5 capitalize opacity-70">{a.status?.replace(/_/g, " ")}</p>
                </RouterLink>
              ))}
          </div>

          {selectedDate && (
            <RouterLink
              to={`/appointments/new?date=${selectedDate}`}
              className="mt-4 w-full block text-center text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg py-2 hover:bg-blue-50"
            >
              + Book on this date
            </RouterLink>
          )}
        </div>
      </div>
    </div>
  );
}
