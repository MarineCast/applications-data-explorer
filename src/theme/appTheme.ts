import { useSyncExternalStore } from 'react';

export type AppTheme = 'light' | 'dark';
const key = 'marinecast.home.theme';
const event = 'marinecast-theme-change';
let fallback: AppTheme = 'light';
function readTheme(): AppTheme {
  try { return window.localStorage.getItem(key) === 'dark' ? 'dark' : 'light'; }
  catch { return fallback; }
}
function subscribe(callback: () => void) {
  const storage = (e: StorageEvent) => { if (e.key === key || e.key === null) callback(); };
  window.addEventListener(event, callback);
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener(event, callback); window.removeEventListener('storage', storage); };
}
export function setAppTheme(theme: AppTheme) {
  fallback = theme;
  try { window.localStorage.setItem(key, theme); } catch { /* In-memory preference still works. */ }
  window.dispatchEvent(new Event(event));
}
export function useAppTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as AppTheme);
  return [theme, setAppTheme] as const;
}
