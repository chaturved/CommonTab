import { useColorScheme } from 'nativewind';
import { colors, ColorName, ColorScheme } from './tokens';

/** Join class names, skipping falsy values. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Resolved color values for the current scheme, for props that take a color rather than a class (icons, gradients). */
export function useThemeColors(): Record<ColorName, string> & { scheme: ColorScheme } {
  const { colorScheme } = useColorScheme();
  const scheme: ColorScheme = colorScheme === 'dark' ? 'dark' : 'light';
  return { ...colors[scheme], scheme };
}
