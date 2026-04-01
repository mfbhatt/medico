import { Calendar, Clock, MapPin } from "lucide-react";

interface AppointmentCardProps {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  clinic: string;
  status: "scheduled" | "completed" | "cancelled";
  onClick?: () => void;
}

export default function AppointmentCard({ patientName, doctorName, date, time, clinic, status, onClick }: AppointmentCardProps) {
  const statusColors = {
    scheduled: "bg-blue-100 text-blue-800 border-l-4 border-blue-500",
    completed: "bg-green-100 text-green-800 border-l-4 border-green-500",
    cancelled: "bg-red-100 text-red-800 border-l-4 border-red-500",
  };

  return (
    <div onClick={onClick} className={`p-4 rounded-lg cursor-pointer hover:shadow-lg transition ${statusColors[status]}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-bold text-gray-900">{patientName}</p>
          <p className="text-sm text-gray-600">Dr. {doctorName}</p>
        </div>
        <span className="text-xs font-bold uppercase">
          {status === "scheduled" && "📅"}
          {status === "completed" && "✓"}
          {status === "cancelled" && "✕"}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{time}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span>{clinic}</span>
        </div>
      </div>
    </div>
  );
}
