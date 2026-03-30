import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, ArrowLeft, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import api from "@/services/api";

const RESULT_STYLES: Record<string, string> = {
  normal: "bg-green-50 border-l-4 border-green-500",
  abnormal: "bg-yellow-50 border-l-4 border-yellow-500",
  critical: "bg-red-50 border-l-4 border-red-500",
};

export default function LabReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Reports are fetched per patient; here we navigate from lab orders which has the report object
  // We use the report ID to look up from a generic endpoint — if available — or show what we have
  const { data: report, isLoading, isError } = useQuery({
    queryKey: ["lab-report", id],
    queryFn: async () => {
      // Try fetching by ID (may not exist if endpoint absent); fall back to null
      try {
        const r = await api.get(`/lab/reports/${id}`);
        return r.data.data;
      } catch {
        return null;
      }
    },
    enabled: !!id,
    retry: false,
  });

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading lab report…</div>;
  if (isError || !report) return (
    <div className="max-w-3xl mx-auto py-12 text-center">
      <p className="text-slate-500 mb-4">Lab report not found or not available. Please access reports through the patient's lab order history.</p>
      <button onClick={() => navigate("/lab")} className="text-blue-600 hover:text-blue-700 text-sm font-medium">← Back to Lab Orders</button>
    </div>
  );

  const hasAbnormal = report.results?.some((r: any) => r.status !== "normal");

  const handlePrint = () => window.print();

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate("/lab")} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to Lab Orders
      </button>

      <div className="bg-white rounded-xl border border-slate-200" id="print-area">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Lab Report</h1>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">#{report.order_number ?? id?.slice(0, 8)}</p>
          </div>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm">
            <Download className="h-4 w-4" /> Download / Print
          </button>
        </div>

        {hasAbnormal && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 mx-6 mt-5 p-4 rounded">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800 text-sm">Abnormal Results Detected</p>
                <p className="text-xs text-yellow-700 mt-0.5">Some results are outside the normal range. Please review with the ordering physician.</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {report.patient_name && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Patient</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{report.patient_name}</p>
              </div>
            )}
            {report.lab_name && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Lab</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{report.lab_name}</p>
              </div>
            )}
            {report.sample_collected_at && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Sample Date</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{report.sample_collected_at?.slice(0, 10)}</p>
              </div>
            )}
            {report.resulted_at && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Result Date</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{report.resulted_at?.slice(0, 10)}</p>
              </div>
            )}
          </div>

          {report.results?.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-slate-900 mb-3">Test Results</h2>
              <div className="space-y-2">
                {report.results.map((result: any, i: number) => (
                  <div key={i} className={`p-4 rounded-lg ${RESULT_STYLES[result.status] ?? ""}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{result.test_name}</p>
                        {result.reference_range && (
                          <p className="text-xs text-slate-500 mt-0.5">Reference: {result.reference_range} {result.unit}</p>
                        )}
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <p className="text-lg font-bold text-slate-900">
                          {result.value} <span className="text-sm font-normal text-slate-500">{result.unit}</span>
                        </p>
                        {result.status === "normal" && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {result.status === "abnormal" && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                        {result.status === "critical" && <XCircle className="h-4 w-4 text-red-600" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.interpretation && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Clinical Notes</p>
              <p className="text-sm text-slate-800">{report.interpretation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
