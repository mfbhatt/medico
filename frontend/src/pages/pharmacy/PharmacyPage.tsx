import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { useAppSelector } from '@/store/hooks';
import type { Tab, Drug } from './types';
import { OverviewPanel } from './tabs/OverviewPanel';
import { POSPanel } from './tabs/POSPanel';
import { InventoryTab } from './tabs/InventoryTab';
import { PurchaseOrdersTab } from './tabs/PurchaseOrdersTab';
import { SalesTab } from './tabs/SalesTab';
import { ReportsTab } from './tabs/ReportsTab';
import { ExpiryTab } from './tabs/ExpiryTab';
import { AlertsTab } from './tabs/AlertsTab';
import { SuppliersTab } from './tabs/SuppliersTab';

export default function PharmacyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedClinicId, setSelectedClinicId] = useState('');

  const userClinicId = useAppSelector((s) => (s.auth.user as any)?.clinic_id as string | undefined);
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdminRole = role === 'super_admin' || role === 'tenant_admin' || role === 'clinic_admin';

  const { data: clinicsData } = useQuery({
    queryKey: ['clinics-list'],
    queryFn: () => api.get('/clinics/', { params: { limit: 50 } }).then((r) => r.data.data),
  });
  const clinics: { id: string; name: string }[] = Array.isArray(clinicsData)
    ? clinicsData
    : (clinicsData?.clinics ?? []);

  const effectiveClinicId = isAdminRole
    ? (selectedClinicId || clinics[0]?.id || '')
    : (userClinicId || clinics[0]?.id || '');
  const effectiveClinicName = clinics.find((c) => c.id === effectiveClinicId)?.name ?? 'Pharmacy';

  const setTabFromQuery = useCallback((newTab: Tab) => {
    setTab(newTab);
    navigate(`/pharmacy?tab=${newTab}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');
    if (requestedTab && ['overview', 'pos', 'inventory', 'orders', 'sales', 'reports', 'expiry', 'alerts', 'suppliers'].includes(requestedTab)) {
      setTab(requestedTab as Tab);
    }
  }, [location.search]);

  const { data: drugsData } = useQuery({
    queryKey: ['pharmacy-drugs-all', effectiveClinicId],
    queryFn: () =>
      api.get('/inventory/drugs', { params: { page_size: 200, ...(effectiveClinicId ? { clinic_id: effectiveClinicId } : {}) } })
        .then((r) => r.data.data ?? []),
    enabled: !!effectiveClinicId,
  });
  const allDrugs: Drug[] = drugsData ?? [];

  const { data: alertsData } = useQuery({
    queryKey: ['pharmacy-alerts-count', effectiveClinicId],
    queryFn: () =>
      api.get('/inventory/stock-alerts', { params: effectiveClinicId ? { clinic_id: effectiveClinicId } : {} })
        .then((r) => r.data.data ?? []),
    enabled: !!effectiveClinicId,
    refetchInterval: 300_000,
  });
  const alertsMap: Record<string, any> = Object.fromEntries(
    (alertsData ?? []).map((a: any) => [a.drug_id, a])
  );

  return (
    <div className="flex flex-col h-full">
      <div className="page-header flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <h1 className="page-title">Pharmacy</h1>
        {isAdminRole && clinics.length > 1 && (
          <select
            className="input w-52"
            value={effectiveClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {tab === 'overview' && <OverviewPanel clinicId={effectiveClinicId} onNavigate={setTabFromQuery} />}
      {tab === 'pos' && <POSPanel clinicId={effectiveClinicId} clinicName={effectiveClinicName} />}
      {tab === 'inventory' && <InventoryTab clinics={clinics} clinicId={effectiveClinicId} alertsMap={alertsMap} />}
      {tab === 'orders' && <PurchaseOrdersTab clinics={clinics} clinicId={effectiveClinicId} drugs={allDrugs} />}
      {tab === 'sales' && <SalesTab clinicId={effectiveClinicId} clinicName={effectiveClinicName} />}
      {tab === 'reports' && <ReportsTab clinicId={effectiveClinicId} />}
      {tab === 'expiry' && <ExpiryTab clinicId={effectiveClinicId} />}
      {tab === 'alerts' && <AlertsTab clinicId={effectiveClinicId} />}
      {tab === 'suppliers' && <SuppliersTab />}
    </div>
  );
}
