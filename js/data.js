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
      { img: 'type/oxomoco-detail-1' },
      { text: 'Each letter made with a 3×3 square grid, giving a consistent height and width across characters.', h: 320 },
      { img: 'type/oxomoco-detail-2' },
      { text: 'Circles give relief to the hard lines of the geometric letters.', h: 357 },
      { text: 'Several shapes help create each unique display letter – but all are square, a right triangle, or a circle.', h: 357 },
      { img: 'type/oxomoco-detail-3' },
      { text: 'Two styles to choose from: the sharper angles of Oxomoco Regular vs the more playful look of Oxomoco Round', h: 320 },
      { img: 'type/oxomoco-detail-4' },
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
export const TYPE_OVERRIDES = {
  kadoka: { display: 'Kadoka', lowercase: true },
};

// ─── GOODS ───────────────────────────────────────────────────────────────────
// `soldOut` disables Add to Cart. `variants` adds a small picker to the Product Nav.
export const GOODS = [
  { slug: 'go-outside-hat', name: 'Go Outside Hat', title: 'Go outside hat', price: 30,
    comingSoon: true, // remove once it's in Shopify (and add shopify: '<handle>' if the handle differs)
    desc: ['Go outside. Talk to people. Be happy.', 'A simple mantra to help people get more out of life.'],
    variants: { label: 'Color', options: ['Black', 'Navy', 'Spruce', 'Green Camo'] },
    images: ['goods/go-outside-hat-1', 'goods/go-outside-hat-2', 'goods/go-outside-hat-3'] },
  { slug: 'black-sun-shirt', name: 'Black Sun T-Shirt', title: 'Black Sun t-shirt', price: 45, soldOut: true,
    desc: ['Get lost. Have fun. Find peace.'], images: ['goods/black-sun-shirt-1', 'goods/black-sun-shirt-2', 'goods/black-sun-shirt-3', 'goods/black-sun-shirt-4'] },
  { slug: 'shapes', name: 'Shapes Bandana', title: 'Shapes', price: 30, soldOut: true,
    desc: ['A blue bandana with shapes.'], images: ['goods/shapes-1', 'goods/shapes-2', 'goods/shapes-3', 'goods/shapes-4'] },
  { slug: 'rose', name: 'Rose Bandana', title: 'Rose', price: 30, soldOut: true,
    desc: ['A blooming geometric rose motif hanky.'], images: ['goods/rose-1', 'goods/rose-2', 'goods/rose-3', 'goods/rose-4'] },
  { slug: 'black-sun-hat', name: 'Black Sun Hat', title: 'Black Sun hat', price: 30, soldOut: true,
    desc: ['Get lost. Have fun. Find peace.'], images: ['goods/black-sun-hat-1', 'goods/black-sun-hat-2', 'goods/black-sun-hat-3'] },
  { slug: 'feed-bandana', name: 'Feed Bandana', title: 'Feed bandana', price: 30, soldOut: true,
    desc: ['Curiosity feeds desire feeds curiosity feeds desire…'], images: ['goods/feed-bandana-1', 'goods/feed-bandana-2', 'goods/feed-bandana-3', 'goods/feed-bandana-4'] },
  { slug: 'rose-hat', name: 'Rose Hat', title: 'Rose hat', price: 30, soldOut: true,
    desc: ['A hat with a geometric rose.'], images: ['goods/rose-hat-1', 'goods/rose-hat-2', 'goods/rose-hat-3', 'goods/rose-hat-4'] },
  { slug: 'feed-t-shirt', name: 'Feed T-Shirt', title: 'Feed t-shirt', price: 45, soldOut: true,
    desc: ['Feed your curiosity.'], images: ['goods/feed-t-shirt-1', 'goods/feed-t-shirt-2', 'goods/feed-t-shirt-3', 'goods/feed-t-shirt-4'] },
  { slug: 'feed-hat', name: 'Feed Hat', title: 'Feed hat', price: 30, soldOut: true,
    desc: ['A hat with a tangled snake.'], images: ['goods/feed-hat-1', 'goods/feed-hat-2', 'goods/feed-hat-3', 'goods/feed-hat-4'] },
  { slug: 'rose-t-shirt', name: 'Rose T-Shirt', title: 'Rose t-shirt', price: 45, soldOut: true,
    desc: ['Growth comes in bunches.'], images: ['goods/rose-t-shirt-1', 'goods/rose-t-shirt-2', 'goods/rose-t-shirt-3', 'goods/rose-t-shirt-4'] },
  { slug: 'nothing-hat', name: 'Nothing Hat', title: 'Nothing hat', price: 30, soldOut: true,
    desc: ['Nothing is wrong.'], images: ['goods/nothing-hat-1', 'goods/nothing-hat-2', 'goods/nothing-hat-3', 'goods/nothing-hat-4'] },
  { slug: 'sentinel-sun', name: 'Sentinel Sun Bandana', title: 'Sentinel Sun', price: 30, soldOut: true,
    desc: ['You can find me here, enjoying peace, underneath the sentinel sun.'], images: ['goods/sentinel-sun-1', 'goods/sentinel-sun-2', 'goods/sentinel-sun-3', 'goods/sentinel-sun-4'] },
  { slug: 'cactus', name: 'Cactus Bandana', title: 'Cactus', price: 30, soldOut: true,
    desc: ['A bandana with a cactus design.'], images: ['goods/cactus-1', 'goods/cactus-2', 'goods/cactus-3', 'goods/cactus-4'] },
];

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
