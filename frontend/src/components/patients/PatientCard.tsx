interface PatientCardProps {
  patientId: string;
  name: string;
  age: number;
  bloodType: string;
  phone: string;
  lastVisit: string;
  onClick?: () => void;
}

export default function PatientCard({ patientId, name, age, bloodType, phone, lastVisit, onClick }: PatientCardProps) {
  return (
    <div onClick={onClick} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition cursor-pointer border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-bold text-gray-900 text-lg">{name}</p>
          <p className="text-xs text-gray-600">ID: {patientId}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold bg-red-100 text-red-800 px-2 py-1 rounded">{bloodType}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <p className="text-gray-600">Age</p>
          <p className="font-semibold text-gray-900">{age} years</p>
        </div>
        <div>
          <p className="text-gray-600">Phone</p>
          <p className="font-semibold text-gray-900 text-xs">{phone}</p>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-600">Last visit: {lastVisit}</p>
      </div>
    </div>
  );
}
