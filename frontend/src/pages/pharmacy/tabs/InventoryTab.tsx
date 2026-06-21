import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, Plus, ChevronLeft, ChevronRight, AlertCircle, AlertTriangle } from 'lucide-react';
import api from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrency } from '@/hooks/useCurrency';
import SkeletonTable from '@/components/common/SkeletonTable';
import type { Drug } from '../types';
import { AddDrugModal } from '../modals/AddDrugModal';
import { AddStockModal } from '../modals/AddStockModal';
import { AdjustmentModal } from '../modals/AdjustmentModal';

// ─── Inventory Tab ────────────────────────────────────────────────────────────

export function InventoryTab({ clinics, clinicId, alertsMap }: { clinics: { id: string; name: string }[]; clinicId: string; alertsMap: Record<string, any> }) {
  const fmt = useCurrency();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [addDrugOpen, setAddDrugOpen] = useState(false);
  const [stockDrug, setStockDrug] = useState<Drug | null>(null);
  const [adjustDrug, setAdjustDrug] = useState<Drug | null>(null);
  const limit = 25;
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pharmacy-drugs', debouncedSearch, page, clinicId],
    queryFn: () =>
      api.get('/inventory/drugs', { params: { q: debouncedSearch || undefined, page: page + 1, page_size: limit, ...(clinicId ? { clinic_id: clinicId } : {}) } })
        .then((r) => r.data),
    enabled: !!clinicId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const drugs: Drug[] = data?.data ?? [];
  const meta = data?.meta ?? {};
  const errorMsg = isError ? ((error as any)?.response?.data?.detail ?? (error as any)?.message ?? 'Failed to load inventory') : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search drugs…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <button onClick={() => setAddDrugOpen(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Drug
        </button>
      </div>

      <div className="card flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Drug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Form / Strength</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Unit Cost</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Selling</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <SkeletonTable rows={8} columns={8} />
            ) : errorMsg ? (
              <tr><td colSpan={8} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-red-600">
                  <AlertCircle className="w-6 h-6" />
                  <span className="text-sm font-medium">{errorMsg}</span>
                </div>
              </td></tr>
            ) : drugs.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No drugs found. Use "Add Drug" to add your first drug.</td></tr>
            ) : (
              drugs.map((drug) => {
                const isOut = drug.total_stock === 0;
                const isLow = !isOut && drug.is_low_stock;
                return (
                  <tr key={drug.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{drug.name}</p>
                      <p className="text-xs text-gray-400">{drug.generic_name}</p>
                      {drug.is_controlled && <span className="text-xs text-purple-600 font-medium">Controlled</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{drug.form} · {drug.strength}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize text-xs">{drug.category}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(drug.unit_cost)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(drug.selling_price)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                      {drug.total_stock}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {isOut ? <span className="badge-red">Out of Stock</span> : isLow ? <span className="badge-yellow">Low Stock</span> : <span className="badge-green">In Stock</span>}
                        {alertsMap[drug.id]?.expired_qty > 0 && (
                          <span className="badge-red text-xs flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" /> {alertsMap[drug.id].expired_qty} expired
                          </span>
                        )}
                        {alertsMap[drug.id]?.expiring_soon_qty > 0 && (
                          <span className="badge-yellow text-xs flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" /> {alertsMap[drug.id].expiring_soon_qty} expiring
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => setStockDrug(drug)} className="text-xs text-primary-600 hover:text-primary-800 font-medium">Add Stock</button>
                        <button onClick={() => setAdjustDrug(drug)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Adjust</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>

        {(meta.total ?? 0) > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>Showing {page * limit + 1}–{Math.min((page + 1) * limit, meta.total)} of {meta.total}</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1 px-3 flex items-center gap-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button className="btn-secondary py-1 px-3 flex items-center gap-1" disabled={(page + 1) * limit >= meta.total} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {addDrugOpen && <AddDrugModal onClose={() => setAddDrugOpen(false)} clinics={clinics} defaultClinicId={clinicId} />}
      {stockDrug && <AddStockModal drug={stockDrug} onClose={() => setStockDrug(null)} />}
      {adjustDrug && <AdjustmentModal drug={adjustDrug} onClose={() => setAdjustDrug(null)} />}
    </div>
  );
}
