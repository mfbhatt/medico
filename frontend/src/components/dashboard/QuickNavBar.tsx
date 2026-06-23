import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Zap } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { RootState } from '@/store';
import { getModulesForUser, type AppModule } from '@/modules/registry';

const MAX_SHOWN = 6;

function readCounts(userId: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(`quicknav_${userId}`) ?? '{}');
  } catch {
    return {};
  }
}

interface QuickNavButtonProps {
  mod: AppModule;
  count: number;
  weight: number;
  isTop: boolean;
  onClick: () => void;
}

function QuickNavButton({ mod, count, weight, isTop, onClick }: QuickNavButtonProps) {
  const Icon = mod.icon;
  return (
    <button
      onClick={onClick}
      className={`relative group flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md text-center ${
        isTop
          ? 'border-primary-200 bg-primary-50 hover:border-primary-300'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600'
      }`}
    >
      {isTop && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wide bg-primary-500 text-white px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
          Top
        </span>
      )}

      <div
        className={`w-9 h-9 rounded-lg bg-gradient-to-br ${mod.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>

      <span className="text-xs font-medium text-gray-700 dark:text-slate-300 leading-tight group-hover:text-gray-900 dark:group-hover:text-white">
        {mod.name}
      </span>

      {/* Relative-usage weight bar — only shown once there's usage history */}
      <div className="w-full h-0.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${mod.gradient} transition-all duration-500`}
          style={{ width: count > 0 ? `${Math.max(12, weight * 100)}%` : '0%' }}
        />
      </div>
    </button>
  );
}

export default function QuickNavBar() {
  const { user } = useAppSelector((s) => s.auth);
  const { features: tenantFeatures, userFeatures } = useSelector((s: RootState) => s.tenant);
  const navigate = useNavigate();

  const userId = user?.id ?? '';
  const role: string = user?.role ?? '';

  // Read fresh from localStorage on every mount (i.e. every visit to the home page)
  const [counts] = useState<Record<string, number>>(() => readCounts(userId));

  const allModules = useMemo(
    () => getModulesForUser(role, tenantFeatures ?? {}, userFeatures ?? {}),
    [role, tenantFeatures, userFeatures],
  );

  const { sorted, maxCount } = useMemo(() => {
    const hasHistory = allModules.some((m) => (counts[m.id] ?? 0) > 0);
    const sorted = (
      hasHistory
        ? [...allModules].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
        : allModules
    ).slice(0, MAX_SHOWN);
    const maxCount = Math.max(1, ...sorted.map((m) => counts[m.id] ?? 0));
    return { sorted, maxCount };
  }, [allModules, counts]);

  if (sorted.length === 0) return null;

  const hasHistory = sorted.some((m) => (counts[m.id] ?? 0) > 0);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
          {hasHistory ? 'Frequently Used' : 'Quick Access'}
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {sorted.map((mod, idx) => {
          const count = counts[mod.id] ?? 0;
          const weight = count / maxCount;
          const isTop = idx === 0 && count > 0;
          return (
            <QuickNavButton
              key={mod.id}
              mod={mod}
              count={count}
              weight={weight}
              isTop={isTop}
              onClick={() => navigate(mod.defaultPath)}
            />
          );
        })}
      </div>
    </div>
  );
}
