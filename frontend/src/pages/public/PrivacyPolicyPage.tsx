import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import appConfig from "../../config/app";

const LAST_UPDATED = "April 25, 2026";

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    content: (
      <>
        <p>We collect information you provide directly to us, including:</p>
        <ul>
          <li><strong>Account information</strong> — name, email address, phone number, and password when you register or log in via OTP.</li>
          <li><strong>Profile information</strong> — date of birth, gender, and any other details you add to your patient profile.</li>
          <li><strong>Appointment data</strong> — clinic selections, booking history, and any notes associated with appointments.</li>
          <li><strong>Usage data</strong> — pages visited, features used, device type, browser, and IP address, collected automatically via logs.</li>
        </ul>
        <p>We do <strong>not</strong> collect payment card details directly; payments are processed by our third-party payment partners.</p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Information",
    content: (
      <>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Create and manage your account and authenticate your identity.</li>
          <li>Process and confirm appointment bookings.</li>
          <li>Send appointment reminders, OTP codes, and service notifications via SMS or email.</li>
          <li>Improve and personalise your experience on the platform.</li>
          <li>Comply with legal obligations and resolve disputes.</li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    title: "3. Information Sharing",
    content: (
      <>
        <p>We share your personal information only in the following circumstances:</p>
        <ul>
          <li><strong>With clinics</strong> — the clinic you book with receives your name, phone, and appointment details to facilitate your visit.</li>
          <li><strong>Service providers</strong> — we use trusted third-party vendors (SMS gateways, email providers, cloud infrastructure) who process data on our behalf under strict data processing agreements.</li>
          <li><strong>Legal requirements</strong> — we may disclose information when required by law, court order, or governmental authority.</li>
        </ul>
        <p>We do <strong>not</strong> sell your personal data to third parties.</p>
      </>
    ),
  },
  {
    id: "data-retention",
    title: "4. Data Retention",
    content: (
      <p>
        We retain your personal data for as long as your account is active or as needed to provide services. Medical and appointment records may be retained for longer periods where required by applicable healthcare laws. You may request deletion of your account at any time — see the <Link to="/data-deletion" className="text-blue-600 hover:underline">Data Deletion</Link> page for details.
      </p>
    ),
  },
  {
    id: "security",
    title: "5. Security",
    content: (
      <p>
        We implement industry-standard security measures including TLS 1.3 encryption in transit, encrypted storage for sensitive fields, role-based access controls, and regular security audits. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "6. Your Rights",
    content: (
      <>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate or incomplete data.</li>
          <li>Request deletion of your account and associated data.</li>
          <li>Object to or restrict certain processing activities.</li>
          <li>Port your data to another service provider.</li>
        </ul>
        <p>
          To exercise any of these rights, visit our <Link to="/data-deletion" className="text-blue-600 hover:underline">Data Deletion page</Link> or contact us at{" "}
          <a href="mailto:privacy@clinichub.com" className="text-blue-600 hover:underline">privacy@clinichub.com</a>.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "7. Cookies & Tracking",
    content: (
      <p>
        We use essential cookies to maintain your session and preferences. We do not use third-party advertising cookies. You can disable cookies in your browser settings, though some features may not function correctly as a result.
      </p>
    ),
  },
  {
    id: "children",
    title: "8. Children's Privacy",
    content: (
      <p>
        Our platform is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact us and we will delete it promptly.
      </p>
    ),
  },
  {
    id: "changes",
    title: "9. Changes to This Policy",
    content: (
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page with an updated date and, where appropriate, by sending an email notification. Your continued use of the platform after changes are posted constitutes your acceptance of the updated policy.
      </p>
    ),
  },
  {
    id: "contact",
    title: "10. Contact Us",
    content: (
      <p>
        If you have questions about this Privacy Policy or how we handle your data, please email us at{" "}
        <a href="mailto:privacy@clinichub.com" className="text-blue-600 hover:underline">privacy@clinichub.com</a>.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Header banner */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-blue-200 mt-1 text-sm">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:flex gap-12">
          {/* Sidebar TOC — hidden on small screens */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contents</p>
              <nav className="space-y-1">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block text-sm text-gray-500 hover:text-blue-600 py-1 transition-colors leading-snug"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <article className="flex-1 prose prose-sm prose-gray max-w-none
            prose-headings:font-semibold prose-headings:text-gray-900
            prose-p:text-gray-600 prose-p:leading-relaxed
            prose-li:text-gray-600 prose-li:leading-relaxed
            prose-strong:text-gray-800
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
            <p className="text-gray-600 text-base leading-relaxed mb-10">
              {appConfig.name} ("we", "our", or "us") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and the choices you have.
            </p>

            {sections.map((s) => (
              <section key={s.id} id={s.id} className="mb-10">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{s.title}</h2>
                <div className="text-gray-600 text-sm leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
                  {s.content}
                </div>
              </section>
            ))}
          </article>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-wrap gap-4 text-sm">
          <Link to="/" className="text-blue-600 hover:underline">← Back to Home</Link>
          <Link to="/data-deletion" className="text-blue-600 hover:underline">Data Deletion Request →</Link>
        </div>
      </div>
    </div>
  );
}
