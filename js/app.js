import { SITE, TYPE, TYPE_OVERRIDES, GOODS, PRINT, DIGITAL, HOME_ORDER, TILE_COLORS } from './data.js';
import { IMG } from './assets.js';
import { CONTENT_IMG } from './content.js';
Object.assign(IMG, CONTENT_IMG); // photos used by Print and Digital projects (from the admin page)
import { shopReady, checkoutUrl, fetchTypeCatalog, fetchGoodsCatalog } from './shop.js';
import { LICENSE_VERSION, LICENSE_SUMMARY, LICENSE_SECTIONS } from './license.js';

/* ═════════════════════════════ helpers ═════════════════════════════ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EASE = 'cubic-bezier(.22,.7,.18,1)';
const money = (n) => `$${Number(n) % 1 ? Number(n).toFixed(2) : n}`;

// Backdrop refraction (SVG filter in backdrop-filter) only renders in Chromium browsers.
if (navigator.userAgentData?.brands?.some((b) => /Chromium/.test(b.brand))) document.documentElement.classList.add('glass-fx');

const view = $('#view');
const header = $('#header');
const nav = $('#filter');
const dock = $('#navDock');

// Images: local file first, Squarespace CDN if the local one isn't there yet.
function img(key, { alt = '', lazy = true, cls = '' } = {}) {
  const a = IMG[key];
  if (!a) return '';
  const src = /^https?:/.test(a.src) ? a.src : `/${a.src}`; // Shopify photos are full URLs
  return `<img src="${src}" data-cdn="${a.cdn}" width="${a.w}" height="${a.h}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ''} decoding="async"${cls ? ` class="${cls}"` : ''}>`;
}
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.dataset.cdn && !t.dataset.fellBack) { t.dataset.fellBack = '1'; t.src = t.dataset.cdn; }
}, true);
// Tile labels: sample the pixels behind each piece of label text. Anything but a clearly light
// background gets off-white text; light backgrounds get #333333. Both texts share one colour
// unless they sit on genuinely opposite backgrounds (a black shirt left, cream right).
// Sampling uses a tiny copy of each image, read once. No glows, no mid grays.
const pixCache = new Map();
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function lumaMap(src) {
  if (pixCache.has(src)) return pixCache.get(src);
  const p = new Promise((resolve) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async';
    i.onload = () => {
      try {
        const W = 80, H = Math.max(8, Math.round(W * i.naturalHeight / i.naturalWidth));
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(i, 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H).data, L = new Float32Array(W * H);
        for (let k = 0, n = 0; k < d.length; k += 4, n++) L[n] = 0.2126 * lin(d[k]) + 0.7152 * lin(d[k + 1]) + 0.0722 * lin(d[k + 2]);
        resolve({ W, H, L });
      } catch { resolve(null); }
    };
    i.onerror = () => resolve(null);
    i.src = src;
  });
  pixCache.set(src, p); return p;
}
const LIGHT_BG = 0.45; // mean relative luminance above which a background counts as light
function toneTile(tile) {
  const im = tile.querySelector(':scope > img');
  if (!im?.complete || !im.naturalWidth) return;
  const src = im.dataset.fellBack ? im.dataset.cdn.replace(/format=\d+w/, 'format=100w') : im.currentSrc;
  lumaMap(src).then((m) => {
    if (!m) return;
    const tr = tile.getBoundingClientRect(); if (!tr.width) return;
    const s = Math.max(tr.width / m.W, tr.height / m.H), ox = (tr.width - m.W * s) / 2, oy = (tr.height - m.H * s) / 2, pad = 4;
    const els = [...tile.querySelectorAll('.tile-label > *')];
    const means = els.map((el) => {
      const r = el.getBoundingClientRect(); if (!r.width) return null;
      const x0 = Math.max(0, Math.floor((r.left - tr.left - pad - ox) / s)), x1 = Math.min(m.W - 1, Math.ceil((r.right - tr.left + pad - ox) / s));
      const y0 = Math.max(0, Math.floor((r.top - tr.top - pad - oy) / s)), y1 = Math.min(m.H - 1, Math.ceil((r.bottom - tr.top + pad - oy) / s));
      let sum = 0, n = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { sum += m.L[y * m.W + x]; n++; }
      return n ? sum / n : null;
    });
    const known = means.filter((L) => L != null); if (!known.length) return;
    const split = known.length > 1 && Math.min(...known) < 0.12 && Math.max(...known) > 0.6;
    const shared = known.some((L) => L <= LIGHT_BG) ? 'light' : 'gray';
    delete tile.dataset.tone;
    els.forEach((el, i) => { el.dataset.tone = split && means[i] != null ? (means[i] > LIGHT_BG ? 'gray' : 'light') : shared; });
  });
}
document.addEventListener('load', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.parentElement?.classList.contains('tile')) toneTile(t.parentElement);
}, true);
let toneTimer;
addEventListener('resize', () => { clearTimeout(toneTimer); toneTimer = setTimeout(() => document.querySelectorAll('.tile').forEach(toneTile), 200); });

(() => { // logo is a CSS mask, so probe for the local file first
  const set = (u) => document.documentElement.style.setProperty('--logo-url', `url("${u}")`);
  const local = '/' + IMG.logo.src; const i = new Image();
  i.onload = () => set(local); i.onerror = () => set(IMG.logo.cdn); i.src = local;
})();

/* ═════════════════════════════ content model ═════════════════════════════ */
// Goods follow Shopify (Printify publishes there). A Shopify product that matches one in
// js/data.js (by handle or name) takes over its price, options and stock; new products
// get a page built from their Shopify title, description and photos. Older pieces in
// data.js that were never in Shopify stay on the site as sold out.
const goodsReady = (async () => {
  const shop = await fetchGoodsCatalog();
  if (!shop) return;
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const p of shop) {
    const g = GOODS.find((x) => x.shopify === p.handle || norm(x.name) === norm(p.title) || norm(x.title) === norm(p.title) || x.slug === p.handle);
    const forSale = p.variants.filter((v) => v.available);
    const prices = p.variants.map((v) => v.price);
    const variants = p.variants.length > 1 ? { label: p.optionLabel || 'Option', options: forSale.map((v) => ({ name: v.name, price: v.price })) } : undefined;
    const live = { shopify: p.handle, price: Math.min(...prices), variants, soldOut: !p.available || !forSale.length, comingSoon: false };
    const images = p.images.map((im, i) => { const k = `shop/${p.handle}/${i}`; IMG[k] = { src: im.url, cdn: im.url, w: im.w, h: im.h }; return k; });
    // A Goods page from the admin keeps its own photos and copy; Shopify fills any gaps.
    if (g) { Object.assign(g, live); g.name ||= p.title; g.title ||= p.title; if (!g.images?.length) g.images = images; if (!g.desc?.length) g.desc = p.paragraphs; continue; }
    if (!images.length) { console.warn(`[trvco] ${p.title} has no photos in Shopify, so it isn't shown yet.`); continue; }
    GOODS.unshift({ slug: p.handle, name: p.title, title: p.title, desc: p.paragraphs, images, ...live });
  }
})();

// The Type list follows the Shopify store: fonts in the store are shown (new ones added
// automatically), fonts no longer in the store are hidden. js/data.js keeps the richer
// design details (hero size, details images…) for fonts it already knows.
await (async () => {
  const shop = await fetchTypeCatalog();
  if (!shop) return; // Shopify unreachable: keep the built-in list
  const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const known = new Map(TYPE.map((t) => [key(t.name), t]));
  const next = [];
  for (const p of shop) {
    const t = TYPE.find((x) => x.shopify === p.handle) || known.get(key(p.name));
    if (t) {
      next.push(Object.assign(t, { shopify: p.handle, price: p.price ?? t.price, soldOut: !p.available, ...(p.descriptor && !t.descriptor ? { descriptor: p.descriptor } : {}) },
        TYPE_OVERRIDES?.[t.slug] || TYPE_OVERRIDES?.[key(p.name)] || {}));
      continue;
    }
    if (!p.fontUrl) { console.warn(`[trvco] ${p.name} is in Shopify but has no web font file (custom.web_font), so it isn't shown yet.`); continue; }
    const family = `shop-${key(p.name)}`;
    const over = TYPE_OVERRIDES?.[key(p.name)] || {};
    const display = over.display || p.name.toUpperCase();
    // Size new fonts to match the others: the existing names run about 430px wide in the carousel.
    let heroSize = 100, scale = 1;
    try {
      const ff = new FontFace(family, `url("${p.fontUrl}")`, { display: 'swap' }); document.fonts.add(ff);
      await Promise.race([ff.load(), new Promise((r) => setTimeout(r, 1500))]);
      if (ff.status === 'loaded') {
        const c = document.createElement('canvas').getContext('2d'); c.font = `100px "${family}"`;
        const w = c.measureText(display).width;
        if (w > 0) { heroSize = Math.round(Math.min(150, Math.max(70, 100 * 430 / w))); scale = Math.min(1.3, Math.max(0.7, 0.95 * 430 / w)); }
      }
    } catch {}
    next.push({ slug: key(p.name), shopify: p.handle, name: p.name, display, family, scale, heroSize,
      descriptor: p.descriptor, styles: [['Regular', family]], price: p.price, soldOut: !p.available, ...over });
  }
  // Keep the built-in order for known fonts, new ones go at the end.
  next.sort((a, b) => { const ia = TYPE.indexOf(a), ib = TYPE.indexOf(b); return (ia < 0 ? 1e3 : ia) - (ib < 0 ? 1e3 : ib); });
  TYPE.splice(0, TYPE.length, ...next);
})();

// Type and Goods tiles show the price (lowest option, if options are priced differently) or Sold out.
await goodsReady;
function priceLabel(p) {
  if (p.soldOut) return 'Sold out';
  if (p.comingSoon) return 'Coming soon';
  const ps = [p.price, ...(p.variants?.options || []).map((o) => o?.price)].filter((n) => n != null && n !== '');
  if (!ps.length) return '';
  const lo = Math.min(...ps.map(Number)), hi = Math.max(...ps.map(Number));
  return lo === hi ? money(lo) : `From ${money(lo)}`;
}
const ITEMS = [
  ...TYPE.map((t) => ({ key: `type/${t.slug}`, cat: 'type', href: `/type/${t.slug}`, title: t.name, ratio: 432 / 307, type: t, meta: t.shopify ? priceLabel(t) : '' })),
  ...DIGITAL.map((d) => ({ key: `digital/${d.slug}`, cat: 'digital', href: `/digital/${d.slug}`, title: d.title, ratio: 432 / 400, img: d.thumb })),
  ...PRINT.map((p) => ({ key: `print/${p.slug}`, cat: 'print', href: `/print/${p.slug}`, title: p.title, ratio: IMG[p.images[0]].w / IMG[p.images[0]].h, img: p.images[0] })),
  ...GOODS.map((g) => ({ key: `goods/${g.slug}`, cat: 'goods', href: `/goods/${g.slug}`, title: g.name, ratio: 432 / 289, img: g.images[0], meta: priceLabel(g) })),
];
const byKey = new Map(ITEMS.map((i) => [i.key, i]));
const HOME_LIST = [...new Set([...HOME_ORDER.filter((k) => byKey.has(k)), ...ITEMS.map((i) => i.key)])];
const CAT_LIST = (cat) => ITEMS.filter((i) => i.cat === cat).map((i) => i.key);
const CAT_IDS = SITE.categories.map((c) => c.id);

/* ═════════════════════════════ cart ═════════════════════════════ */
// The cart is kept in the visitor's browser. Checkout hands it to Shopify (js/shop.js).
// A line: { kind: 'goods'|'type', slug, handle, name, variant?, price, qty, img? }
const lineKey = (l) => `${l.kind}/${l.slug}/${l.variant || ''}`;
const cart = {
  lines: (() => {
    try {
      const raw = JSON.parse(localStorage.getItem('trvco-cart')) || [];
      return raw.filter((l) => l && l.slug).map((l) => ({ kind: l.kind || (TYPE.some((t) => t.slug === l.slug) ? 'type' : 'goods'), handle: l.handle || l.slug, qty: 1, ...l }));
    } catch { return []; }
  })(),
  get count() { return this.lines.reduce((n, l) => n + l.qty, 0); },
  get subtotal() { return this.lines.reduce((n, l) => n + l.qty * Number(l.price || 0), 0); },
  save() { try { localStorage.setItem('trvco-cart', JSON.stringify(this.lines)); } catch {} this.paint(); },
  add(item) {
    const hit = this.lines.find((l) => lineKey(l) === lineKey(item));
    // A font license is one per buyer, so adding it twice doesn't double it.
    if (hit) { if (item.kind !== 'type') hit.qty += 1; } else this.lines.push({ qty: 1, ...item });
    this.save();
    const b = $('#cartButton'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  },
  setQty(key, qty) {
    const l = this.lines.find((x) => lineKey(x) === key); if (!l) return;
    if (qty <= 0) this.lines = this.lines.filter((x) => x !== l); else l.qty = Math.min(qty, 20);
    this.save();
  },
  clear() { this.lines = []; this.save(); },
  paint() {
    const n = this.count;
    $('#cartCount').textContent = n;
    $('#cartButton').setAttribute('aria-label', `Cart, ${n} item${n === 1 ? '' : 's'}`);
    current?.page.onCart?.();
  },
};
let toastTimer;
function toast(msg, link) {
  const t = $('#toast'); t.textContent = msg;
  if (link) { const a = document.createElement('a'); a.href = link.href; a.textContent = link.label; t.append(' ', a); }
  t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }
$('#cartButton').addEventListener('click', () => navigate('/cart'));

/* ═════════════════════════════ persistent nav ═════════════════════════════ */
nav.innerHTML = SITE.categories.map((c) => `<a href="/${c.id}" data-cat="${c.id}">${esc(c.label)}</a>`).join('');
$('#copyright').textContent = SITE.copyright;

// Move the nav to a new parent; FLIP-animate it from where it was.
function placeNav(target, animate = true) {
  if (!target || nav.parentElement === target) return;
  const first = nav.getBoundingClientRect();
  target.appendChild(nav);
  if (!animate || reduce || !first.width) return;
  const last = nav.getBoundingClientRect();
  const dx = first.left - last.left, dy = first.top - last.top;
  if (Math.abs(dx) + Math.abs(dy) < 1) return;
  nav.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 700, easing: EASE });
}
function setActiveNav(cat) {
  $$('a', nav).forEach((a) => a.setAttribute('aria-current', String(a.dataset.cat === cat)));
  nav.classList.toggle('has-active', !!cat);
}

/* ═════════════════════════════ router ═════════════════════════════ */
function parse(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  let m;
  if (p === '/') return { name: 'home', filter: null };
  if ((m = p.match(/^\/(type|digital|print|goods)$/))) return { name: 'home', filter: m[1] };
  if ((m = p.match(/^\/type\/([\w-]+)$/)) && TYPE.some((t) => t.slug === m[1])) return { name: 'type', slug: m[1], cat: 'type' };
  if ((m = p.match(/^\/goods\/(p\/)?([\w-]+)$/)) && GOODS.some((g) => g.slug === m[2])) return { name: 'goods', slug: m[2], cat: 'goods', ...(m[1] ? { canonical: `/goods/${m[2]}` } : {}) };
  if ((m = p.match(/^\/print\/([\w-]+)$/)) && PRINT.some((g) => g.slug === m[1])) return { name: 'print', slug: m[1], cat: 'print' };
  if ((m = p.match(/^\/digital\/([\w-]+)$/)) && DIGITAL.some((d) => d.slug === m[1])) return { name: 'digital', slug: m[1], cat: 'digital' };
  if (p === '/feelgoodapp') return { name: 'digital', slug: 'feelgood', cat: 'digital', canonical: '/digital/feelgood' };
  if (p === '/cart') return { name: 'cart', path: '/cart' };
  if (p === '/license') return { name: 'license', path: '/license' };
  if (p === '/storyright') return { name: 'digital', slug: 'storyright', cat: 'digital', canonical: '/digital/storyright' };
  return { name: '404' };
}
const pathOf = (r) => r.path ? r.path : r.name === 'home' ? (r.filter ? `/${r.filter}` : '/') : r.name === '404' ? location.pathname : `/${r.name}/${r.slug}`;

let current = null; // { route, page }
let busy = Promise.resolve();

function navigate(path, { replace = false } = {}) {
  const route = parse(path);
  const url = pathOf(route);
  if (current && url === pathOf(current.route)) { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return; }
  history.replaceState({ ...(history.state || {}), scroll: scrollY }, '');
  history[replace ? 'replaceState' : 'pushState']({ scroll: 0 }, '', url);
  busy = busy.then(() => show(route, 0));
}
addEventListener('popstate', (e) => { busy = busy.then(() => show(parse(location.pathname), e.state?.scroll || 0)); });
history.scrollRestoration = 'manual';

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || a.target || a.hasAttribute('download')) return;
  e.preventDefault();
  let path = url.pathname;
  // Clicking the active filter again clears it.
  if (a.parentElement === nav && current?.route.name === 'home' && current.route.filter === a.dataset.cat) path = '/';
  navigate(path);
});

async function show(route, scroll) {
  if (route.canonical) history.replaceState({ scroll }, '', route.canonical);
  const prev = current;

  // Same page, different state → page handles its own transition.
  if (prev && prev.route.name === route.name && prev.page.update && prev.page.update(route) !== false) {
    current = { route, page: prev.page }; afterShow(route); return;
  }

  if (prev) {
    // Leaving the homepage hero: send the nav up to the header while content fades.
    if (nav.parentElement !== dock && !(route.name === 'home' && !route.filter)) placeNav(dock);
    document.body.classList.add('is-leaving'); view.classList.add('is-leaving');
    await wait(260);
    prev.page.destroy?.();
  }

  const page = PAGES[route.name](route);
  view.innerHTML = '';
  view.append(page.el);
  view.classList.remove('is-leaving', 'is-entering'); document.body.classList.remove('is-leaving');
  window.scrollTo(0, scroll);
  page.mount?.({ scroll, first: !prev });
  void view.offsetWidth; view.classList.add('is-entering');
  view.addEventListener('animationend', () => view.classList.remove('is-entering'), { once: true });
  if (!page.ownsNav) placeNav(dock, !!prev);
  current = { route, page };
  syncChrome();
  afterShow(route);
  observeReveals();
  view.focus({ preventScroll: true });
}

// Header + Product Nav share one blurred backdrop; size it to whatever is fixed at the top.
const pnavRO = new ResizeObserver(([e]) => document.documentElement.style.setProperty('--pnav-h', `${Math.round(e.target.offsetHeight)}px`));
function syncChrome() {
  pnavRO.disconnect();
  const pn = $('.pnav', view);
  document.body.classList.toggle('has-pnav', !!pn);
  if (pn) { document.documentElement.style.setProperty('--pnav-h', `${pn.offsetHeight}px`); pnavRO.observe(pn); }
}

function afterShow(route) {
  setActiveNav(route.name === 'home' ? route.filter : route.cat);
  const label = route.name === 'home' ? (route.filter ? SITE.categories.find((c) => c.id === route.filter).label : '') : current?.page.title || '';
  document.title = label ? `${label} — trvco studio` : 'trvco studio';
  onScroll();
}

/* ═════════════════════════════ scroll: header + nav hand-off ═════════════════════════════ */
let ticking = false;
function onScroll() {
  // Product pages: the category nav steps aside as soon as you scroll and only returns at the
  // very top. The Product Nav appears only once the in-page price + Add to Cart has scrolled
  // up under the header, so the two are never on screen together.
  const hasPnav = !!$('.pnav', view);
  document.body.classList.toggle('nav-away', hasPnav && scrollY > 24);
  const buy = $('.buy-row', view);
  const on = hasPnav && !!buy && buy.getBoundingClientRect().bottom <= header.offsetHeight;
  if (on !== document.body.classList.contains('pnav-on')) {
    document.body.classList.toggle('pnav-on', on);
    $('.pnav', view)?.setAttribute('aria-hidden', String(!on));
  }
  current?.page.onScroll?.();
  // Homepage: the header backing waits until the nav has actually docked into the header.
  const homeSlot = $('.nav-slot', view);
  // Product pages (Type, Goods): the backing arrives with the Product Nav, not before.
  // Other detail pages (Print, Digital): it arrives once the page title scrolls up under the header.
  const title = !homeSlot && !hasPnav ? $('h1', view) : null;
  const backing = hasPnav ? on
    : title ? title.getBoundingClientRect().top <= header.offsetHeight
    : scrollY > 8 && (!homeSlot || nav.parentElement === dock);
  document.body.classList.toggle('scrolled', backing);
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });

let revealIO;
function observeReveals() {
  revealIO?.disconnect();
  revealIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal', view).forEach((el) => revealIO.observe(el));
}

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

/* ═════════════════════════════ HOME (masonry + filters) ═════════════════════════════ */
// Type tiles: one colour, black lifted a shade so tiles read against the page, with white names.
const TYPE_TILE_BG = '#1E2019';
function typeTileHTML(t) {
  return `<div class="type-tile" style="background:${TYPE_TILE_BG}"><span style="font-family:'${t.family}';--s:${t.scale || 1}">${esc(t.display)}</span></div>`;
}

function HomePage(route) {
  const el = h(`<div class="home">
    <section class="hero">
      <p class="eyebrow">The Design Studio of</p>
      <h1 class="wordmark"><span>TREVOR</span><span>CONNOLLY</span></h1>
      <div class="nav-slot"></div>
    </section>
    <section class="grid" aria-label="Work"><div class="grid-inner"></div></section>
  </div>`);
  const hero = $('.hero', el), slot = $('.nav-slot', el), inner = $('.grid-inner', el);
  const tiles = new Map();
  for (const key of HOME_LIST) {
    const it = byKey.get(key);
    const cat = SITE.categories.find((c) => c.id === it.cat).label;
    const media = it.type ? typeTileHTML(it.type) : img(it.img, { alt: it.title });
    const a = h(`<a class="tile is-gone" href="${it.href}" data-key="${key}" aria-label="${esc(it.title)} — ${cat}">${media}<span class="tile-label"><span>${esc(it.title)}</span><em>${esc(it.meta || cat)}</em></span></a>`);
    inner.append(a); tiles.set(key, a);
  }
  let filter = route.filter;
  let shown = [];

  function layout(keys) {
    const W = inner.clientWidth;
    const cols = W >= 960 ? 3 : W >= 600 ? 2 : 1;
    const gap = cols === 1 ? 12 : 15;
    const cw = (W - gap * (cols - 1)) / cols;
    const hs = new Array(cols).fill(0);
    for (const k of keys) {
      const it = byKey.get(k), t = tiles.get(k);
      const th = Math.round(cw / it.ratio);
      const c = hs.indexOf(Math.min(...hs));
      Object.assign(t.style, { left: `${c * (cw + gap)}px`, top: `${hs[c]}px`, width: `${cw}px`, height: `${th}px` });
      if (it.type) t.querySelector('span').style.setProperty('--fs', `${Math.round(cw * 0.111 * (it.type.scale || 1))}px`);
      hs[c] += th + gap;
    }
    inner.style.height = `${Math.max(0, Math.max(...hs) - gap)}px`;
    shown = keys;
  }
  const ro = new ResizeObserver(() => layout(shown));

  function apply(f) {
    // Re-showing tiles must not trigger the CSS opacity transition: CSS transitions outrank the
    // fade-in animation, so the tiles would pop in, vanish, then fade in (the flicker).
    inner.classList.add('no-fade');
    filter = f;
    el.classList.toggle('is-filtered', !!f);
    hero.classList.toggle('is-gone', !!f);
    hero.classList.remove('is-hidden');
    const keys = f ? CAT_LIST(f) : HOME_LIST;
    tiles.forEach((t, k) => t.classList.toggle('is-gone', !keys.includes(k)));
    tiles.forEach((t) => t.classList.remove('is-out'));
    layout(keys);
    void inner.offsetWidth; inner.classList.remove('no-fade');
  }

  // Smoothly scroll the page (headline and all) until the nav's slot lines up with the header.
  // Smooth scroll with a fixed ease (so it feels the same in every browser).
  function scrollToY(target) {
    const from = scrollY, dist = target - from;
    if (reduce || Math.abs(dist) < 2) { window.scrollTo(0, target); return Promise.resolve(); }
    const dur = Math.min(900, Math.max(450, Math.abs(dist) * 0.9));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    return new Promise((done) => {
      const t0 = performance.now();
      let finished = false;
      const finish = () => { if (finished) return; finished = true; window.scrollTo(0, target); done(); };
      const step = (now) => {
        if (finished) return;
        const t = Math.min(1, (now - t0) / dur);
        window.scrollTo(0, from + dist * ease(t));
        if (t < 1) requestAnimationFrame(step); else finish();
      };
      requestAnimationFrame(step);
      setTimeout(finish, dur + 200); // safety net if animation frames are paused (background tab)
    });
  }
  // The scroll position at which the nav's slot under the headline lines up with the header.
  const navDockedScroll = () => Math.max(0, scrollY + slot.getBoundingClientRect().top - (header.offsetHeight / 2 - (nav.offsetHeight || 35) / 2));
  const scrollNavToHeader = () => scrollToY(navDockedScroll());

  // Going home (logo, or clearing a filter): the reverse. Start with the page parked where the nav
  // slot meets the header, then scroll up to the top — the nav rides back down with the headline.
  function scrollHomeFromHeader() {
    window.scrollTo(0, navDockedScroll());
    placeNav(dock, false);
    return scrollToY(0);
  }
  function fadeInTiles(keys) {
    if (reduce) return;
    const vh = innerHeight;
    let n = 0;
    for (const k of keys) {
      const t = tiles.get(k), r = t.getBoundingClientRect();
      if (r.top > vh + 40 || r.bottom < -40) continue;
      t.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
        { duration: 550, delay: 60 + 55 * n++, easing: EASE, fill: 'backwards' });
    }
  }

  // Filter change: the thumbnails fade out (while the page scrolls the headline away, if it's
  // showing), then the filtered set loads in fresh. No sliding or reordering animation.
  async function setFilter(f) {
    document.body.classList.add('autoscrolling');
    try { await runFilter(f); } finally { document.body.classList.remove('autoscrolling'); onScroll(); }
  }
  async function runFilter(f) {
    const wasFiltered = !!filter;
    filter = f; // set now so the scroll hand-off doesn't fight the transition
    shown.forEach((k) => tiles.get(k).classList.add('is-out'));

    if (f && !wasFiltered && nav.parentElement !== dock) {
      await Promise.all([scrollNavToHeader(), wait(300)]);
      placeNav(dock, false); // positions now coincide, so this hand-off is invisible
    } else {
      if (f) placeNav(dock);
      await wait(300);
    }

    apply(f);
    if (f) { window.scrollTo(0, 0); fadeInTiles(CAT_LIST(f)); return; }
    // Back to everything: reverse of filtering — park at the docked point, fade in, scroll up.
    const p = scrollHomeFromHeader();
    fadeInTiles(HOME_LIST);
    await p;
  }

  return {
    el, ownsNav: true, title: '',
    mount({ scroll, first }) {
      apply(filter);
      ro.observe(inner);
      // Restore scroll after layout exists (back button), then decide where the nav belongs.
      if (scroll) window.scrollTo(0, scroll);
      if (filter) placeNav(dock, false);
      else if (!first && !scroll && nav.parentElement === dock) {
        // Coming home from another page: same upward scroll as clearing a filter.
        document.body.classList.add('autoscrolling');
        window.scrollTo(0, navDockedScroll());
        setTimeout(() => scrollToY(0).then(() => { document.body.classList.remove('autoscrolling'); onScroll(); }), reduce ? 0 : 180);
      } else this.onScroll('mount');
    },
    update(r) {
      if (r.filter === filter) return;
      setFilter(r.filter);
    },
    onScroll(mode) {
      if (filter) return;
      // Hand the nav to the header the moment its slot reaches the header's centre line.
      // On scroll the two positions coincide, so the hand-off is invisible. On mount (arriving
      // from another page) the nav flies from the header down into the slot.
      const s = slot.getBoundingClientRect();
      const headerMid = header.getBoundingClientRect().height / 2;
      const navH = nav.offsetHeight || 35;
      const want = s.top + navH / 2 <= headerMid ? dock : slot;
      if (nav.parentElement !== want) placeNav(want, mode === 'mount' && nav.parentElement === dock);
    },
    destroy() { ro.disconnect(); },
  };
}

/* ═════════════════════════════ shared blocks ═════════════════════════════ */
// ── Product Nav + buy row ───────────────────────────────────────────────────
// Options come from `variants.options` in data.js: plain strings use the product price,
// or pass { name, price } to price an option differently.
const optionsOf = (p) => (p.variants?.options || []).map((o) => (typeof o === 'string' ? { name: o, price: p.price } : { price: p.price, ...o }));
const chevronSmall = `<svg width="11" height="7" viewBox="0 0 11 7" aria-hidden="true"><path d="M1 1l4.5 4.5L10 1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
function pricePicker(p) {
  const opts = optionsOf(p);
  if (opts.length < 2) return `<span class="opt-price js-price">${p.price ? money(p.price) : ''}</span>`;
  return `<div class="opt">
    <button type="button" class="opt-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(p.variants.label || 'Option')}">
      <span class="opt-label">${esc(opts[0].name)} | ${money(opts[0].price)}</span>${chevronSmall}
    </button>
    <ul class="opt-list" role="listbox">${opts.map((o, i) => `<li role="option" tabindex="-1" data-i="${i}" aria-selected="${i === 0}"><span>${esc(o.name)}</span><span>${money(o.price)}</span></li>`).join('')}</ul>
  </div>`;
}
// Sold out, or not in the shop yet (comingSoon), shows a disabled button instead of Add to Cart.
const buyButton = (p) => { const off = p.soldOut ? 'Sold out' : p.comingSoon ? 'Coming soon' : ''; return `<button class="btn btn-buy" type="button" data-add ${off ? 'disabled' : ''}>${off || 'Add to Cart'}</button>`; };

// Hidden until the in-page buy row scrolls up under the header.
function productNav(p, cat) {
  const label = SITE.categories.find((c) => c.id === cat)?.label || 'all work';
  return `<div class="pnav" aria-hidden="true"><div class="pnav-inner">
    <a class="pnav-back" href="/${cat}" aria-label="Back to ${esc(label)}"><svg width="10" height="18" viewBox="0 0 10 18" aria-hidden="true"><path d="M9 1L1.5 9 9 17" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></a>
    <h2 class="pnav-name">${esc(p.name)}</h2>
    <div class="pnav-actions">${pricePicker(p)}${buyButton(p)}</div>
  </div></div>`;
}
const buyRow = (p) => `<div class="buy-row">${pricePicker(p)}${buyButton(p)}</div>`;

// Close any open option list when clicking elsewhere or pressing Escape.
document.addEventListener('click', (e) => $$('.opt.open').forEach((o) => { if (!o.contains(e.target)) setOpen(o, false); }));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $$('.opt.open').forEach((o) => { setOpen(o, false); $('.opt-btn', o).focus(); }); });
function setOpen(o, open) {
  o.classList.toggle('open', open);
  $('.opt-btn', o).setAttribute('aria-expanded', String(open));
  if (open) ($('[aria-selected="true"]', o) || $('li', o))?.focus({ preventScroll: true });
}

// Wires every picker + Add to Cart button inside `el` to one shared selection.
function wireBuy(el, getProduct, kind) {
  let sel = 0;
  const choose = (i) => {
    sel = i;
    const p = getProduct(), o = optionsOf(p)[i];
    $$('.opt', el).forEach((box) => {
      $('.opt-label', box).textContent = `${o.name} | ${money(o.price)}`;
      $$('li', box).forEach((li) => li.setAttribute('aria-selected', String(+li.dataset.i === i)));
      setOpen(box, false);
    });
  };
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.opt-btn');
    if (btn) { const box = btn.closest('.opt'); const open = !box.classList.contains('open'); $$('.opt.open').forEach((o) => setOpen(o, false)); setOpen(box, open); return; }
    const li = e.target.closest('.opt-list li');
    if (li) { choose(+li.dataset.i); li.closest('.opt').querySelector('.opt-btn').focus(); return; }
    const add = e.target.closest('[data-add]');
    if (!add || add.disabled) return;
    const p = getProduct(), opts = optionsOf(p), o = opts[sel];
    const item = { kind, slug: p.slug, handle: p.shopify || p.slug, name: p.name, price: o ? o.price : p.price, variant: o?.name, ...(p.images?.[0] ? { img: p.images[0] } : {}) };
    cart.add(item);
    toast(`Added ${item.name}${item.variant ? ` (${item.variant})` : ''} to your cart.`, { href: '/cart', label: 'View cart' });
  });
  el.addEventListener('keydown', (e) => {
    const li = e.target.closest('.opt-list li'); if (!li) return;
    const items = $$('li', li.parentElement); const k = items.indexOf(li);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(k + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(k); li.closest('.opt').querySelector('.opt-btn').focus(); }
  });
}
const cta = () => `<section class="cta"><h2 class="reveal">Want to collaborate on a project?</h2><a class="btn" href="mailto:${SITE.email}?subject=Hello">Say hello</a></section>`;
const chevronDown = `<svg width="48" height="24" viewBox="0 0 48 24" aria-hidden="true"><path d="M1 1l23 21L47 1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
const chevron = (dir) => `<svg width="24" height="48" viewBox="0 0 24 48" aria-hidden="true"><path d="${dir === 'left' ? 'M23 1L1 24l22 23' : 'M1 1l22 23L1 47'}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;

/* ═════════════════════════════ TYPE detail ═════════════════════════════ */
const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
function stylesLine(styles) {
  if (styles.length < 2) return '';
  const names = styles.map((s) => s[0]);
  const list = names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
  return `Available in ${NUM[names.length] || names.length} styles – ${list}`;
}

function testerHTML(t) {
  const sel = t.styles.length > 1
    ? `<label class="sr-only" for="styleSel">Style</label><select class="pill-select" id="styleSel">${t.styles.map(([n, f]) => `<option value="${f}">${esc(t.name)}${n === 'Regular' ? '' : ' ' + esc(n)}</option>`).join('')}</select>`
    : `<span class="pill-select" style="display:inline-flex;align-items:center;background-image:none">${esc(t.name)}</span>`;
  return `<section class="tester paper" style="--tester-font:'${t.family}'">
    <div class="tester-controls">${sel}</div>
    <div class="tester-panel" style="font-family:var(--tester-font)"></div>
  </section>`;
}
// The specimen: glyphs, then the size chart, then a type-your-own box, stacked.
function testerPanel(t) {
  const lower = t.lowercase ? `<div class="g-xl">abcdefghijklm</div><div class="g-xl">nopqrstuvwxyz</div>` : '';
  const glyphs = `<div class="glyphs"><div class="g-xl">ABCDEFGHIJKLM</div><div class="g-xl">NOPQRSTUVWXYZ</div>${lower}<div class="g-md">0123456789</div><div class="g-md">!@#$%&amp;*?/[{(.,;:'"~)}]</div></div>`;
  const line = t.lowercase ? 'Sphinx of black quartz, judge my vow' : 'SPHINX OF BLACK QUARTZ, JUDGE MY VOW';
  const sizes = `<div class="sizes">${[120, 72, 48, 32, 20].map((px) => `<div><small>${px}px</small><p style="font-size:${px}px">${line}</p></div>`).join('')}</div>`;
  const custom = `<textarea class="custom-input" rows="2" spellcheck="false" aria-label="Type to preview">${esc(t.lowercase ? 'Type something here' : 'TYPE SOMETHING')}</textarea>
    <div class="custom-size"><span>Size</span><input type="range" min="24" max="200" value="96" aria-label="Preview size" style="--pct:40.9%"><span class="custom-size-val">96px</span></div>`;
  const block = (label, html, cls = '') => `<div class="tester-block${cls}"><h3 class="tester-label">${label}</h3>${html}</div>`;
  return block('Glyphs', glyphs) + block('Sizes', sizes, ' is-left') + block('Try it', custom);
}

function typeBodyHTML(t) {
  // Details: a carousel. Images slide left to right; the note and counter below follow along.
  const ds = (t.details || []).filter((d) => d.img || d.text);
  const pad = (k) => String(k).padStart(2, '0');
  const details = ds.length ? `<section class="details paper">
      <h2 class="section-title reveal">Details</h2>
      <div class="dcar reveal" style="--n:${ds.length}">
        <div class="dcar-view"><div class="dcar-track">${ds.map((d, i) => `<button class="dfig${i ? '' : ' is-on'}" type="button" data-i="${i}" tabindex="-1" aria-label="Detail ${i + 1}">${d.img ? img(d.img, { alt: `${t.name} construction detail` }) : ''}</button>`).join('')}</div></div>
        <div class="dcar-copy">
          <p class="dcount"><span class="dcount-now">${pad(1)}</span> / ${pad(ds.length)}</p>
          <div class="dtexts" aria-live="polite">${ds.map((d, i) => `<p class="dtext${i ? '' : ' is-on'}" data-i="${i}">${esc(d.text || '')}</p>`).join('')}</div>
          ${ds.length > 1 ? `<div class="dnav"><button class="dbtn" type="button" data-d="-1" aria-label="Previous detail" disabled>${arrow('left')}</button><button class="dbtn" type="button" data-d="1" aria-label="Next detail">${arrow('right')}</button></div>` : ''}
        </div>
      </div>
    </section>` : '';
  const featured = t.featured?.length ? `<section class="featured paper">
      <h2 class="reveal">Featured in</h2>
      ${t.featured.map((f) => `<a class="featured-item reveal" href="${f.href || '#'}">${img(f.img, { alt: f.title })}<div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div></a>`).join('')}
    </section>` : '';
  return testerHTML(t) + details + featured;
}

const arrow = (dir) => `<svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true"><path d="${dir === 'left' ? 'M21 7H2M8 1L2 7l6 6' : 'M1 7h19M14 1l6 6-6 6'}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
function wireDetails(root) {
  const car = $('.dcar', root); if (!car) return;
  const track = $('.dcar-track', car), figs = $$('.dfig', car), texts = $$('.dtext', car), now = $('.dcount-now', car);
  const [prev, next] = $$('.dbtn', car);
  const n = figs.length; let cur = 0;
  const go = (i) => {
    i = Math.max(0, Math.min(n - 1, i)); cur = i;
    const f = figs[i];
    track.style.transform = `translate3d(${figs[0].offsetLeft - f.offsetLeft}px,0,0)`;
    figs.forEach((x, j) => { x.classList.toggle('is-on', j === i); x.tabIndex = -1; });
    texts.forEach((x, j) => x.classList.toggle('is-on', j === i));
    if (now) now.textContent = String(i + 1).padStart(2, '0');
    if (prev) { prev.disabled = i === 0; next.disabled = i === n - 1; }
  };
  car.addEventListener('click', (e) => {
    const b = e.target.closest('.dbtn'); if (b) return go(cur + Number(b.dataset.d));
    const f = e.target.closest('.dfig'); if (f && !f.classList.contains('is-on')) go(Number(f.dataset.i));
  });
  // Swipe: right-to-left = next, left-to-right = previous. Vertical scrolling is left alone.
  let sx = 0, sy = 0, on = false;
  const view = $('.dcar-view', car);
  view.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; on = e.touches.length === 1; }, { passive: true });
  view.addEventListener('touchend', (e) => {
    if (!on) return; on = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) go(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });
  addEventListener('resize', () => { if (car.isConnected) go(cur); });
}

function TypePage(route) {
  let idx = TYPE.findIndex((t) => t.slug === route.slug);
  const n = TYPE.length;
  const t0 = TYPE[idx];
  const el = h(`<div class="type-page">
    ${productNav({ name: `${t0.name} font`, price: t0.price }, 'type')}
    <section class="type-hero">
      <div class="tc">${TYPE.map((t, i) => `<a class="tc-item" href="/type/${t.slug}" data-i="${i}" style="font-family:'${t.family}';--tc-size:${t.heroSize || 100}px" aria-label="${esc(t.name)}"><span class="tc-word">${esc(t.display)}</span></a>`).join('')}</div>
      <div class="type-meta"></div>
      ${buyRow({ price: t0.price })}
      <button class="scroll-cue" type="button" aria-label="Scroll to details">${chevronDown}</button>
    </section>
    <div class="type-body"></div>
    ${cta()}
  </div>`);
  const tc = $('.tc', el), items = $$('.tc-item', el), meta = $('.type-meta', el), body = $('.type-body', el);
  const pName = $('.pnav-name', el), prices = $$('.js-price', el);
  let offs = new Array(n).fill(null);

  const spacing = () => innerWidth < 760 ? innerWidth * 0.5 : Math.min(674, innerWidth * 0.468);
  let slideTimer;
  function place(animate = true) {
    const sp = spacing();
    if (animate) { tc.classList.add('is-sliding'); clearTimeout(slideTimer); slideTimer = setTimeout(() => tc.classList.remove('is-sliding'), 820); }
    items.forEach((it, i) => {
      let off = ((i - idx) % n + n) % n; if (off > n / 2) off -= n;
      const clamped = Math.max(-2, Math.min(2, off));
      const prev = offs[i];
      const jump = prev === null || Math.abs(clamped - prev) > 1 || !animate;
      if (jump) it.classList.add('no-anim');
      it.style.setProperty('--x', `${clamped * sp}px`);
      it.classList.toggle('is-current', off === 0);
      it.classList.toggle('is-prev', off === -1);
      it.classList.toggle('is-next', off === 1);
      it.classList.toggle('is-hidden', Math.abs(off) > 1);
      it.tabIndex = Math.abs(off) === 1 ? 0 : -1;
      it.setAttribute('aria-hidden', String(Math.abs(off) > 1));
      offs[i] = clamped;
    });
    void el.offsetWidth;
    items.forEach((it) => it.classList.remove('no-anim'));
  }
  function paintMeta(t) {
    const sl = stylesLine(t.styles);
    meta.innerHTML = `<p>${esc(t.descriptor)}</p>${sl ? `<p>${esc(sl)}</p>` : ''}`;
    el.classList.toggle('no-sale', !t.shopify); pName.textContent = `${t.name} font`; prices.forEach((p) => { p.textContent = t.price ? money(t.price) : ''; });
  }
  function paintBody(t) {
    body.innerHTML = typeBodyHTML(t);
    paintTester(t);
    observeReveals();
    wireDetails(body);
  }
  function paintTester(t) {
    const panel = $('.tester-panel', body);
    panel.innerHTML = testerPanel(t);
    const sel = $('#styleSel', body); const fam = sel ? sel.value : t.family;
    $('.tester', body).style.setProperty('--tester-font', `'${fam}'`);
  }
  body.addEventListener('change', (e) => { if (e.target.id === 'styleSel') $('.tester', body).style.setProperty('--tester-font', `'${e.target.value}'`); });
  body.addEventListener('input', (e) => {
    if (e.target.type === 'range') { const r = e.target; r.style.setProperty('--pct', `${((r.value - r.min) / (r.max - r.min)) * 100}%`); body.style.setProperty('--custom-size', `${e.target.value}px`); $('.custom-size-val', body).textContent = `${e.target.value}px`; }
  });
  $('.scroll-cue', el).addEventListener('click', () => body.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }));
  wireBuy(el, () => ({ slug: TYPE[idx].slug, shopify: TYPE[idx].shopify, name: `${TYPE[idx].name} font`, price: TYPE[idx].price }), 'type');
  const onKey = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const j = (idx + (e.key === 'ArrowRight' ? 1 : -1) + n) % n; navigate(`/type/${TYPE[j].slug}`); }
  };
  const onResize = () => place(false);
  // Swipe the carousel on touch screens: right-to-left = next font (same as tapping the one on
  // the right), left-to-right = previous. Vertical scrolling is left alone.
  const step = (d) => navigate(`/type/${TYPE[(idx + d + n) % n].slug}`);
  let sx = 0, sy = 0, swiping = false, swipedAt = 0;
  const hero = $('.type-hero', el);
  hero.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; swiping = e.touches.length === 1; }, { passive: true });
  hero.addEventListener('touchend', (e) => {
    if (!swiping) return; swiping = false;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) { swipedAt = Date.now(); step(dx < 0 ? 1 : -1); }
  }, { passive: true });
  // A swipe that ends on a font name shouldn't also count as tapping it.
  hero.addEventListener('click', (e) => { if (Date.now() - swipedAt < 400) { e.preventDefault(); e.stopPropagation(); } }, true);

  paintMeta(t0); paintBody(t0);
  return {
    el, title: t0.name,
    mount() { place(false); addEventListener('keydown', onKey); addEventListener('resize', onResize); },
    async update(r) {
      const j = TYPE.findIndex((t) => t.slug === r.slug);
      if (j === idx) return;
      idx = j; const t = TYPE[j]; this.title = t.name;
      place(true);
      // Swap the content below in step with the slide.
      const atTop = scrollY < 200;
      [meta, pName, ...prices].forEach((n) => { n.style.opacity = 0; }); body.classList.add('is-swapping');
      await wait(260);
      paintMeta(t); paintBody(t);
      if (!atTop) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      [meta, pName, ...prices].forEach((n) => { n.style.opacity = ''; }); body.classList.remove('is-swapping');
      document.title = `${t.name} — trvco studio`;
    },
    destroy() { removeEventListener('keydown', onKey); removeEventListener('resize', onResize); },
  };
}

/* ═════════════════════════════ GOODS + PRINT detail (same template) ═════════════════════════════ */
function ProductPage(route) {
  const isGoods = route.name === 'goods';
  const p = (isGoods ? GOODS : PRINT).find((x) => x.slug === route.slug);
  const el = h(`<div class="product-page">
    ${isGoods ? productNav(p, 'goods') : ''}
    <section class="product-head">
      <h1>${esc(p.title)}</h1>
      ${p.desc.map((d) => `<p>${esc(d)}</p>`).join('')}
      ${isGoods ? buyRow(p) : ''}
    </section>
    <div class="product-images">${p.images.map((k, i) => `<div class="${i ? 'reveal' : ''}">${img(k, { alt: `${p.title} — image ${i + 1}`, lazy: i > 0 })}</div>`).join('')}</div>
  </div>`);
  if (isGoods) wireBuy(el, () => p, 'goods');
  return { el, title: p.title };
}

/* ═════════════════════════════ DIGITAL detail ═════════════════════════════ */
function DigitalPage(route) {
  const d = DIGITAL.find((x) => x.slug === route.slug);
  const sec = (s) => {
    const style = `${s.bg ? `background:${s.bg};` : ''}${s.w ? `--w:${s.w}px;` : ''}`;
    const tone = `tone-${s.tone || 'light'}`;
    const head = `${s.title ? `<h2 class="cs-title reveal">${esc(s.title)}</h2>` : ''}${s.caption ? `<p class="cs-caption reveal">${esc(s.caption)}</p>` : ''}`;
    if (s.type === 'full') return `<section class="cs cs-full ${tone}" style="${style}">${img(s.img, { alt: s.caption })}${head}</section>`;
    if (s.type === 'feature') return `<section class="cs cs-feature ${tone}" style="${style}"><div>${head}</div><div class="cs-media reveal">${img(s.img, { alt: s.title || s.caption })}</div></section>`;
    if (s.type === 'slides') return `<section class="cs cs-slides ${tone}" style="${style}" data-slides>
        ${head}
        ${s.imgs.map((k, i) => `<div class="slide" data-slide="${i}">${img(k, { alt: `${s.caption} — ${i + 1} of ${s.imgs.length}` })}</div>`).join('')}
        <button class="slide-btn prev" type="button" aria-label="Previous">${chevron('left')}</button>
        <button class="slide-btn next" type="button" aria-label="Next">${chevron('right')}</button>
      </section>`;
    if (s.type === 'icons') return `<section class="cs cs-icons ${tone}" style="${style}">${head}<div class="icon-grid reveal">${s.imgs.map((k) => img(k, { alt: 'App icon option' })).join('')}</div>${s.note ? `<p class="cs-note">${esc(s.note)}</p>` : ''}</section>`;
    return '';
  };
  const el = h(`<div class="digital-page">
    <section class="case-hero ${d.heroWide ? 'wide' : ''}">
      <h1>${esc(d.title)}</h1>
      <p>${esc(d.intro)}</p>
      ${img(d.hero, { alt: `${d.title} — hero`, lazy: false })}
    </section>
    ${d.sections.map(sec).join('')}
    ${cta()}
  </div>`);
  // Simple slide carousel
  $$('[data-slides]', el).forEach((box) => {
    const slides = $$('.slide', box); let i = 0;
    const paint = (dir = 0) => slides.forEach((s, j) => {
      const off = j - i;
      s.style.transform = `translateX(${off * 100}%)`;
      s.style.opacity = off === 0 ? 1 : 0;
      s.setAttribute('aria-hidden', String(off !== 0));
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.slide-btn'); if (!b) return;
      i = (i + (b.classList.contains('next') ? 1 : -1) + slides.length) % slides.length; paint();
    });
    paint();
  });
  return { el, title: d.title };
}

/* ═════════════════════════════ CART ═════════════════════════════ */
function CartPage() {
  const el = h(`<div class="cart-page"><section class="cart-wrap"><h1>Cart</h1><div class="cart-body"></div></section></div>`);
  const body = $('.cart-body', el);
  const thumb = (l) => {
    if (l.kind === 'type') {
      const t = TYPE.find((x) => x.slug === l.slug);
      return `<span class="cart-thumb type-thumb"><span style="font-family:'${t?.family || 'inherit'}'">${esc(t?.display || l.name)}</span></span>`;
    }
    return `<span class="cart-thumb">${l.img ? img(l.img, { alt: '', lazy: false }) : ''}</span>`;
  };
  const paint = () => {
    if (!cart.lines.length) {
      body.innerHTML = `<p class="cart-empty">Your cart is empty.</p><p class="cart-browse"><a href="/type">Browse type</a><a href="/goods">Browse goods</a></p>`;
      return;
    }
    const hasType = cart.lines.some((l) => l.kind === 'type');
    const hasGoods = cart.lines.some((l) => l.kind !== 'type');
    body.innerHTML = `<ul class="cart-lines">${cart.lines.map((l) => {
      const key = esc(lineKey(l));
      const qty = l.kind === 'type'
        ? `<span class="cart-qty-note">License</span>`
        : `<div class="cart-qty" role="group" aria-label="Quantity for ${esc(l.name)}">
            <button type="button" data-qty="-1" data-key="${key}" aria-label="One fewer">−</button><span aria-live="polite">${l.qty}</span><button type="button" data-qty="1" data-key="${key}" aria-label="One more">+</button>
          </div>`;
      return `<li class="cart-line">
        <a href="/${l.kind}/${l.slug}" tabindex="-1" aria-hidden="true">${thumb(l)}</a>
        <div class="cart-info"><a href="/${l.kind}/${l.slug}">${esc(l.name)}</a>${l.variant ? `<span>${esc(l.variant)}</span>` : ''}</div>
        ${qty}
        <span class="cart-price">${money(l.qty * Number(l.price || 0))}</span>
        <button type="button" class="cart-remove" data-remove="${key}" aria-label="Remove ${esc(l.name)}">Remove</button>
      </li>`;
    }).join('')}</ul>
    <div class="cart-summary">
      <div class="cart-total"><span>Subtotal</span><span>${money(cart.subtotal)}</span></div>
      <p class="cart-note">${hasGoods ? 'Shipping and tax are added at checkout.' : 'Tax is added at checkout.'}${hasType ? ` Fonts come with the <a href="/license">trvco studio Font License</a> and download right after purchase. Digital downloads are final.` : ''}</p>
      <button type="button" class="btn btn-buy cart-checkout">Checkout</button>
    </div>`;
  };
  el.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-qty]');
    if (q) { const l = cart.lines.find((x) => lineKey(x) === q.dataset.key); if (l) cart.setQty(q.dataset.key, l.qty + Number(q.dataset.qty)); return; }
    const r = e.target.closest('[data-remove]');
    if (r) { cart.setQty(r.dataset.remove, 0); return; }
    const go = e.target.closest('.cart-checkout');
    if (!go || go.disabled) return;
    if (!shopReady()) { toast('Checkout opens once the shop is connected.'); return; }
    go.disabled = true; go.textContent = 'Opening checkout…';
    try {
      const url = await checkoutUrl(cart.lines.map((l) => ({ handle: l.handle || l.slug, variant: l.variant, qty: l.qty, name: l.name })));
      location.href = url;
    } catch (err) {
      toast(err.message || 'Checkout couldn’t open. Please try again.');
      go.disabled = false; go.textContent = 'Checkout';
    }
  });
  paint();
  return { el, title: 'Cart', onCart: paint };
}

/* ═════════════════════════════ LICENSE ═════════════════════════════ */
function LicensePage() {
  const block = (b) => typeof b === 'string' ? `<p>${esc(b)}</p>`
    : Array.isArray(b) ? `<ul>${b.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : `<ol>${b.ol.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  const el = h(`<div class="license-page"><section class="license-wrap">
    <h1>Font License</h1>
    <p class="license-lead">${esc(LICENSE_SUMMARY.lead)}</p>
    <div class="license-summary">
      <div><h2>You can</h2><ul>${LICENSE_SUMMARY.can.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div><h2>You can’t</h2><ul>${LICENSE_SUMMARY.cant.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    <p class="license-more">Need more seats, or something not covered here? <a href="mailto:${SITE.email}?subject=Font%20license">Get in touch</a>.</p>
    <article class="license-full">
      <h2>The full license <span>Version ${LICENSE_VERSION}</span></h2>
      ${LICENSE_SECTIONS.map(([t, bs]) => `${t ? `<h3>${esc(t)}</h3>` : ''}${bs.map(block).join('')}`).join('')}
    </article>
  </section></div>`);
  return { el, title: 'Font License' };
}

function NotFound() {
  return { el: h(`<section class="notfound"><h1>Nothing here.</h1><p><a href="/">Back to the studio</a></p></section>`), title: 'Not found' };
}

const PAGES = { cart: CartPage, license: LicensePage, home: HomePage, type: TypePage, goods: ProductPage, print: ProductPage, digital: DigitalPage, '404': NotFound };

/* ═════════════════════════════ boot ═════════════════════════════ */
cart.paint();
show(parse(location.pathname), 0);
