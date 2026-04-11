import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

function Section({
  title,
  items,
  total,
  colorClass,
}: {
  title: string;
  items: { name: string; amount: number }[];
  total: number;
  colorClass: string;
}) {
  const fmt = (n: number) =>
    `${n < 0 ? '(' : ''}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}${n < 0 ? ')' : ''}`;

  return (
    <div className="mb-6">
      <div className="bg-slate-700 text-white px-5 py-2.5 text-sm font-semibold rounded-t-lg">{title}</div>
      <div className="border border-gray-200 rounded-b-lg overflow-hidden">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between px-5 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 last:border-0">
            <span className="text-gray-700">{item.name}</span>
            <span className={`font-medium ${item.amount < 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {fmt(item.amount)}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <div className="px-5 py-3 text-sm text-gray-400">No activity in this period</div>
        )}
        <div className={`flex justify-between px-5 py-3 font-bold text-sm border-t-2 border-gray-200 ${colorClass}`}>
          <span>Net Cash from {title.split(' ').slice(0, 2).join(' ')}</span>
          <span>{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function CashFlowPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const [dateFrom, setDateFrom] = useState(firstOfYear);
  const [dateTo, setDateTo] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['accounting', 'cash-flow', dateFrom, dateTo],
    queryFn: () =>
      api.get('/accounting/reports/cash-flow', { params: { date_from: dateFrom, date_to: dateTo } }).then(r => r.data.data),
  });

  const fmt = (n?: number) =>
    n != null
      ? `${n < 0 ? '(' : ''}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}${n < 0 ? ')' : ''}`
      : '—';

  const op = data?.operating_activities;
  const inv = data?.investing_activities;
  const fin = data?.financing_activities;
  const netCF = data?.net_change_in_cash ?? 0;

  const opItems = op
    ? [
        { name: 'Net Profit / (Loss)', amount: op.net_profit },
        ...(op.working_capital_adjustments ?? []),
      ]
    : [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header mb-6">
        <h1 className="page-title">Cash Flow Statement</h1>
        <div className="flex gap-2 items-end">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="print:hidden btn-secondary mt-5" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">Indirect method — Net Profit adjusted for working capital changes</p>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <>
          <Section
            title="Operating Activities"
            items={opItems}
            total={op?.total ?? 0}
            colorClass="bg-blue-50 text-blue-700"
          />
          <Section
            title="Investing Activities"
            items={inv?.items ?? []}
            total={inv?.total ?? 0}
            colorClass="bg-purple-50 text-purple-700"
          />
          <Section
            title="Financing Activities"
            items={fin?.items ?? []}
            total={fin?.total ?? 0}
            colorClass="bg-teal-50 text-teal-700"
          />

          {/* Net change */}
          <div className={`rounded-xl p-5 border-2 ${netCF >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            <div className="flex justify-between items-center">
              <span className={`text-base font-bold ${netCF >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                Net Increase / (Decrease) in Cash
              </span>
              <span className={`text-xl font-bold ${netCF >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(netCF)}
              </span>
            </div>
            <p className="text-xs mt-1 text-gray-500">
              Period: {dateFrom} to {dateTo}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
