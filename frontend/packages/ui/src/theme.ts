import { useColorScheme } from 'react-native';
import { colors, ColorName, ColorScheme } from './tokens';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function useThemeColors(): Record<ColorName, string> & { scheme: ColorScheme } {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...colors[scheme], scheme };
}
