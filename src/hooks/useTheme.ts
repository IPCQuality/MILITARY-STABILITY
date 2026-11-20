import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ms_theme_v1';
const THEME_EVENT = 'ms-theme-change';

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Ignore storage access restrictions
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyThemeToDocument(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.dataset.theme = mode;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    function handleSync(e: Event) {
      const detail = (e as CustomEvent<ThemeMode>).detail;
      if (detail === 'dark' || detail === 'light') {
        setThemeState(detail);
      }
    }
    function handleStorage(e: StorageEvent) {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue);
      }
    }
    window.addEventListener(THEME_EVENT, handleSync);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    applyThemeToDocument(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_EVENT, { detail: next }));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
}
