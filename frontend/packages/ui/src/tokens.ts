import data from './tokens.json';

export type ColorName = keyof typeof data.colors.light;
export type ColorScheme = 'light' | 'dark';

export const colors: Record<ColorScheme, Record<ColorName, string>> = data.colors;
export const avatarColors: readonly { bg: string; fg: string }[] = data.avatars;
export const radius = data.radius;
export const size = data.size;
export const fontSize = data.fontSize;

/** Text sizes get stronger as `label` is uppercase with this tracking (DESIGN.md: 13/700 caps). */
export const labelTracking = 0.08;
