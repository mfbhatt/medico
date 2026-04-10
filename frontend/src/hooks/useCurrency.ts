import { useAppSelector } from '@/store/hooks';
import { formatCurrency } from '@/utils/formatters';

/**
 * Returns a formatter function that formats a number as currency
 * using the tenant's configured currency (from Redux state).
 *
 * Usage:
 *   const fmt = useCurrency();
 *   fmt(1500)  // → "₹1,500.00" when INR is configured
 */
export function useCurrency(): (amount: number) => string {
  const currency = useAppSelector((s) => s.tenant.currency) ?? 'USD';
  return (amount: number) => formatCurrency(amount, currency);
}
