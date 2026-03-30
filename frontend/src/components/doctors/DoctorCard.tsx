import { Star } from "lucide-react";

interface DoctorCardProps {
  doctorId: string;
  name: string;
  specialization: string;
  rating: number;
  availableDates: number;
  photo?: string;
  onClick?: () => void;
}

export default function DoctorCard({ doctorId, name, specialization, rating, availableDates, onClick }: DoctorCardProps) {
  return (
    <div onClick={onClick} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition cursor-pointer border border-gray-200">
      <div className="mb-3">
        <div className="w-12 h-12 bg-indigo-200 rounded-full mb-3" />
        <p className="font-bold text-gray-900">{name}</p>
        <p className="text-sm text-gray-600">{specialization}</p>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`w-4 h-4 ${i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        ))}
        <span className="text-xs text-gray-600 ml-1">({rating.toFixed(1)})</span>
      </div>

      <div className="pt-3 border-t border-gray-200">
        <p className="text-sm text-indigo-600 font-semibold">{availableDates} slots available</p>
      </div>
    </div>
  );
}
