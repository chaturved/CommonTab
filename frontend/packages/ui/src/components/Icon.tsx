import { ComponentType } from 'react';
import { ColorName } from '../tokens';
import { useThemeColors } from '../theme';

export interface IconProps {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  tone: ColorName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ icon: Glyph, tone, size, strokeWidth }: IconProps) {
  const colors = useThemeColors();
  return <Glyph size={size} strokeWidth={strokeWidth} color={colors[tone]} />;
}
