import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '@/services/api';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { Drug } from '../types';
import { AddStockModal } from '../modals/AddStockModal';

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

export function AlertsTab({ clinicId }: { clinicId: string }) {
  const [stockDrug, setStockDrug] = useState<Drug | null>(null);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['pharmacy-alerts', clinicId],
    queryFn: () => api.get('/inventory/stock-alerts', { params: clinicId ? { clinic_id: clinicId } : {} }).then((r) => r.data.data ?? []),
    enabled: !!clinicId,
    refetchInterval: 300_000,
  });

  const openAddStock = (alert: any) => {
    setStockDrug({
      id: alert.drug_id,
      name: alert.drug_name,
      generic_name: alert.generic_name ?? '',
      brand_name: alert.brand_name ?? '',
      form: alert.form,
      strength: alert.strength,
      unit: alert.unit ?? '',
      category: alert.category ?? '',
      selling_price: alert.selling_price ?? 0,
      unit_cost: alert.unit_cost ?? 0,
      requires_prescription: false,
      is_controlled: false,
      total_stock: alert.current_stock,
      reorder_level: alert.reorder_level,
      is_low_stock: true,
      is_active: true,
      clinic_id: alert.clinic_id ?? '',
    });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
      {isLoading ? (
        <div className="py-12 flex justify-center"><LoadingSpinner size="sm" label="Checking alerts…" /></div>
      ) : !alerts?.length ? (
        <div className="card p-12 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No stock alerts</p>
          <p className="text-sm text-gray-400 mt-1">All drugs are within acceptable stock levels</p>
        </div>
      ) : (
        alerts.map((alert: any) => (
          <div
            key={alert.drug_id}
            className={`card p-4 border-l-4 ${
              alert.expired_qty > 0 ? 'border-red-500 bg-red-50' :
              alert.expiring_soon_qty > 0 ? 'border-amber-500 bg-amber-50' :
              'border-blue-500 bg-blue-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{alert.drug_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{alert.form} · {alert.strength}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Stock: <strong>{alert.current_stock}</strong> (reorder at {alert.reorder_level})
                  {alert.expiring_soon_qty > 0 && <> · <span className="text-amber-700">{alert.expiring_soon_qty} units expiring soon</span></>}
                  {alert.expired_qty > 0 && <> · <span className="text-red-700">{alert.expired_qty} units expired</span></>}
                </p>
                {alert.expiring_batches?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {alert.expiring_batches.map((b: any) => (
                      <span key={b.batch_number} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        Batch {b.batch_number}: {b.qty} units · expires {b.expiry_date}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0 ml-4">
                {alert.expired_qty > 0 && <span className="badge-red flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Expired Stock</span>}
                {alert.expiring_soon_qty > 0 && <span className="badge-yellow flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Expiring Soon</span>}
                {alert.is_low_stock && (
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="badge-blue flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Low Stock</span>
                    <button
                      onClick={() => openAddStock(alert)}
                      className="flex items-center gap-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Stock
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      )}
      {stockDrug && <AddStockModal drug={stockDrug} onClose={() => setStockDrug(null)} />}
    </div>
  );
}
