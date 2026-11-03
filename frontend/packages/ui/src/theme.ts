import { useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { colors, ColorName, ColorScheme } from './tokens';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export type AppearanceMode = 'system' | 'light' | 'dark';

let mode: AppearanceMode = 'system';
const listeners = new Set<() => void>();

export function setAppearance(next: AppearanceMode): void {
  mode = next;
  if (typeof document !== 'undefined') {
    if (next === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', next);
  } else {
    Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  }
  for (const listener of listeners) listener();
}

export function useAppearance(): AppearanceMode {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => mode,
    () => mode,
  );
}

export function useThemeColors(): Record<ColorName, string> & { scheme: ColorScheme } {
  const chosen = useAppearance();
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const scheme: ColorScheme = chosen === 'system' ? system : chosen;
  return { ...colors[scheme], scheme };
}
