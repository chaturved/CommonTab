import { useSyncExternalStore } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { DESKTOP_MIN_WIDTH, PRERENDER_WIDTH } from '@/constants/layout';


let hydrated = Platform.OS !== 'web';
const listeners = new Set<() => void>();

export function markHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  const ready = useSyncExternalStore(subscribe, () => hydrated, () => false);
  return ready && width >= DESKTOP_MIN_WIDTH;
}

export function useViewportWidth(): number {
  const { width } = useWindowDimensions();
  const ready = useSyncExternalStore(subscribe, () => hydrated, () => false);
  return ready ? width : PRERENDER_WIDTH;
}
