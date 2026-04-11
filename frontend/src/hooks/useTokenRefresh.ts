import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './useRedux';
import { refreshAuthThunk } from '../store/slices/authSlice';
import { STORAGE_KEYS } from '../utils/constants';

/** How many milliseconds before expiry to proactively refresh. */
const REFRESH_BEFORE_MS = 60_000; // 60 seconds

function getTokenExpiry(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Mount this once at the app root.
 * Handles two scenarios:
 * 1. Page reload after idle — access token expired, refresh token still valid.
 *    Immediately fetches a new access token so the user stays logged in.
 * 2. Tab left open — schedules a proactive refresh 60 s before expiry.
 *    Also rechecks on tab focus so a long-idle tab refreshes when the user
 *    comes back.
 */
export function useTokenRefresh() {
  const dispatch = useAppDispatch();
  const { token, refreshPending } = useAppSelector((s) => s.auth);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function scheduleRefresh(accessToken: string | null) {
    clearTimer();
    const expiry = getTokenExpiry(accessToken);
    if (!expiry) return;

    const delay = expiry - Date.now() - REFRESH_BEFORE_MS;
    if (delay <= 0) {
      // Already expired or about to expire — refresh immediately if not already doing so
      dispatch(refreshAuthThunk());
      return;
    }

    timerRef.current = setTimeout(() => {
      dispatch(refreshAuthThunk());
    }, delay);
  }

  // On mount: if refresh token exists but access token is missing/expired, refresh now.
  // Otherwise schedule a proactive refresh before expiry.
  useEffect(() => {
    const storedRefresh = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!storedRefresh) return; // not logged in at all

    const storedAccess = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const expiry = getTokenExpiry(storedAccess);

    if (!expiry || expiry - Date.now() < REFRESH_BEFORE_MS) {
      dispatch(refreshAuthThunk());
    } else {
      scheduleRefresh(storedAccess);
    }

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-schedule when a new access token arrives after a successful refresh.
  useEffect(() => {
    if (token && !refreshPending) {
      scheduleRefresh(token);
    }
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshPending]);

  // On tab focus: re-check expiry in case the OS suspended the tab's timers.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      const storedRefresh = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!storedRefresh) return;

      const currentAccess = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const expiry = getTokenExpiry(currentAccess);
      if (!expiry || expiry - Date.now() < REFRESH_BEFORE_MS) {
        dispatch(refreshAuthThunk());
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [dispatch]);
}
