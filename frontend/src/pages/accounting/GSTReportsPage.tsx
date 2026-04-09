import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

type ReportType = 'gstr1' | 'gstr3b';

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function GSTReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';

  const [reportType, setReportType] = useState<ReportType>('gstr3b');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [submitted, setSubmitted] = useState(false);

  const { data: gstr3b, isLoading: loading3b } = useQuery({
    queryKey: ['accounting', 'gstr3b', dateFrom, dateTo],
    queryFn: () => api.get('/accounting/reports/gstr3b', { params: { date_from: dateFrom, date_to: dateTo } }).then(r => r.data.data),
    enabled: submitted && reportType === 'gstr3b',
  });

  const { data: gstr1, isLoading: loading1 } = useQuery({
    queryKey: ['accounting', 'gstr1', dateFrom, dateTo],
    queryFn: () => api.get('/accounting/reports/gstr1', { params: { date_from: dateFrom, date_to: dateTo } }).then(r => r.data.data),
    enabled: submitted && reportType === 'gstr1',
  });

  const isLoading = loading3b || loading1;

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row =>
      headers.map(h => JSON.stringify(row[h] ?? '')).join(',')
    )].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = filename;
    a.click();
  };

  return (
    <div>
      <div className="page-header mb-6">
        <h1 className="page-title">GST Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">GSTR-1 (Outward Supplies) and GSTR-3B (Summary Return)</p>
      </div>

      {/* Controls */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label">Report Type</label>
          <select className="input" value={reportType} onChange={e => { setReportType(e.target.value as ReportType); setSubmitted(false); }}>
            <option value="gstr3b">GSTR-3B (Summary)</option>
            <option value="gstr1">GSTR-1 (Invoice-wise)</option>
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn-primary mt-auto" onClick={() => setSubmitted(true)}>Generate</button>
        <button className="btn-secondary mt-auto print:hidden" onClick={() => window.print()}>Print</button>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-400">Generating report…</div>}

      {/* GSTR-3B */}
      {submitted && !isLoading && reportType === 'gstr3b' && gstr3b && (
        <div className="space-y-6">
          {/* Outward Supplies */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">3.1 Outward Taxable Supplies</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Taxable Amount" value={fmt(gstr3b.outward_supplies.taxable_amount)} />
              <SummaryCard label="CGST" value={fmt(gstr3b.outward_supplies.cgst)} />
              <SummaryCard label="SGST" value={fmt(gstr3b.outward_supplies.sgst)} />
              <SummaryCard label="IGST" value={fmt(gstr3b.outward_supplies.igst)} />
              <SummaryCard label="Total Tax" value={fmt(gstr3b.outward_supplies.total_tax)} sub="Outward" />
            </div>
          </div>

          {/* ITC */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">4. Eligible Input Tax Credit (ITC)</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Taxable Amount" value={fmt(gstr3b.input_tax_credit.taxable_amount)} />
              <SummaryCard label="CGST ITC" value={fmt(gstr3b.input_tax_credit.cgst)} />
              <SummaryCard label="SGST ITC" value={fmt(gstr3b.input_tax_credit.sgst)} />
              <SummaryCard label="IGST ITC" value={fmt(gstr3b.input_tax_credit.igst)} />
              <SummaryCard label="Total ITC" value={fmt(gstr3b.input_tax_credit.total_itc)} sub="Input credit" />
            </div>
          </div>

          {/* Net Liability */}
          <div className="card p-5 border-l-4 border-blue-500">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">6.1 Net Tax Payable</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="CGST Payable" value={fmt(gstr3b.net_tax_liability.cgst)} />
              <SummaryCard label="SGST Payable" value={fmt(gstr3b.net_tax_liability.sgst)} />
              <SummaryCard label="IGST Payable" value={fmt(gstr3b.net_tax_liability.igst)} />
              <SummaryCard label="Total Payable" value={fmt(gstr3b.net_tax_liability.total)} sub="After ITC" />
            </div>
          </div>
        </div>
      )}

      {/* GSTR-1 */}
      {submitted && !isLoading && reportType === 'gstr1' && gstr1 && (
        <div className="space-y-4">
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Invoices" value={String(gstr1.totals.invoice_count)} />
            <SummaryCard label="Taxable Amount" value={fmt(gstr1.totals.taxable_amount)} />
            <SummaryCard label="Total GST" value={fmt(gstr1.totals.cgst + gstr1.totals.sgst + gstr1.totals.igst)} />
            <SummaryCard label="Invoice Value" value={fmt(gstr1.totals.invoice_value)} />
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 bg-slate-700 text-white text-sm font-medium flex justify-between items-center">
              <span>B2B Invoices — {gstr1.period.from} to {gstr1.period.to}</span>
              <button
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition"
                onClick={() => downloadCSV(gstr1.invoices, `GSTR1_${dateFrom}_${dateTo}.csv`)}
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Invoice #</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Party GSTIN</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Place of Supply</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Taxable</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">CGST</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">SGST</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">IGST</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gstr1.invoices.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-gray-400">No sales vouchers with GST in this period</td></tr>
                  )}
                  {gstr1.invoices.map((inv: any) => (
                    <tr key={inv.voucher_number} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{inv.voucher_number}</td>
                      <td className="px-4 py-2 text-slate-600">{inv.voucher_date}</td>
                      <td className="px-4 py-2 font-mono text-xs">{inv.party_gstin || '—'}</td>
                      <td className="px-4 py-2">{inv.place_of_supply || '—'}</td>
                      <td className="px-4 py-2 text-right">{fmt(inv.taxable_amount)}</td>
                      <td className="px-4 py-2 text-right text-blue-600">{fmt(inv.cgst)}</td>
                      <td className="px-4 py-2 text-right text-blue-600">{fmt(inv.sgst)}</td>
                      <td className="px-4 py-2 text-right text-amber-600">{fmt(inv.igst)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmt(inv.invoice_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {submitted && !isLoading && !gstr3b && !gstr1 && (
        <div className="text-center py-12 text-gray-400">No data for the selected period</div>
      )}
    </div>
  );
}
