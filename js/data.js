// All site content lives here. Add, remove or reorder items and the site updates.
// Image keys refer to entries in assets.js (e.g. 'goods/rose-1').

export const SITE = {
  email: 'hello@trevvv.co',
  copyright: 'Copyright 2026. Trevor Connolly',
  categories: [
    { id: 'type', label: 'Type' },
    { id: 'digital', label: 'Digital' },
    { id: 'print', label: 'Print' },
    { id: 'goods', label: 'Goods' },
  ],
};

// ─── TYPE ────────────────────────────────────────────────────────────────────
// `family` must match a family declared in css/fonts.css.
// `tile` = the homepage thumbnail colour: a name from TILE_COLORS below, or a hex.
// `scale` nudges each font's size on the homepage tile; `heroSize` is its px size in the detail-page carousel.
// `lowercase: true` adds lowercase rows to the glyph tester.
// Homepage type-tile colours. Each font's `tile` picks one of these by name (or takes a hex).
export const TILE_COLORS = {
  sage: '#56705F',        // Sotol sage
  terracotta: '#9A4A2E',
  ochre: '#8C6A3C',       // Dry-creek ochre
  rust: '#A35A2C',        // Saddle rust
  stone: '#6E6A60',       // Weathered stone
};

// `shopify` = the product's handle in the Shopify store. Fonts without one are shown but not sold.
export const TYPE = [
  { slug: 'oxomoco', shopify: 'oxomoco-font', heroSize: 90, name: 'Oxomoco', display: 'oxomoco', family: 'Oxomoco', scale: 0.9,
    descriptor: 'A geometric filled display font', styles: [['Regular', 'Oxomoco'], ['Round', 'Oxomoco-Round']],
    price: 10, tile: 'terracotta',
    details: [
      { img: 'type/oxomoco-detail-1', text: 'A 3×3 grid of nine squares. Every letter starts there, so they all share one height and width.' },
      { img: 'type/oxomoco-detail-2', text: 'Then come the circles, to loosen up the hard lines.' },
      { img: 'type/oxomoco-detail-3', text: 'Squares, right triangles, circles. That’s the whole toolkit.' },
      { img: 'type/oxomoco-detail-4', text: 'Regular for sharp corners. Round for something friendlier.' },
    ],
    featured: [{ img: 'type/oxomoco-featured-feelgood', title: 'Feel Good', text: 'Branding for a mental health check-in app', href: '/digital/feelgood' }] },
  { slug: 'arroyo', shopify: 'digital-product', heroSize: 110, name: 'Arroyo', display: 'ARROYO', family: 'Arroyo', scale: 0.9,
    descriptor: 'A fun, flowy slab', styles: [['Regular', 'Arroyo']], price: 10, tile: 'ochre' },
  { slug: 'bastrop', shopify: 'digital-product-1', heroSize: 115, lowercase: true, name: 'Bastrop', display: 'Bastrop', family: 'Bastrop', scale: 1,
    descriptor: 'A quirky, footed serif with ligatures',
    styles: [['Regular', 'Bastrop'], ['Semibold', 'Bastrop-Semibold'], ['Bold', 'Bastrop-Bold']], price: 10, tile: 'stone' },
  { slug: 'hombre', shopify: 'digital-product-4', heroSize: 110, name: 'Hombre', display: 'HOMBRE', family: 'Hombre', scale: 0.9,
    descriptor: 'A blocky, hand-painted looking unifont that gives a bold, classy, vintage feel',
    styles: [['Regular', 'Hombre']], price: 10, tile: 'ochre' },
  { slug: 'walter', shopify: 'digital-product-3', heroSize: 90, name: 'Walter', display: 'WALTER', family: 'Walter', scale: 0.9,
    descriptor: 'A smudged, handmade block', styles: [['Regular', 'Walter'], ['Light', 'Walter-Light']], price: 10, tile: 'rust' },
  { slug: 'tamarisk', shopify: 'digital-product-6', heroSize: 110, name: 'Tamarisk', display: 'TAMARISK', family: 'Tamarisk', scale: 1,
    descriptor: 'A bold, sporty display', styles: [['Regular', 'Tamarisk']], price: 10, tile: 'terracotta' },
  { slug: 'redwood', shopify: 'digital-product-7', heroSize: 100, name: 'Redwood', display: 'REDWOOD', family: 'Redwood', scale: 0.85,
    descriptor: 'A retro, groovy square', styles: [['Regular', 'Redwood']], price: 10, tile: 'ochre' },
  { slug: 'widebrim', shopify: 'digital-product-2', heroSize: 80, name: 'Widebrim', display: 'WIDEBRIM', family: 'Widebrim', scale: 0.8,
    descriptor: 'A blocky, hand-painted print', styles: [['Regular', 'Widebrim']], price: 10, tile: 'stone' },
];

// Tweaks for fonts that come from Shopify (keyed by lowercase name). Anything set here wins
// over the automatic defaults: display (the word shown), lowercase (specimen in sentence case),
// heroSize / scale (carousel and thumbnail size).
export { TYPE_TWEAKS as TYPE_OVERRIDES } from './content.js'; // edited in the admin page (Type)

// ─── GOODS ───────────────────────────────────────────────────────────────────
// `soldOut` disables Add to Cart. `variants` adds a small picker to the Product Nav.
export { GOODS } from './content.js'; // edited in the admin page (Goods)

// ─── PRINT + DIGITAL ─────────────────────────────────────────────────────────
// Print and Digital projects live in content/ (one file per project) and are edited on the
// admin page at /admin. tools/build-content.mjs turns them into js/content.js.
export { PRINT, DIGITAL } from './content.js';

// ─── HOMEPAGE ORDER ──────────────────────────────────────────────────────────
// The unfiltered grid mixes everything. Each entry is 'category/slug'.
// Anything not listed here is appended at the end in category order.
export const HOME_ORDER = [
  'goods/go-outside-hat', 'digital/feelgood', 'type/oxomoco',
  'type/arroyo', 'print/wedding-invitation', 'digital/storyright',
  'goods/rose-t-shirt', 'type/tamarisk', 'goods/shapes',
  'type/bastrop', 'goods/black-sun-hat', 'print/save-the-date',
  'type/hombre', 'goods/feed-bandana',
  'goods/rose', 'type/walter', 'print/fiesta',
  'goods/nothing-hat', 'goods/sentinel-sun',
  'type/redwood', 'goods/black-sun-shirt',
  'goods/rose-hat', 'goods/feed-t-shirt',
  'type/widebrim', 'goods/feed-hat', 'goods/cactus',
];
