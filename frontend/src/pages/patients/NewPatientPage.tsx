import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { User, Phone, MapPin, FileText, Copy, CheckCircle } from "lucide-react";
import api from "@/services/api";
import AddressFields, { type AddressValue } from "@/components/ui/AddressFields";
import { useEnabledCountries } from "@/hooks/useEnabledCountries";

interface PatientForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  notes: string;
}

interface LoginCredentials {
  username: string;
  temporary_password: string;
  note: string;
}

export default function NewPatientPage() {
  const navigate = useNavigate();
  const { countries } = useEnabledCountries();
  const [credentials, setCredentials] = useState<LoginCredentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<PatientForm>({
    firstName: "", lastName: "", email: "", phone: "", dateOfBirth: "",
    gender: "", address: "",
    emergencyContact: "", emergencyPhone: "", notes: "",
  });
  const [address, setAddress] = useState<AddressValue>({
    country: "US", state: "", city: "", postal_code: "",
  });

  const mutation = useMutation({
    mutationFn: (data: PatientForm) =>
      api.post("/patients/", {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email || undefined,
        phone: data.phone,
        date_of_birth: data.dateOfBirth || undefined,
        gender: data.gender || undefined,
        address: data.address || undefined,
        country: address.country || undefined,
        city: address.city || undefined,
        state: address.state || undefined,
        zip_code: address.postal_code || undefined,
        emergency_contacts: data.emergencyContact
          ? [{ name: data.emergencyContact, phone: data.emergencyPhone, relationship: "Emergency Contact" }]
          : [],
        notes: data.notes || undefined,
      }),
    onSuccess: (res) => {
      const creds = res.data?.data?.login_credentials;
      if (creds) {
        setCredentials(creds);
      } else {
        navigate("/patients");
      }
    },
  });

  const handleCopy = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(
      `Login: ${credentials.username}\nPassword: ${credentials.temporary_password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const cls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (credentials) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-5">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Patient Registered</h2>
            <p className="text-sm text-slate-500 mt-1">A login account has been created. Share the credentials below with the patient.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Username</span>
              <span className="font-mono text-slate-800">{credentials.username}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Temporary Password</span>
              <span className="font-mono text-slate-800 font-semibold">{credentials.temporary_password}</span>
            </div>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {credentials.note}
          </p>
          <div className="flex gap-3 justify-center pt-1">
            <button onClick={handleCopy} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition">
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy Credentials"}
            </button>
            <button onClick={() => navigate("/patients")} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-5 py-2.5 rounded-lg text-sm transition">
              Go to Patients
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Register New Patient</h1>
        <p className="text-sm text-slate-500 mt-1">Add a new patient to the system</p>
      </div>

      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {(mutation.error as any)?.response?.data?.message ?? "Failed to create patient"}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <User className="h-4 w-4" /> Personal Information
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <input type="text" name="firstName" placeholder="First Name *" value={form.firstName} onChange={handleChange} required className={cls} />
            <input type="text" name="lastName" placeholder="Last Name *" value={form.lastName} onChange={handleChange} required className={cls} />
            <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} className={cls} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <select name="gender" value={form.gender} onChange={handleChange} className={cls}>
              <option value="">Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} className={`${cls} col-span-2`} />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Phone className="h-4 w-4" /> Contact
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <input type="tel" name="phone" placeholder="Phone Number *" value={form.phone} onChange={handleChange} required className={cls} />
            <input type="text" name="emergencyContact" placeholder="Emergency Contact Name" value={form.emergencyContact} onChange={handleChange} className={cls} />
            <input type="tel" name="emergencyPhone" placeholder="Emergency Contact Phone" value={form.emergencyPhone} onChange={handleChange} className={cls} />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Address
          </h2>
          <input type="text" name="address" placeholder="Street Address" value={form.address} onChange={handleChange} className={`${cls} mb-3`} />
          <AddressFields
            value={address}
            onChange={setAddress}
            countries={countries}
            inputCls={cls}
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Notes
          </h2>
          <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Allergies, medical history, special notes…" rows={3} className={cls} />
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="submit" disabled={mutation.isPending} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition">
            {mutation.isPending ? "Registering…" : "Register Patient"}
          </button>
          <button type="button" onClick={() => navigate("/patients")} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-6 py-2.5 rounded-lg text-sm transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
