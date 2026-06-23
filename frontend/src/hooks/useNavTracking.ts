import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getModuleForPath } from '@/modules/registry';

export function useNavTracking(userId: string | undefined, role: string) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!userId || !role || role === 'super_admin' || role === 'patient') return;
    const mod = getModuleForPath(pathname, role);
    if (!mod) return;
    try {
      const key = `quicknav_${userId}`;
      const counts: Record<string, number> = JSON.parse(localStorage.getItem(key) ?? '{}');
      counts[mod.id] = (counts[mod.id] ?? 0) + 1;
      localStorage.setItem(key, JSON.stringify(counts));
    } catch {}
  }, [pathname, userId, role]);
}
