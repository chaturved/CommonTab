const plugin = require('tailwindcss/plugin');
const tokens = require('./src/tokens.json');

const cssVars = (scheme) =>
  Object.fromEntries(Object.entries(tokens.colors[scheme]).map(([name, value]) => [`--c-${name}`, value]));

const colors = Object.fromEntries(Object.keys(tokens.colors.light).map((name) => [name, `var(--c-${name})`]));

module.exports = {
  theme: {
    extend: {
      colors,
      borderRadius: tokens.radius,
      minHeight: tokens.size,
      minWidth: tokens.size,
      fontSize: Object.fromEntries(
        Object.entries(tokens.fontSize).map(([name, [size, lineHeight, weight]]) => [
          name,
          [`${size}px`, { lineHeight: `${lineHeight}px`, fontWeight: weight }],
        ]),
      ),
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': cssVars('light'),
        '@media (prefers-color-scheme: dark)': { ':root': cssVars('dark') },
        ':root[data-theme="light"]': cssVars('light'),
        ':root[data-theme="dark"]': cssVars('dark'),
      });
    }),
  ],
};
