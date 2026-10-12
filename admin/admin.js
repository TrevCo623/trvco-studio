// trvco studio admin: Decap CMS plus two live sections, Type and Goods, built from what's in
// the Shopify store each time the admin opens. Each font and product shows what the site is
// pulling from Shopify, with a button straight to that product in Shopify, plus any site-only
// settings (Type: how the name is shown; Goods: your own photos and copy).
/* global CMS, jsyaml, h, createClass */

const SHOP = { domain: 'trvcostudio.myshopify.com', token: '79322106676146621e95872ea4af1f11', store: 'trvcostudio' };
const shopData = new Map(); // handle -> product
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const productId = (gid) => String(gid).split('/').pop();
const shopifyEditUrl = (p) => `https://admin.shopify.com/store/${SHOP.store}/products/${productId(p.id)}`;
const money = (n) => `$${Number(n) % 1 ? Number(n).toFixed(2) : Number(n)}`;

async function fetchShop() {
  const query = `{ products(first: 150) { nodes {
    id handle title productType description availableForSale onlineStoreUrl
    images(first: 4) { nodes { url } }
    variants(first: 100) { nodes { title availableForSale price { amount } } }
    webFont: metafield(namespace: "custom", key: "web_font") { reference { ... on GenericFile { url } } }
    descriptor: metafield(namespace: "custom", key: "descriptor") { value }
  } } }`;
  const res = await fetch(`https://${SHOP.domain}/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': SHOP.token },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data.products.nodes;
}

// ── Read-only "From Shopify" panel ───────────────────────────────────────────
const ShopifyInfo = createClass({
  render() {
    const field = this.props.field;
    const p = shopData.get(field.get('handle'));
    const kind = field.get('kind');
    if (!p) {
      return h('div', { className: 'trv-shop trv-shop--none' },
        h('p', null, kind === 'goods'
          ? 'Not in Shopify. This page shows on the site as sold out (an archive piece). To sell it, publish it from Printful to Shopify and the Headless storefront.'
          : 'This font isn\'t visible in Shopify right now.'),
        h('a', { className: 'trv-btn', href: `https://admin.shopify.com/store/${SHOP.store}/products`, target: '_blank', rel: 'noopener' }, 'Open Shopify products ↗'));
    }
    const prices = p.variants.nodes.map((v) => Number(v.price.amount));
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const price = lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
    const forSale = p.variants.nodes.filter((v) => v.availableForSale);
    const rows = [
      ['Name', p.title],
      ['Price', price],
      ['Status', p.availableForSale ? 'For sale' : 'Sold out'],
    ];
    if (kind === 'type') {
      rows.push(['Descriptor', p.descriptor?.value || '— (add one in Shopify: Descriptor field)']);
      rows.push(['Web font', p.webFont?.reference?.url ? h('a', { href: p.webFont.reference.url, target: '_blank', rel: 'noopener' }, decodeURIComponent(p.webFont.reference.url.split('/').pop().split('?')[0])) : '— missing: upload one in Shopify (Web font field) or the font won\'t show on the site']);
    } else {
      if (p.variants.nodes.length > 1) rows.push(['Options', p.variants.nodes.map((v) => v.title + (v.availableForSale ? '' : ' (sold out)')).join(', ')]);
      rows.push(['Description', p.description ? p.description.slice(0, 220) + (p.description.length > 220 ? '…' : '') : '—']);
    }
    const slug = field.get('slug');
    return h('div', { className: 'trv-shop' },
      h('dl', null, ...rows.flatMap(([k, v]) => [h('dt', { key: k + 't' }, k), h('dd', { key: k + 'd' }, v)])),
      kind === 'goods' && p.images.nodes.length ? h('div', { className: 'trv-shop-photos' }, ...p.images.nodes.map((im, i) => h('img', { key: i, src: im.url + (im.url.includes('?') ? '&' : '?') + 'width=240', alt: '' }))) : null,
      h('div', { className: 'trv-shop-actions' },
        h('a', { className: 'trv-btn trv-btn--primary', href: shopifyEditUrl(p), target: '_blank', rel: 'noopener' }, 'Edit in Shopify ↗'),
        kind === 'goods' ? h('a', { className: 'trv-btn', href: 'https://www.printful.com/dashboard/store', target: '_blank', rel: 'noopener' }, 'Open Printful ↗') : null,
        h('a', { className: 'trv-btn', href: `/${kind}/${slug}`, target: '_blank', rel: 'noopener' }, 'View on site ↗')),
      h('p', { className: 'trv-shop-note' }, kind === 'type'
        ? 'Name, price, descriptor and the font file are managed in Shopify. Changes there show on the site on the next page load.'
        : 'Price, options and stock come from Shopify (via Printful). Changes there show on the site on the next page load.'));
  },
});
CMS.registerWidget('shopify-info', ShopifyInfo, () => null);

// ── Build the config: Type and Goods from Shopify, then Print and Digital ─────
(async () => {
  const [configText, index, products] = await Promise.all([
    fetch('/admin/config.yml', { cache: 'no-cache' }).then((r) => r.text()),
    fetch('/admin/site-index.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({ goods: [], type: [] })),
    fetchShop().catch((e) => { console.warn('Shopify unavailable', e); return []; }),
  ]);
  const config = jsyaml.load(configText);
  products.forEach((p) => shopData.set(p.handle, p));
  const fonts = products.filter((p) => p.productType.toLowerCase() === 'typeface');
  const goods = products.filter((p) => p.productType.toLowerCase() !== 'typeface');
  const info = (handle, kind, slug) => ({ label: 'From Shopify', name: 'shopify', widget: 'shopify-info', required: false, handle, kind, slug });

  const typeCollection = {
    name: 'type', label: 'Type', label_singular: 'font', editor: { preview: false },
    description: 'Your fonts, straight from Shopify. Add a font in Shopify (Product type: typeface, with a Web font file) and publish it to Headless — it appears here and on the site.',
    files: fonts.map((p) => {
      const slug = norm(p.title.replace(/\s+font$/i, ''));
      return {
        name: slug, label: p.title.replace(/\s+font$/i, ''), file: `content/type/${slug}.json`,
        fields: [
          info(p.handle, 'type', slug),
          { label: 'Word shown on the site', name: 'display', widget: 'string', required: false, hint: 'How the name appears in the carousel and thumbnail. Leave empty for the name in capitals.' },
          { label: 'Sentence case specimen', name: 'lowercase', widget: 'boolean', required: false, hint: 'Show the sample lines in sentence case (for fonts with lowercase letters).' },
          { label: 'Carousel size (px)', name: 'hero_size', widget: 'number', value_type: 'int', required: false, hint: 'Leave empty to size automatically. Typical: 80–150.' },
        ],
      };
    }),
  };

  // Goods: every Shopify product, matched to your own page when there is one, plus archive pieces.
  const pages = [...(index.goods || [])];
  const used = new Set();
  const goodsFiles = goods.map((p) => {
    const page = pages.find((g) => g.shopify === p.handle || norm(g.name) === norm(p.title) || norm(g.title) === norm(p.title) || g.slug === p.handle);
    if (page) used.add(page.slug);
    const slug = page ? page.slug : p.handle;
    return goodsFile(slug, p.title, p.handle, true);
  });
  pages.filter((g) => !used.has(g.slug)).forEach((g) => goodsFiles.push(goodsFile(g.slug, `${g.name} (archive)`, null, false)));
  function goodsFile(slug, label, handle, inShop) {
    return {
      name: slug, label, file: `content/goods/${slug}.json`,
      fields: [
        info(handle, 'goods', slug),
        { label: 'Thumbnail name', name: 'name', widget: 'string', required: !inShop, hint: inShop ? 'Optional. Leave empty to use the Shopify name.' : '' },
        { label: 'Page title', name: 'title', widget: 'string', required: !inShop, hint: inShop ? 'Optional. Leave empty to use the Shopify name.' : '' },
        { label: 'Description', name: 'description', widget: 'text', required: false, hint: inShop ? 'Optional. Leave empty to use the Shopify description. A blank line starts a new paragraph.' : 'A blank line starts a new paragraph.' },
        { label: 'Photos', name: 'photos', widget: 'list', required: false, field: { label: 'Photo', name: 'photo', widget: 'image' }, hint: inShop ? 'Optional. Leave empty to use the Printful mockups from Shopify. The first photo is the thumbnail.' : 'The first photo is the thumbnail.' },
        ...(inShop ? [{ label: 'Shopify handle', name: 'shopify_handle', widget: 'hidden', default: handle }] : [{ label: 'Sold out', name: 'sold_out', widget: 'boolean', required: false, default: true }]),
        { label: 'Order', name: 'order', widget: 'number', value_type: 'int', required: false, hint: 'Lower numbers come first in Goods.' },
        { label: 'Hidden', name: 'draft', widget: 'boolean', required: false, default: false, hint: 'Hide this from the site without deleting it.' },
      ],
    };
  }
  const goodsCollection = {
    name: 'goods', label: 'Goods', label_singular: 'product', editor: { preview: false },
    description: 'Products from Shopify (made by Printful) and your archive pieces. Price, options and stock live in Shopify; photos and copy can be set here.',
    files: goodsFiles,
  };

  config.collections = [typeCollection, goodsCollection, ...config.collections].filter((c) => !c.files || c.files.length);
  config.load_config_file = false;
  if (window.TRV_TEST_BACKEND) config.backend = { name: 'test-repo' }; // local preview only
  CMS.init({ config });
})();
