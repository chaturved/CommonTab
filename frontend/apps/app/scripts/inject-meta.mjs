import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const site = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://commontab.app').replace(/\/$/, '');

const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const PUBLIC = {
  'index.html': {
    title: 'CommonTab: split bills to the cent, even offline',
    description: "CommonTab splits every bill to the cent, keeps the balances, and works when your signal doesn't.",
    path: '/',
    index: true,
  },
  'join/[code].html': {
    title: "You're invited to a group on CommonTab",
    description: 'Join the group with this link and see what everyone owes. Free, and it works offline.',
    path: '/join',
    index: false,
  },
};

function tagsFor({ title, description, path, index }) {
  const image = `${site}/og.png`;
  const meta = [
    ['name', 'description', description],
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'CommonTab'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', `${site}${path}`],
    ['property', 'og:image', image],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', image],
    ['name', 'theme-color', '#061A20'],
  ];
  return [
    `<title>${escape(title)}</title>`,
    ...meta.map(([kind, name, content]) => `<meta ${kind}="${name}" content="${escape(content)}"/>`),
    index ? '' : '<meta name="robots" content="noindex"/>',
  ].join('');
}

const APP_TAGS = '<title>CommonTab</title><meta name="robots" content="noindex"/>';

function pagesIn(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === '_expo' || name === 'assets') return [];
    return statSync(full).isDirectory() ? pagesIn(full) : name.endsWith('.html') ? [full] : [];
  });
}

const pages = pagesIn(dist);
for (const key of Object.keys(PUBLIC)) {
  if (!pages.some((file) => relative(dist, file).split('\\').join('/') === key)) throw new Error(`${key} was not exported`);
}

for (const file of pages) {
  const key = relative(dist, file).split('\\').join('/');
  const html = readFileSync(file, 'utf8');
  if (!html.includes('<head>')) throw new Error(`${key} has no <head>`);
  writeFileSync(file, html.replace('<head>', `<head>${PUBLIC[key] ? tagsFor(PUBLIC[key]) : APP_TAGS}`));
}

console.log(`Added page tags to ${pages.length} pages (site ${site})`);
