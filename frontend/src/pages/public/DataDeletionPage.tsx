import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, CheckCircle, Clock, FileText, Mail } from "lucide-react";

type Step = { icon: React.ElementType; title: string; desc: string };

const steps: Step[] = [
  {
    icon: FileText,
    title: "Submit your request",
    desc: "Fill in the form below or email us directly. Include the email address or phone number linked to your account.",
  },
  {
    icon: Clock,
    title: "We verify your identity",
    desc: "We may send a confirmation to your registered email or phone to verify that you are the account owner.",
  },
  {
    icon: Trash2,
    title: "Data is deleted within 30 days",
    desc: "Once verified, your account, personal data, and appointment history are permanently deleted from our systems.",
  },
];

const whatIsDeleted = [
  "Your name, email address, and phone number",
  "Date of birth and gender",
  "Appointment booking history",
  "Session and login data",
  "Notification preferences",
];

const whatIsRetained = [
  "Anonymised, aggregated usage statistics (no personal identifiers)",
  "Records legally required to be retained under applicable healthcare or financial regulations (held in an anonymised or minimal form)",
  "Backups — purged from backup storage within 90 days of the deletion date",
];

export default function DataDeletionPage() {
  const [form, setForm] = useState({ name: "", contact: "", reason: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim()) return;
    setLoading(true);
    // Simulate network request — replace with a real API call when ready.
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header banner */}
      <div className="bg-gradient-to-br from-red-500 to-rose-600 text-white py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trash2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Request Data Deletion</h1>
            <p className="text-rose-200 mt-1 text-sm">
              Your right to erasure — we take it seriously.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">

        {/* How it works */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-6">How the process works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <div key={s.title} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <s.icon className="h-4 w-4" />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 w-px bg-gray-200 my-2 hidden md:block" />
                  )}
                </div>
                <div className="pb-6">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Step {i + 1}
                  </p>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What gets deleted / retained */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" /> What will be deleted
            </h2>
            <ul className="space-y-2">
              {whatIsDeleted.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" /> What may be retained
            </h2>
            <ul className="space-y-2">
              {whatIsRetained.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-500">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Request form */}
        <section>
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Request received</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  We've received your deletion request. You'll hear from us within 5 business days to verify your identity before we proceed.
                </p>
                <Link to="/" className="mt-6 text-sm text-blue-600 hover:underline">
                  ← Back to Home
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Submit a deletion request</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Fill in the form below. We'll verify your identity and process the request within 30 days.
                  Alternatively, email us at{" "}
                  <a href="mailto:privacy@clinichub.com" className="text-blue-600 hover:underline">
                    privacy@clinichub.com
                  </a>.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Jane Smith"
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email or phone on account <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="contact"
                        value={form.contact}
                        onChange={handleChange}
                        placeholder="jane@example.com or +1 555 000 0000"
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <select
                      name="reason"
                      value={form.reason}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                    >
                      <option value="">Select a reason…</option>
                      <option value="no_longer_needed">I no longer use the service</option>
                      <option value="privacy_concern">Privacy concern</option>
                      <option value="switching_provider">Switching to another provider</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={loading || !form.name.trim() || !form.contact.trim()}
                      className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
                    >
                      {loading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Submitting…
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Submit deletion request
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>

        {/* Email fallback */}
        <section className="flex items-start gap-4 bg-blue-50 border border-blue-100 rounded-xl p-5">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Mail className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Prefer to email?</h3>
            <p className="text-sm text-gray-500">
              Send your request to{" "}
              <a href="mailto:privacy@clinichub.com" className="text-blue-600 hover:underline font-medium">
                privacy@clinichub.com
              </a>{" "}
              with the subject line <em>"Data Deletion Request"</em> and include the name and contact details on your account.
            </p>
          </div>
        </section>

        <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
          <Link to="/" className="text-blue-600 hover:underline">← Back to Home</Link>
          <Link to="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
