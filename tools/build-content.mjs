// Turns the project files the admin page edits (content/print/*.json, content/digital/*.json)
// into js/content.js, which the site loads. Also records each image's width and height so the
// homepage grid can lay out before images load.
//
// Netlify runs this on every deploy (see netlify.toml). To run it locally: node tools/build-content.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BG = { rose: 'var(--rose)', sand: 'var(--sand)', paper: 'var(--paper)', ink: 'var(--ink)', clay: 'var(--clay)' };

// ── image size from the file header (JPEG, PNG, GIF, WebP) ──
function head(file, n = 256 * 1024) {
  const fd = openSync(file, 'r'); const buf = Buffer.alloc(n); const len = readSync(fd, buf, 0, n, 0); closeSync(fd);
  return buf.subarray(0, len);
}
function imageSize(file) {
  const b = head(file);
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString('ascii', 0, 3) === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

const images = {};
const problems = [];
function useImage(path, where) {
  if (!path) return null;
  if (/^https?:/.test(path)) { images[path] = { src: path, cdn: '', w: 1200, h: 900 }; return path; }
  const rel = path.replace(/^\//, '');
  const file = join(root, rel);
  if (!existsSync(file)) { problems.push(`${where}: image not found (${path})`); return null; }
  const size = imageSize(file) || { w: 1200, h: 900 };
  images[path] = { src: rel, cdn: '', w: size.w, h: size.h };
  return path;
}
const paragraphs = (s) => String(s || '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);

function load(dir, { all = false } = {}) {
  const d = join(root, 'content', dir);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => extname(f) === '.json').map((f) => {
    const data = JSON.parse(readFileSync(join(d, f), 'utf8'));
    return { slug: basename(f, '.json'), ...data };
  }).filter((p) => all || !p.draft).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.title || a.slug).localeCompare(String(b.title || b.slug)));
}

const PRINT = load('print').map((p) => ({
  slug: p.slug, title: p.title, desc: paragraphs(p.description),
  images: (p.images || []).map((im, i) => useImage(im, `Print "${p.title}" image ${i + 1}`)).filter(Boolean),
})).filter((p) => p.images.length || (problems.push(`Print "${p.title}" has no images, so it's hidden`), false));

// Digital photos: 1 = homepage thumbnail, 2 = hero (or 1 if there's only one), the rest run down the
// page full width ahead of any sections. Older files may still set thumbnail / hero directly.
const DIGITAL = load('digital').map((d) => {
  const photos = (d.photos || []).filter(Boolean);
  const thumb = d.thumbnail || photos[0], hero = d.hero || photos[1] || photos[0];
  const extra = photos.slice(2).map((image) => ({ type: 'full', image }));
  return { ...d, thumb, heroSrc: hero, sections: [...extra, ...(d.sections || [])] };
}).map((d) => ({
  slug: d.slug, title: d.title, intro: d.intro || '', ...(d.layout ? { layout: d.layout } : {}),
  carouselTitle: d.carousel_title || '',
  carousel: (d.carousel || []).map((c, i) => ({ img: useImage(c.image, `Digital "${d.title}" carousel ${i + 1}`), text: c.text || '' })).filter((c) => c.img),
  thumb: useImage(d.thumb || d.heroSrc, `Digital "${d.title}" thumbnail`),
  hero: useImage(d.heroSrc, `Digital "${d.title}" hero`), heroWide: !!d.hero_wide,
  sections: (d.sections || []).map((s, i) => {
    const where = `Digital "${d.title}" section ${i + 1}`;
    const o = { type: s.type, tone: s.tone || 'light' };
    if (s.title) o.title = s.title;
    if (s.caption) o.caption = s.caption;
    if (s.note) o.note = s.note;
    if (s.background) o.bg = BG[s.background] || s.background;
    if (s.image_width) o.w = Number(s.image_width);
    if (s.side) o.side = s.side;
    if (s.image) o.img = useImage(s.image, where);
    if (s.images) o.imgs = s.images.map((im) => useImage(im, where)).filter(Boolean);
    return o;
  }),
})).filter((d) => d.thumb || (problems.push(`Digital "${d.title}" has no thumbnail or hero, so it's hidden`), false));

// Goods: your own pages for products (photos, copy). Products in Shopify add live price,
// options and stock on the site; pieces not in Shopify show as sold out.
const GOODS = load('goods').map((g) => ({
  slug: g.slug, name: g.name || g.title, title: g.title || g.name, desc: paragraphs(g.description),
  images: (g.photos || []).map((im, i) => useImage(im, `Goods "${g.title}" photo ${i + 1}`)).filter(Boolean),
  ...(g.price ? { price: Number(g.price) } : {}),
  ...(g.sold_out ? { soldOut: true } : {}),
  ...(g.shopify_handle ? { shopify: g.shopify_handle } : {}),
}));

// Type: site-only display tweaks for fonts (the font itself, price and descriptor come from Shopify).
const TYPE_TWEAKS = {};
for (const t of load('type')) {
  const o = {};
  if (t.display) o.display = t.display;
  if (t.lowercase != null) o.lowercase = !!t.lowercase;
  if (t.hero_size) o.heroSize = Number(t.hero_size);
  if (t.thumbnail_scale) o.scale = Number(t.thumbnail_scale);
  if (t.details?.length) o.details = t.details.map((d, i) => ({ img: useImage(d.image, `Type "${t.slug}" detail ${i + 1}`), text: d.text || '' })).filter((d) => d.img || d.text);
  if (Object.keys(o).length) TYPE_TWEAKS[t.slug] = o;
}

const out = `// Generated by tools/build-content.mjs from the files in content/. Don't edit by hand:
// use the admin page (/admin) or edit content/*.json and re-run the script.
export const PRINT = ${JSON.stringify(PRINT, null, 2)};
export const DIGITAL = ${JSON.stringify(DIGITAL, null, 2)};
export const GOODS = ${JSON.stringify(GOODS, null, 2)};
export const TYPE_TWEAKS = ${JSON.stringify(TYPE_TWEAKS, null, 2)};
export const CONTENT_IMG = ${JSON.stringify(images, null, 2)};
`;
writeFileSync(join(root, 'js', 'content.js'), out);
// A small index the admin page reads to list your Goods pages next to the Shopify products.
writeFileSync(join(root, 'admin', 'site-index.json'), JSON.stringify({
  goods: load('goods', { all: true }).map((g) => ({ slug: g.slug, name: g.name || g.title, title: g.title || g.name, shopify: g.shopify_handle || null })),
  type: Object.keys(TYPE_TWEAKS),
  builtInFonts: [...readFileSync(join(root, 'js', 'data.js'), 'utf8').matchAll(/shopify:\s*'([^']+)'/g)].map((m) => m[1]),
}, null, 2) + '\n');
console.log(`content.js: ${PRINT.length} print, ${DIGITAL.length} digital, ${GOODS.length} goods, ${Object.keys(images).length} images`);
problems.forEach((p) => console.warn('  ! ' + p));
