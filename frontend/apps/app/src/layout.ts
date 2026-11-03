import { useWindowDimensions } from 'react-native';

export const DESKTOP_MIN_WIDTH = 1024;

export function useIsDesktop(): boolean {
  return useWindowDimensions().width >= DESKTOP_MIN_WIDTH;
}
