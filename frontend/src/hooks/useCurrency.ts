import { useAppSelector } from '@/store/hooks';
import { formatCurrency } from '@/utils/formatters';

export function useCurrency(): (amount: number) => string {
  const currency = useAppSelector((s) => s.tenant.currency) ?? 'USD';
  return (amount: number) => formatCurrency(amount, currency);
}

export function useCurrencySymbol(): string {
  const currency = useAppSelector((s) => s.tenant.currency) ?? 'USD';
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 0 })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
  );
}
