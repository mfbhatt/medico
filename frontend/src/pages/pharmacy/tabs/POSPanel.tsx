import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  ShoppingCart, Package, Plus, X, Printer, Search, CheckCircle,
  Minus, Trash2, AlertCircle, RefreshCw, FileText, ShieldAlert, AlertTriangle,
} from 'lucide-react';
import api from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrency } from '@/hooks/useCurrency';
import type { CartItem, Drug } from '../types';
import { SigSelector } from '../components/SigSelector';
import { CartBatchRow } from '../components/CartBatchRow';
import { PAYMENT_METHODS, FORM_COLOR } from '../constants';
import { printReceipt } from '../utils/printReceipt';

// ─── POS Panel ────────────────────────────────────────────────────────────────

export function POSPanel({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const fmt = useCurrency();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const debouncedPatientSearch = useDebounce(patientSearch, 350);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientRef = useRef<HTMLDivElement>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [error, setError] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState<{ id: string; rx_number: string; doctor_name?: string } | null>(null);
  const [isPartialDispense, setIsPartialDispense] = useState(false);

  const { data: drugsData, isLoading, isFetching, isError: drugsError, error: drugsErrorObj } = useQuery({
    queryKey: ['pharmacy-pos-drugs', debouncedSearch, clinicId],
    queryFn: () =>
      api.get('/inventory/drugs', { params: { q: debouncedSearch || undefined, page_size: 50, ...(clinicId ? { clinic_id: clinicId } : {}) } })
        .then((r) => r.data.data ?? []),
    enabled: !!clinicId,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const drugs: Drug[] = drugsData ?? [];
  const posErrorMsg = drugsError ? ((drugsErrorObj as any)?.response?.data?.detail ?? (drugsErrorObj as any)?.message ?? 'Failed to load drugs') : null;

  const { data: patientSearchData, isFetching: searchingPatients } = useQuery({
    queryKey: ['pharmacy-patient-search', debouncedPatientSearch],
    queryFn: () =>
      api.get('/patients/', { params: { q: debouncedPatientSearch, page_size: 10 } })
        .then((r) => {
          const raw = r.data.data;
          return Array.isArray(raw) ? raw : raw?.patients ?? [];
        }),
    enabled: debouncedPatientSearch.trim().length >= 2 && !selectedPatient,
    staleTime: 30_000,
  });
  const patientList: any[] = patientSearchData ?? [];

  const { data: patientDetail } = useQuery({
    queryKey: ['patient-detail-pharmacy', selectedPatient?.id],
    queryFn: () => api.get(`/patients/${selectedPatient!.id}`).then((r) => r.data.data),
    enabled: !!selectedPatient?.id,
    staleTime: 300_000,
  });
  const patientAllergies = useMemo<string[]>(() => {
    if (!patientDetail) return [];
    const raw = patientDetail.allergies ?? patientDetail.medical_history?.allergies ?? [];
    return raw.map((a: any) => (typeof a === 'string' ? a : (a.allergen ?? a.name ?? '')).toLowerCase()).filter(Boolean);
  }, [patientDetail]);

  const { data: prescriptionsData } = useQuery({
    queryKey: ['patient-prescriptions', selectedPatient?.id],
    queryFn: () =>
      api.get('/prescriptions/', { params: { patient_id: selectedPatient!.id, status: 'active', page_size: 20 } })
        .then((r) => r.data.data ?? []),
    enabled: !!selectedPatient?.id,
    staleTime: 60_000,
  });
  const prescriptions: any[] = prescriptionsData ?? [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const addToCart = useCallback((drug: Drug) => {
    if (drug.total_stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.drug_id === drug.id);
      if (existing) {
        if (existing.quantity >= drug.total_stock) return prev;
        return prev.map((i) =>
          i.drug_id === drug.id
            ? { ...i, quantity: i.quantity + 1, line_total: (i.quantity + 1) * i.unit_price * (1 - i.discount_percent / 100) }
            : i,
        );
      }
      return [
        ...prev,
        {
          drug_id: drug.id,
          drug_name: `${drug.name} ${drug.strength}`,
          form: drug.form,
          strength: drug.strength,
          quantity: 1,
          unit_price: drug.selling_price,
          discount_percent: 0,
          line_total: drug.selling_price,
          available_stock: drug.total_stock,
          sig: '',
          requires_prescription: drug.requires_prescription,
          is_controlled: drug.is_controlled,
          generic_name: drug.generic_name,
        },
      ];
    });
  }, []);

  const updateCartQty = (drug_id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.drug_id !== drug_id) return i;
          const newQty = Math.max(0, Math.min(i.quantity + delta, i.available_stock));
          if (newQty === 0) return null as any;
          return { ...i, quantity: newQty, line_total: newQty * i.unit_price * (1 - i.discount_percent / 100) };
        })
        .filter(Boolean),
    );
  };

  const updateCartDiscount = (drug_id: string, pct: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.drug_id !== drug_id ? i : { ...i, discount_percent: pct, line_total: i.quantity * i.unit_price * (1 - pct / 100) },
      ),
    );
  };

  const removeFromCart = (drug_id: string) => setCart((prev) => prev.filter((i) => i.drug_id !== drug_id));

  const updateCartSig = useCallback((drug_id: string, sig: string) => {
    setCart((prev) => prev.map((i) => (i.drug_id !== drug_id ? i : { ...i, sig })));
  }, []);

  const updateCartBatch = useCallback((drug_id: string, batch_id: string, batch_number: string, batch_expiry: string) => {
    setCart((prev) => prev.map((i) => (i.drug_id !== drug_id ? i : { ...i, batch_id, batch_number, batch_expiry })));
  }, []);

  const allergyWarnings = useMemo(
    () =>
      cart.filter((item) => {
        if (!patientAllergies.length) return false;
        const drugText = `${item.drug_name} ${item.generic_name ?? ''}`.toLowerCase();
        return patientAllergies.some((a) => a.length > 2 && drugText.includes(a));
      }),
    [cart, patientAllergies],
  );

  const subtotal = cart.reduce((s, i) => s + i.line_total, 0);
  const discPct = Math.min(100, Math.max(0, parseFloat(discountAmount) || 0));
  const disc = subtotal * discPct / 100;
  const tax = parseFloat(taxAmount) || 0;
  const total = Math.max(0, subtotal - disc + tax);
  const paid = parseFloat(paidAmount) || total;
  const change = paymentMethod === 'cash' ? Math.max(0, paid - total) : 0;

  const saleMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/sales', data),
    onSuccess: (res) => {
      setCompletedSale(res.data.data);
      setCart([]);
      setSelectedPatient(null);
      setPatientSearch('');
      setShowPatientDropdown(false);
      setSelectedPrescription(null);
      setIsPartialDispense(false);
      setDiscountAmount('');
      setTaxAmount('');
      setPaidAmount('');
      setNotes('');
      setError('');
      qc.invalidateQueries({ queryKey: ['pharmacy-drugs'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-pos-drugs'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-sales'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-analytics'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-alerts'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-alerts-count'] });
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Sale failed'),
  });

  const processSale = () => {
    if (!cart.length) return;
    if (paymentMethod === 'cash' && paid < total) {
      setError('Cash paid is less than total amount');
      return;
    }
    const rxUnlinked = cart.filter((i) => i.requires_prescription && !selectedPrescription);
    if (rxUnlinked.length) {
      const names = rxUnlinked.map((i) => i.drug_name).join(', ');
      if (!window.confirm(`${names} require(s) a prescription. Proceed without linking one?`)) return;
    }
    setError('');
    saleMutation.mutate({
      clinic_id: clinicId,
      items: cart.map((i) => ({
        drug_item_id: i.drug_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount_percent: i.discount_percent,
        sig_instructions: i.sig || undefined,
        batch_id: i.batch_id || undefined,
      })),
      patient_id: selectedPatient?.id || (patientSearch.trim() ? patientSearch.trim() : undefined),
      patient_name: selectedPatient?.name || undefined,
      prescription_id: selectedPrescription?.id || undefined,
      prescription_number: selectedPrescription?.rx_number || undefined,
      payment_method: paymentMethod,
      paid_amount: paymentMethod === 'cash' ? paid : total,
      discount_percent: discPct || undefined,
      discount_amount: disc,
      tax_amount: tax,
      notes: notes || undefined,
      is_partial: isPartialDispense || undefined,
    });
  };

  return (
    <div className="flex flex-1 min-h-0 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">

      {/* ── LEFT: Drug catalog ─────────────────────────────────────────── */}
      <div className="flex flex-col w-[55%] border-r border-gray-100">

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              className="input pl-9 pr-9 bg-white"
              placeholder="Search drugs by name, generic or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {isFetching && !isLoading && (
              <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 px-0.5">
            {drugs.length > 0 ? `${drugs.length} drug${drugs.length !== 1 ? 's' : ''} available` : ''}
          </p>
        </div>

        {/* Drug list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
              <p className="text-sm text-gray-400">Loading drugs…</p>
            </div>
          ) : posErrorMsg ? (
            <div className="flex flex-col items-center gap-2 py-16 text-red-500">
              <AlertCircle className="w-8 h-8 opacity-60" />
              <span className="text-sm font-medium px-4 text-center">{posErrorMsg}</span>
            </div>
          ) : drugs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-4 py-16">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Package className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">No drugs found</p>
              <p className="text-xs text-gray-300 text-center">Add drugs in the Inventory tab first</p>
            </div>
          ) : (
            drugs.map((drug) => {
              const inCart = cart.find((c) => c.drug_id === drug.id);
              const isOut = drug.total_stock === 0;
              const formColor = FORM_COLOR[drug.form?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
              return (
                <button
                  key={drug.id}
                  onClick={() => addToCart(drug)}
                  disabled={isOut}
                  className={`group w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    isOut
                      ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-100'
                      : inCart
                      ? 'bg-primary-50 border-primary-200 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-primary-200 hover:bg-primary-50/40 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md capitalize ${formColor}`}>
                          {drug.form}
                        </span>
                        {drug.requires_prescription && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">
                            <FileText className="w-2.5 h-2.5" /> Rx
                          </span>
                        )}
                        {drug.is_controlled && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md">
                            <ShieldAlert className="w-2.5 h-2.5" /> CD
                          </span>
                        )}
                      </div>
                      <p className={`font-semibold text-sm leading-snug ${inCart ? 'text-primary-900' : 'text-gray-900'}`}>
                        {drug.name}{' '}
                        <span className="font-normal text-gray-400 text-xs">{drug.strength}{drug.unit}</span>
                      </p>
                      {drug.generic_name && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{drug.generic_name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className={`font-bold text-sm ${inCart ? 'text-primary-700' : 'text-gray-900'}`}>
                        {fmt(drug.selling_price)}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isOut ? 'bg-red-400' : drug.is_low_stock ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <p className={`text-[11px] ${isOut ? 'text-red-500' : drug.is_low_stock ? 'text-amber-600' : 'text-gray-400'}`}>
                          {drug.total_stock} left
                        </p>
                      </div>
                      {inCart && (
                        <span className="text-[11px] font-bold bg-primary-600 text-white px-2 py-0.5 rounded-full">
                          ✓ {inCart.quantity} in cart
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart ────────────────────────────────────────────────── */}
      <div className="w-[45%] flex flex-col bg-white">

        {/* Cart header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 leading-tight">Cart</h3>
              <p className="text-[11px] text-gray-400">{cart.length === 0 ? 'Empty' : `${cart.length} item${cart.length !== 1 ? 's' : ''}`}</p>
            </div>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium">
              Clear
            </button>
          )}
        </div>

        {/* Alerts */}
        {(allergyWarnings.length > 0 || cart.length >= 2) && (
          <div className="px-4 pt-3 space-y-1.5">
            {allergyWarnings.length > 0 && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-800">
                <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
                <span><strong>Allergy alert:</strong> {allergyWarnings.map((i) => i.drug_name).join(', ')} may conflict.</span>
              </div>
            )}
            {cart.length >= 2 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>Multiple drugs — verify interactions before dispensing.</span>
              </div>
            )}
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
                <ShoppingCart className="w-7 h-7 text-gray-200" />
              </div>
              <p className="text-sm font-medium text-gray-400">Cart is empty</p>
              <p className="text-xs text-gray-300">Click a drug on the left to add it</p>
            </div>
          ) : (
            cart.map((item) => {
              const hasAllergyWarn = allergyWarnings.some((w) => w.drug_id === item.drug_id);
              return (
                <div
                  key={item.drug_id}
                  className={`rounded-xl border p-3 space-y-2 ${hasAllergyWarn ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}
                >
                  {/* Name row */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className={`font-semibold text-sm truncate ${hasAllergyWarn ? 'text-red-700' : 'text-gray-900'}`}>{item.drug_name}</p>
                        {item.requires_prescription && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1 py-0.5 rounded">Rx</span>}
                        {item.is_controlled && <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1 py-0.5 rounded">CD</span>}
                        {hasAllergyWarn && <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{fmt(item.unit_price)} × {item.quantity} = <span className="font-semibold text-gray-700">{fmt(item.line_total)}</span></p>
                    </div>
                    <button onClick={() => removeFromCart(item.drug_id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Controls row */}
                  <div className="flex items-center gap-2">
                    {/* Qty stepper */}
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shrink-0">
                      <button onClick={() => updateCartQty(item.drug_id, -1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.drug_id, 1)}
                        disabled={item.quantity >= item.available_stock}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-30">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Discount */}
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="text-[10px] text-gray-400 shrink-0">Disc%</span>
                      <input
                        type="number" min={0} max={100} step={0.5}
                        value={item.discount_percent}
                        onChange={(e) => updateCartDiscount(item.drug_id, parseFloat(e.target.value) || 0)}
                        className="w-14 text-center text-xs border border-gray-200 rounded-lg py-1 bg-white focus:outline-none focus:border-primary-400"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {/* Sig + Batch */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <SigSelector form={item.form} value={item.sig} onChange={(sig) => updateCartSig(item.drug_id, sig)} />
                    <div className="flex items-center gap-1 shrink-0 max-w-[140px]">
                      <span className="text-[10px] text-gray-300 shrink-0">Batch</span>
                      <CartBatchRow item={item} clinicId={clinicId} onBatchChange={updateCartBatch} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Checkout footer ─────────────────────────────────────────── */}
        <div className="border-t border-gray-100 px-4 py-2.5 space-y-2 bg-gray-50/40">

          {/* Patient search */}
          <div className="relative" ref={patientRef}>
            {selectedPatient ? (
              <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary-700">{selectedPatient.name[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary-900 truncate">{selectedPatient.name}</p>
                  <p className="text-[10px] text-primary-500">Patient ID: {selectedPatient.id.slice(0, 8)}…</p>
                </div>
                <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }}
                  className="text-primary-300 hover:text-red-500 transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  className="input pl-9 text-sm py-2"
                  placeholder="Search patient (optional — walk-in if blank)"
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                  onFocus={() => { if (patientSearch.length >= 2) setShowPatientDropdown(true); }}
                />
                {searchingPatients && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
                {showPatientDropdown && patientSearch.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 bottom-full mb-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-44 overflow-y-auto">
                    {searchingPatients ? (
                      <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                    ) : patientList.length > 0 ? (
                      patientList.map((p: any) => (
                        <button key={p.id} type="button"
                          onMouseDown={() => {
                            setSelectedPatient({ id: p.id, name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() });
                            setPatientSearch(''); setShowPatientDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-primary-50 border-b border-gray-50 last:border-0 transition-colors">
                          <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                          <p className="text-xs text-gray-400">{p.patient_id || p.id?.slice(0, 8)}</p>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-400 italic">No patient found — will be saved as walk-in</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Prescription */}
          {selectedPatient && prescriptions.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
              <FileText className="w-3 h-3 text-blue-500 shrink-0" />
              <select className="flex-1 text-xs bg-transparent border-0 text-blue-900 focus:outline-none"
                value={selectedPrescription?.id ?? ''}
                onChange={(e) => {
                  const rx = prescriptions.find((p: any) => p.id === e.target.value);
                  setSelectedPrescription(rx ? { id: rx.id, rx_number: rx.prescription_number ?? rx.id.slice(0, 8), doctor_name: rx.doctor_name } : null);
                }}>
                <option value="">— No linked prescription —</option>
                {prescriptions.map((rx: any) => (
                  <option key={rx.id} value={rx.id}>
                    Rx #{rx.prescription_number ?? rx.id.slice(0, 8)}{rx.doctor_name ? ` · Dr. ${rx.doctor_name}` : ''} · {new Date(rx.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Totals — discount & tax inline with subtotal row */}
          <div className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400 shrink-0">Subtotal</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px] text-gray-300">Disc%</span>
                <input type="number" min={0} max={100} step={0.5} placeholder="0"
                  value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-10 text-[11px] text-center border border-gray-200 rounded-md py-0.5 focus:outline-none focus:border-primary-400 bg-white" />
                <span className="text-[10px] text-gray-300">Tax</span>
                <input type="number" min={0} step={0.01} placeholder="0"
                  value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)}
                  className="w-12 text-[11px] text-center border border-gray-200 rounded-md py-0.5 focus:outline-none focus:border-primary-400 bg-white" />
                <span className="text-xs text-gray-500 w-14 text-right">{fmt(subtotal)}</span>
              </div>
            </div>
            {discPct > 0 && <div className="flex justify-between text-xs text-emerald-600"><span>Discount ({discPct}%)</span><span>−{fmt(disc)}</span></div>}
            {tax > 0 && <div className="flex justify-between text-xs text-gray-400"><span>Tax</span><span>{fmt(tax)}</span></div>}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-100">
              <span className="font-bold text-gray-800 text-sm">Total</span>
              <span className="font-bold text-xl text-gray-900">{fmt(total)}</span>
            </div>
          </div>

          {/* Payment method + cash paid on same row */}
          <div className="flex items-center gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  paymentMethod === m.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-200 text-gray-500 bg-white hover:border-primary-300 hover:text-primary-600'
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div className="flex items-center gap-2">
              <input className="input text-sm py-1.5 flex-1" type="number" min={total} step={0.01}
                placeholder={`Cash paid (${total.toFixed(2)})`}
                value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              {change > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-gray-400">Change</p>
                  <p className="text-base font-bold text-emerald-600">{fmt(change)}</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg">
              <AlertCircle className="w-3 h-3 shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none flex-1">
              <input type="checkbox" checked={isPartialDispense} onChange={(e) => setIsPartialDispense(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-xs text-gray-400">Partial dispense</span>
            </label>
          </div>

          <button
            onClick={processSale}
            disabled={cart.length === 0 || saleMutation.isPending}
            className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
              bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {saleMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
            ) : (
              <><CheckCircle className="w-5 h-5" />{isPartialDispense ? 'Partial Dispense' : 'Process Sale'} · {fmt(total)}</>
            )}
          </button>
        </div>
      </div>

      {/* ── Sale success modal ────────────────────────────────────────── */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Green header */}
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 px-6 pt-8 pb-6 text-center relative">
              <button onClick={() => setCompletedSale(null)}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-9 h-9 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Sale Complete!</h2>
              <p className="text-emerald-100 text-sm mt-1">Receipt #{completedSale.sale_number}</p>
            </div>

            {/* Sale details */}
            <div className="p-5 space-y-2 text-sm">
              {[
                { label: 'Total', value: fmt(completedSale.total_amount), bold: true },
                { label: 'Paid', value: fmt(completedSale.paid_amount) },
                ...(completedSale.change_amount > 0 ? [{ label: 'Change', value: fmt(completedSale.change_amount), green: true }] : []),
                { label: 'Payment Method', value: completedSale.payment_method, capitalize: true },
                ...(completedSale.patient_name ? [{ label: 'Patient', value: completedSale.patient_name }] : []),
              ].map((row: any) => (
                <div key={row.label} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={`${row.bold ? 'font-bold text-gray-900' : ''} ${row.green ? 'font-semibold text-emerald-600' : ''} ${row.capitalize ? 'capitalize' : ''}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => printReceipt(completedSale, clinicName)}
                className="flex-1 btn-secondary flex items-center justify-center gap-2 py-2.5">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button onClick={() => setCompletedSale(null)} className="flex-1 btn-primary py-2.5 font-semibold">
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
