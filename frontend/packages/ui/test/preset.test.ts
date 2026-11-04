import { colors } from '../src/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const preset = require('../tailwind-preset.js');

test('light and dark define exactly the same color names', () => {
  expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
});

test('every color becomes a Tailwind color backed by a CSS variable', () => {
  for (const name of Object.keys(colors.light)) {
    expect(preset.theme.extend.colors[name]).toBe(`var(--c-${name})`);
  }
});

test('DESIGN.md class names exist: bg-card, text-muted, text-owe, rounded-card', () => {
  expect(Object.keys(preset.theme.extend.colors)).toEqual(expect.arrayContaining(['card', 'muted', 'owe', 'background', 'accent']));
  expect(preset.theme.extend.borderRadius).toMatchObject({ card: 20, hero: 28, pill: 9999 });
});

test('touch target token is 44', () => expect(preset.theme.extend.minHeight.touch).toBe(44));

test('a chosen appearance can override the system on the web', () => {
  const rules: Record<string, unknown> = {};
  const plugin = preset.plugins[0] as { handler: (api: { addBase: (r: Record<string, unknown>) => void }) => void };
  plugin.handler({ addBase: (r) => Object.assign(rules, r) });
  expect(Object.keys(rules)).toEqual(expect.arrayContaining([':root[data-theme="light"]', ':root[data-theme="dark"]']));
});
