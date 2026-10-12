// Type and Goods pages for the admin. Reads the same Shopify data the site uses and shows,
// for each product, what appears on the site and a link to edit it in Shopify.
import { SHOP } from '/js/shop.js';
import { TYPE, GOODS } from '/js/data.js';

const STORE = SHOP.domain.replace('.myshopify.com', '');
const ADMIN = `https://admin.shopify.com/store/${STORE}`;
const PRINTFUL = 'https://www.printful.com/dashboard';
const main = document.getElementById('main');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `$${Number(n) % 1 ? Number(n).toFixed(2) : Number(n)}`;
const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const idOf = (gid) => String(gid).split('/').pop();

async function shopify() {
  const query = `{ products(first: 100, sortKey: TITLE) { nodes {
    id handle title productType description availableForSale
    images(first: 1) { nodes { url } }
    options { name values }
    variants(first: 100) { nodes { title availableForSale price { amount } } }
    webFont: metafield(namespace: "custom", key: "web_font") { reference { ... on GenericFile { url } } }
    descriptor: metafield(namespace: "custom", key: "descriptor") { value }
  } } }`;
  const r = await fetch(`https://${SHOP.domain}/api/${SHOP.apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': SHOP.token },
    body: JSON.stringify({ query }),
  });
  const d = await r.json();
  if (d.errors) throw new Error(d.errors[0].message);
  return d.data.products.nodes;
}

const chip = (text, tone = '') => `<span class="chip ${tone}">${esc(text)}</span>`;
const priceRange = (p) => {
  const ps = p.variants.nodes.map((v) => Number(v.price.amount));
  const lo = Math.min(...ps), hi = Math.max(...ps);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
};
const actions = (p, path, extra = '') => `<div class="actions">
  <a class="btn" href="${ADMIN}/products/${idOf(p.id)}" target="_blank" rel="noopener">Edit in Shopify ↗</a>
  ${extra}
  ${path ? `<a class="link" href="${path}" target="_blank" rel="noopener">View on site ↗</a>` : ''}
</div>`;

function typePage(products) {
  const fonts = products.filter((p) => /typeface/i.test(p.productType));
  const rows = fonts.map((p) => {
    const name = p.title.replace(/\s+font$/i, '').trim();
    const local = TYPE.find((t) => key(t.name) === key(name));
    const fontUrl = p.webFont?.reference?.url;
    const onSite = !!(local || fontUrl);
    let family = local?.family;
    if (!family && fontUrl) {
      family = `shop-${key(name)}`;
      try { const ff = new FontFace(family, `url("${fontUrl}")`); document.fonts.add(ff); ff.load().catch(() => {}); } catch {}
    }
    const descriptor = p.descriptor?.value || local?.descriptor || '';
    const status = [
      onSite ? chip('On the site', 'ok') : chip('Hidden: add a Web font file', 'warn'),
      p.availableForSale ? '' : chip('Sold out', 'warn'),
      fontUrl && /\.(otf|ttf)(\?|$)/i.test(fontUrl) ? chip('Web font is a full desktop file: swap in a .woff2', 'warn') : '',
    ].join('');
    return `<article class="row">
      <div class="specimen" style="${family ? `font-family:'${esc(family)}'` : ''}">${esc(local?.display || name)}</div>
      <div class="info">
        <h2>${esc(name)}</h2>
        <dl>
          <dt>Price</dt><dd>${priceRange(p)}</dd>
          <dt>Descriptor</dt><dd>${descriptor ? esc(descriptor) : '<em>None: add one in the Descriptor field</em>'}</dd>
          <dt>Web font</dt><dd>${fontUrl ? 'Uploaded in Shopify' : local ? 'Built into the site' : '<em>Missing</em>'}</dd>
        </dl>
        <div class="chips">${status}</div>
        ${actions(p, onSite ? `/type/${local?.slug || key(name)}` : '')}
      </div>
    </article>`;
  }).join('');
  return `<section class="intro">
      <h1>Type</h1>
      <p>Every font here comes from Shopify. Change a name, price, descriptor or font file in Shopify and the site updates on its next load.</p>
      <p class="how">To add a font: create a product with Product type <code>typeface</code>, fill in <b>Web font</b> (a .woff2) and <b>Descriptor</b>, and publish it to the <b>Headless</b> channel.</p>
      <a class="btn" href="${ADMIN}/products/new" target="_blank" rel="noopener">Add a font in Shopify ↗</a>
    </section>
    <p class="count">${fonts.length} font${fonts.length === 1 ? '' : 's'} in Shopify</p>
    ${rows || '<p class="empty">No fonts are published to the Headless channel yet.</p>'}`;
}

function goodsPage(products) {
  const goods = products.filter((p) => !/typeface/i.test(p.productType));
  const shopKeys = new Set(goods.flatMap((p) => [p.handle, key(p.title)]));
  const rows = goods.map((p) => {
    const local = GOODS.find((g) => g.shopify === p.handle || key(g.name) === key(p.title) || g.slug === p.handle);
    const img = p.images.nodes[0]?.url;
    const opts = p.options.filter((o) => o.name !== 'Title');
    const forSale = p.variants.nodes.filter((v) => v.availableForSale).length;
    const status = [
      chip('On the site', 'ok'),
      p.availableForSale ? '' : chip('Sold out', 'warn'),
      forSale && forSale < p.variants.nodes.length ? chip(`${p.variants.nodes.length - forSale} option${p.variants.nodes.length - forSale === 1 ? '' : 's'} sold out`) : '',
      local ? chip('Uses the photos from the old site') : '',
    ].join('');
    return `<article class="row">
      <div class="thumb">${img ? `<img src="${esc(img)}&width=400" alt="" loading="lazy">` : ''}</div>
      <div class="info">
        <h2>${esc(p.title)}</h2>
        <dl>
          <dt>Price</dt><dd>${priceRange(p)}</dd>
          ${opts.map((o) => `<dt>${esc(o.name)}</dt><dd>${o.values.map(esc).join(', ')}</dd>`).join('')}
          <dt>Description</dt><dd>${p.description ? esc(p.description.slice(0, 220)) + (p.description.length > 220 ? '…' : '') : '<em>None</em>'}</dd>
        </dl>
        <div class="chips">${status}</div>
        ${actions(p, `/goods/${local?.slug || p.handle}`, `<a class="link" href="${PRINTFUL}" target="_blank" rel="noopener">Printful ↗</a>`)}
      </div>
    </article>`;
  }).join('');
  const archive = GOODS.filter((g) => !g.shopify && !shopKeys.has(g.slug) && !shopKeys.has(key(g.name)));
  const archiveRows = archive.map((g) => `<li><a href="/goods/${g.slug}" target="_blank" rel="noopener">${esc(g.name)}</a>${g.soldOut ? chip('Sold out') : ''}</li>`).join('');
  return `<section class="intro">
      <h1>Goods</h1>
      <p>Goods come from Shopify, where Printful publishes them. Photos, price, colours and sizes update on the site automatically.</p>
      <p class="how">To add a product: design it in Printful, publish it to Shopify, then tick the <b>Headless</b> channel under Publishing on the product.</p>
      <a class="btn" href="${PRINTFUL}" target="_blank" rel="noopener">Open Printful ↗</a>
      <a class="btn ghost" href="${ADMIN}/products?selectedView=all" target="_blank" rel="noopener">All products in Shopify ↗</a>
    </section>
    <p class="count">${goods.length} product${goods.length === 1 ? '' : 's'} in Shopify</p>
    ${rows || '<p class="empty">No goods are published to the Headless channel yet.</p>'}
    ${archive.length ? `<section class="archive"><h3>From the old site</h3>
      <p>These pieces were sold before the switch to Shopify and stay on the site as sold out. They aren't in Shopify, so ask Claude to change or remove them.</p>
      <ul>${archiveRows}</ul></section>` : ''}`;
}

let cache;
async function render() {
  const tab = location.hash === '#goods' ? 'goods' : 'type';
  document.querySelectorAll('[data-tab]').forEach((a) => a.setAttribute('aria-current', String(a.dataset.tab === tab)));
  document.title = `${tab === 'goods' ? 'Goods' : 'Type'} — trvco studio admin`;
  try {
    cache ??= await shopify();
    main.innerHTML = tab === 'goods' ? goodsPage(cache) : typePage(cache);
  } catch (err) {
    main.innerHTML = `<p class="empty">Couldn't reach Shopify (${esc(err.message)}). Try reloading.</p>`;
  }
}
addEventListener('hashchange', render);
render();
