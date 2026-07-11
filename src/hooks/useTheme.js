import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'notebook_theme';

/**
 * Detect system preference for dark mode.
 */
function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Read stored theme or fall back to system preference.
 */
function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* localStorage unavailable */
  }
  return getSystemTheme();
}

/**
 * Apply theme attribute on <html> and persist to localStorage.
 */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/**
 * Theme hook — manages dark / light mode.
 *
 * Returns { theme, toggleTheme, isDark }
 */
export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      // Only follow system if user hasn't explicitly chosen
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      } catch {
        /* localStorage unavailable */
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
