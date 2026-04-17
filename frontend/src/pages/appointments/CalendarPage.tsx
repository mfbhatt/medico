import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Plus, CalendarDays } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import api from "@/services/api";

const STATUS_META: Record<string, { dot: string; label: string; card: string; text: string }> = {
  scheduled:   { dot: "bg-primary-500",  label: "Scheduled",   card: "bg-primary-50  border-l-[3px] border-primary-500",  text: "text-primary-700" },
  checked_in:  { dot: "bg-amber-400",    label: "Checked In",  card: "bg-amber-50   border-l-[3px] border-amber-400",    text: "text-amber-700" },
  in_progress: { dot: "bg-violet-500",   label: "In Progress", card: "bg-violet-50  border-l-[3px] border-violet-500",   text: "text-violet-700" },
  completed:   { dot: "bg-emerald-500",  label: "Completed",   card: "bg-emerald-50 border-l-[3px] border-emerald-500",  text: "text-emerald-700" },
  cancelled:   { dot: "bg-slate-400",    label: "Cancelled",   card: "bg-slate-50   border-l-[3px] border-slate-400",    text: "text-slate-500" },
  no_show:     { dot: "bg-red-400",      label: "No Show",     card: "bg-red-50     border-l-[3px] border-red-400",      text: "text-red-600" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");

export default function CalendarPage() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const dateFrom = `${year}-${pad(month + 1)}-01`;
  const dateTo = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;

  const { data: apptData } = useQuery({
    queryKey: ["appointments-calendar", year, month],
    queryFn: () =>
      api
        .get("/appointments/", { params: { date_from: dateFrom, date_to: dateTo, page_size: 200 } })
        .then((r) => r.data),
  });

  const appointments: any[] = apptData?.data ?? [];

  const getDateStr = (day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

  const apptsByDate: Record<string, any[]> = {};
  for (const a of appointments) {
    const d = a.appointment_date;
    if (!apptsByDate[d]) apptsByDate[d] = [];
    apptsByDate[d].push(a);
  }

  const selectedAppts = (apptsByDate[selectedDate] ?? [])
    .slice()
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  const fmtSelectedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("default", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const monthLabel = currentDate.toLocaleString("default", { month: "long" });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointment Calendar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Monthly overview of scheduled appointments</p>
        </div>
        <RouterLink
          to={`/appointments/new?date=${selectedDate}`}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Appointment
        </RouterLink>
      </div>

      <div className="grid grid-cols-3 gap-5 items-start">
        {/* ── Calendar ── */}
        <div className="col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900">{monthLabel}</span>
              <span className="text-lg font-medium text-slate-400">{year}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
                  setSelectedDate(todayStr);
                }}
                className="px-3 py-1 text-xs font-semibold text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid — gap-px + bg-slate-100 renders 1 px lines between cells */}
          <div className="grid grid-cols-7 gap-px bg-slate-100">
            {/* Leading empty cells */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`e-${i}`} className="h-[72px] bg-slate-50" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const ds = getDateStr(day);
              const dayAppts = apptsByDate[ds] ?? [];
              const count = dayAppts.length;
              const isToday = ds === todayStr;
              const isSelected = selectedDate === ds;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(ds)}
                  className={`h-[72px] flex flex-col items-start px-2.5 pt-2 pb-1.5 text-left transition focus:outline-none
                    ${isSelected
                      ? "bg-primary-600 ring-2 ring-inset ring-primary-400"
                      : isToday
                      ? "bg-primary-50 hover:bg-primary-100"
                      : "bg-white hover:bg-slate-50"
                    }
                  `}
                >
                  {/* Day number */}
                  {isToday && !isSelected ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-600 text-white rounded-full text-xs font-bold leading-none">
                      {day}
                    </span>
                  ) : (
                    <span
                      className={`text-sm font-semibold leading-none
                        ${isSelected ? "text-white" : isToday ? "text-primary-700" : "text-slate-700"}
                      `}
                    >
                      {day}
                    </span>
                  )}

                  {/* Appointment indicators */}
                  {count > 0 && (
                    <div className="mt-auto flex items-center gap-0.5 flex-wrap">
                      {count <= 5 ? (
                        dayAppts.slice(0, 5).map((a: any, idx: number) => (
                          <span
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                              ${isSelected
                                ? "bg-primary-200"
                                : (STATUS_META[a.status]?.dot ?? "bg-slate-400")
                              }
                            `}
                          />
                        ))
                      ) : (
                        <span
                          className={`text-[10px] font-bold leading-none
                            ${isSelected ? "text-primary-100" : "text-primary-600"}
                          `}
                        >
                          {count} appts
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Day panel ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2 mb-0.5">
              <CalendarDays className="h-4 w-4 text-primary-500 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-slate-800 leading-snug">{fmtSelectedDate}</h3>
            </div>
            <p className="text-xs text-slate-400 ml-6">
              {selectedAppts.length === 0
                ? "No appointments"
                : `${selectedAppts.length} appointment${selectedAppts.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Appointment list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[260px]">
            {selectedAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                <CalendarDays className="h-9 w-9 text-slate-200 mb-2.5" />
                <p className="text-sm font-medium text-slate-400">Nothing scheduled</p>
                <p className="text-xs text-slate-300 mt-0.5">Click a date to view or book</p>
              </div>
            ) : (
              selectedAppts.map((a: any) => {
                const m = STATUS_META[a.status] ?? STATUS_META.scheduled;
                return (
                  <RouterLink
                    key={a.id}
                    to={`/appointments/${a.id}`}
                    className={`block rounded-xl p-3 text-xs ${m.card} hover:opacity-90 transition`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-800 leading-snug line-clamp-1">
                        {a.patient_name ?? a.patient_id?.slice(0, 8) ?? "—"}
                      </p>
                      <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${m.dot}`} />
                    </div>

                    {(a.start_time || a.end_time) && (
                      <div className="flex items-center gap-1 mt-1.5 text-slate-500">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span>
                          {a.start_time}
                          {a.end_time ? ` – ${a.end_time}` : ""}
                        </span>
                      </div>
                    )}

                    {(a.chief_complaint ?? a.appointment_type) && (
                      <p className="mt-1 text-slate-500 line-clamp-1">
                        {a.chief_complaint ?? a.appointment_type}
                      </p>
                    )}

                    <span className={`inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide ${m.text}`}>
                      {m.label}
                    </span>
                  </RouterLink>
                );
              })
            )}
          </div>

          {/* Book CTA */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex-shrink-0">
            <RouterLink
              to={`/appointments/new?date=${selectedDate}`}
              className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-semibold text-primary-600 border border-primary-200 rounded-xl hover:bg-primary-50 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Book on this date
            </RouterLink>
          </div>
        </div>
      </div>

      {/* Status legend */}
      <div className="mt-4 flex items-center gap-5 flex-wrap">
        {Object.entries(STATUS_META).map(([key, m]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
}
