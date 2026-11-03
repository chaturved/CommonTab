import { ComponentType } from 'react';
import { ColorName } from '../tokens';
import { useThemeColors } from '../theme';

export interface IconProps {
  /** A lucide icon (or any component taking size, color and strokeWidth). */
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** A color token name, e.g. "accent". Resolved for the current color scheme. */
  tone: ColorName;
  size?: number;
  strokeWidth?: number;
}

/**
 * Icons take a color value rather than a class, so this resolves a token for the current scheme.
 * (NativeWind's cssInterop did not carry the class color into the SVG on web.)
 */
export function Icon({ icon: Glyph, tone, size, strokeWidth }: IconProps) {
  const colors = useThemeColors();
  return <Glyph size={size} strokeWidth={strokeWidth} color={colors[tone]} />;
}
