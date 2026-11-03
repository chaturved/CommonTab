import { colors, ColorName, ColorScheme } from '../src/tokens';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [ColorName, ColorName, number][] = [
  ['fg', 'background', 4.5],
  ['fg', 'card', 4.5],
  ['fg-soft', 'card', 4.5],
  ['muted', 'background', 4.5],
  ['muted', 'card', 4.5],
  ['accent', 'background', 4.5],
  ['accent', 'card', 4.5],
  ['on-tint', 'tint', 4.5],
  ['on-tint', 'tint-selected', 4.5],
  ['accent', 'tint', 4.5],
  ['owe', 'background', 4.5],
  ['owe', 'card', 4.5],
  ['owe', 'owe-tint', 4.5],
  ['tab', 'card', 4.5],
  ['muted', 'tint', 4.5],
  ['on-primary', 'primary', 4.5],
  ['on-primary', 'hero-from', 4.5],
  ['on-primary', 'hero-to', 4.5],
  ['mint', 'hero-from', 4.5],
  ['hero-muted', 'hero-from', 4.5],
  ['hero-muted', 'hero-to', 4.5],
  ['on-warn', 'warn', 4.5],
  ['warn-icon', 'warn', 3],
  ['on-error', 'error', 4.5],
  ['owe', 'error', 3],
];

describe.each<ColorScheme>(['light', 'dark'])('WCAG AA contrast (%s)', (scheme) => {
  test.each(PAIRS)('%s on %s >= %f', (fg, bg, minimum) => {
    expect(contrast(colors[scheme][fg], colors[scheme][bg])).toBeGreaterThanOrEqual(minimum);
  });
});
