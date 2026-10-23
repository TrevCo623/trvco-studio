// trvco studio admin: Decap CMS plus two live sections, Type and Goods, built from what's in
// the Shopify store each time the admin opens. Each font and product shows what the site is
// pulling from Shopify, with a button straight to that product in Shopify, plus any site-only
// settings (Type: how the name is shown; Goods: your own photos and copy).
/* global CMS, jsyaml, h, createClass */

const SHOP = { domain: 'trvcostudio.myshopify.com', token: '79322106676146621e95872ea4af1f11', store: 'trvcostudio' };
const shopData = new Map(); // handle -> product
const builtIn = new Set(); // fonts whose files live in the site itself
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
      rows.push(['Web font', builtIn.has(p.handle) && !p.webFont?.reference?.url ? 'Built into the site (no upload needed)' : p.webFont?.reference?.url ? h('a', { href: p.webFont.reference.url, target: '_blank', rel: 'noopener' }, decodeURIComponent(p.webFont.reference.url.split('/').pop().split('?')[0])) : '— missing: upload one in Shopify (Web font field) or the font won\'t show on the site']);
    } else {
      if (p.variants.nodes.length > 1) rows.push(['Options', p.variants.nodes.map((v) => v.title + (v.availableForSale ? '' : ' (sold out)')).join(', ')]);
      rows.push(['Description', p.description ? p.description.slice(0, 220) + (p.description.length > 220 ? '…' : '') : '—']);
    }
    const slug = field.get('slug');
    return h('div', { className: 'trv-shop' },
      h('p', { className: 'trv-shop-note' }, kind === 'type'
        ? 'Name, price, descriptor and the font file are managed in Shopify. Changes there show on the site on the next page load.'
        : 'Price, options and stock come from Shopify (via Printful). Changes there show on the site on the next page load.'),
      h('dl', null, ...rows.flatMap(([k, v]) => [h('dt', { key: k + 't' }, k), h('dd', { key: k + 'd' }, v)])),
      kind === 'goods' && p.images.nodes.length ? h('div', { className: 'trv-shop-photos' }, ...p.images.nodes.map((im, i) => h('img', { key: i, src: im.url + (im.url.includes('?') ? '&' : '?') + 'width=240', alt: '' }))) : null,
      h('div', { className: 'trv-shop-actions' },
        h('a', { className: 'trv-btn trv-btn--primary', href: shopifyEditUrl(p), target: '_blank', rel: 'noopener' }, 'Edit in Shopify ↗'),
        kind === 'goods' ? h('a', { className: 'trv-btn', href: 'https://www.printful.com/dashboard/store', target: '_blank', rel: 'noopener' }, 'Open Printful ↗') : null,
        h('a', { className: 'trv-btn', href: `/${kind}/${slug}`, target: '_blank', rel: 'noopener' }, 'View on site ↗')));
  },
});
CMS.registerWidget('shopify-info', ShopifyInfo, () => null);

// ── Photos widget: pick or drop many images at once, see real thumbnails, drag to reorder ──
// Images are resized in the browser (2000 px max, WebP, or JPEG where the browser can't make WebP)
// and saved straight to the repo in one commit, so "Publish" only has to save the list of paths.
const REPO = 'TrevCo623/trvco-studio', RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const ghToken = () => { for (const k of ['decap-cms-user', 'netlify-cms-user']) { try { const t = JSON.parse(localStorage.getItem(k))?.token; if (t) return t; } catch {} } return null; };
async function gh(path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, { ...opts, headers: { ...(ghToken() ? { Authorization: `token ${ghToken()}` } : {}), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}
async function commitFiles(files, message) {   // files: [{ path, base64 }] -> one commit on main
  const ref = await gh('/git/ref/heads/main');
  const base = await gh(`/git/commits/${ref.object.sha}`);
  const tree = await Promise.all(files.map(async (f) => ({ path: f.path, mode: '100644', type: 'blob',
    sha: (await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: f.base64, encoding: 'base64' }) })).sha })));
  const t = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
  const c = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: t.sha, parents: [ref.object.sha] }) });
  await gh('/git/refs/heads/main', { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
}
async function prepare(file) {                   // resize + re-encode; returns { name, blob }
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  let blob = await new Promise((r) => cv.toBlob(r, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.88));
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const stem = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photo';
  return { name: `${stem}-${Date.now().toString(36).slice(-4)}.${ext}`, blob };
}
const b64 = (blob) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
const thumbUrl = (path) => /^https?:/.test(path) ? path : `${RAW}${path.startsWith('/') ? '' : '/'}${path}`;
const toList = (v) => (v == null ? [] : v.toJS ? v.toJS() : Array.isArray(v) ? v : [v]).filter(Boolean);

// Options on the field: multiple (many photos), captions (a paragraph under each photo; saved as
// [{ image, text }]), tags (labels for the first photos, e.g. [Thumbnail, Hero]).
const Photos = createClass({
  getInitialState() { return { local: {}, busy: 0, error: '', drag: null, over: false }; },
  multiple() { return !!this.props.field.get('multiple'); },
  captions() { return !!this.props.field.get('captions'); },
  tags() { const t = this.props.field.get('tags'); return t ? (t.toJS ? t.toJS() : t) : (this.multiple() && !this.captions() ? ['Thumbnail'] : []); },
  items() { return toList(this.props.value).map((x) => typeof x === 'string' ? { path: x, text: '' } : { path: x.image || '', text: x.text || '' }).filter((x) => x.path || x.text); },
  set(items) {
    const out = this.captions() ? items.map((i) => ({ image: i.path, text: i.text || '' })) : items.map((i) => i.path);
    this.props.onChange(this.multiple() ? out : (out[0] || ''));
  },
  async add(files) {
    files = [...files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    if (!this.multiple()) files = files.slice(0, 1);
    if (!ghToken() && !window.TRV_TEST_BACKEND) { this.setState({ error: 'Sign in again to upload.' }); return; }
    this.setState((s) => ({ busy: s.busy + files.length, error: '' }));
    try {
      const prepared = await Promise.all(files.map(prepare));
      const local = { ...this.state.local };
      const added = prepared.map((p) => { const path = `/assets/uploads/${p.name}`; local[path] = URL.createObjectURL(p.blob); return { path, text: '' }; });
      this.setState({ local });
      if (!window.TRV_TEST_BACKEND) await commitFiles(await Promise.all(prepared.map(async (p) => ({ path: `assets/uploads/${p.name}`, base64: await b64(p.blob) }))),
        `Upload ${prepared.length} photo${prepared.length > 1 ? 's' : ''}`);
      this.set(this.multiple() ? [...this.items(), ...added] : added);
    } catch (e) { this.setState({ error: `Upload failed. ${e.message}` }); }
    this.setState((s) => ({ busy: Math.max(0, s.busy - files.length) }));
  },
  remove(i) { const l = this.items(); l.splice(i, 1); this.set(l); },
  move(from, to) { const l = this.items(); const [x] = l.splice(from, 1); l.splice(to, 0, x); this.set(l); },
  text(i, t) { const l = this.items(); l[i] = { ...l[i], text: t }; this.set(l); },
  render() {
    const items = this.items(), multi = this.multiple(), caps = this.captions(), tags = this.tags(), { busy, error, over, drag } = this.state;
    const pick = () => this.input && this.input.click();
    return h('div', {
      className: 'trv-photos' + (over ? ' is-over' : '') + (caps ? ' has-captions' : ''),
      onDragOver: (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); this.setState({ over: true }); } },
      onDragLeave: () => this.setState({ over: false }),
      onDrop: (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); this.setState({ over: false }); this.add(e.dataTransfer.files); } },
    },
      items.length ? h('div', { className: 'trv-photos-grid' }, ...items.map((it, i) => h('figure', {
        key: it.path + i, className: 'trv-photo' + (drag === i ? ' is-drag' : ''),
        onDragOver: (e) => { if (this.state.drag != null) e.preventDefault(); },
        onDrop: (e) => { if (this.state.drag != null) { e.preventDefault(); e.stopPropagation(); this.move(this.state.drag, i); this.setState({ drag: null }); } },
      },
        h('div', { className: 'trv-photo-img', draggable: multi,
          onDragStart: (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); this.setState({ drag: i }); },
          onDragEnd: () => this.setState({ drag: null }) },
          it.path ? h('img', { src: this.state.local[it.path] || thumbUrl(it.path), alt: '', onError: (e) => { const s = location.origin + (it.path.startsWith('/') ? '' : '/') + it.path; if (e.target.src !== s) e.target.src = s; } }) : null,
          multi && tags[i] ? h('span', { className: 'trv-photo-tag' }, tags[i]) : null,
          caps ? h('span', { className: 'trv-photo-num' }, String(i + 1)) : null,
          h('button', { type: 'button', className: 'trv-photo-x', 'aria-label': 'Remove photo', onClick: () => this.remove(i) }, '×')),
        caps ? h('textarea', { className: 'trv-photo-text', rows: 3, placeholder: 'Write the line that goes with this image…', value: it.text, onChange: (e) => this.text(i, e.target.value) }) : null))) : null,
      h('div', { className: 'trv-photos-bar' },
        h('button', { type: 'button', className: 'trv-btn', onClick: pick, disabled: busy > 0 },
          busy ? `Uploading ${busy} photo${busy > 1 ? 's' : ''}…` : multi ? (items.length ? 'Add photos' : 'Choose photos') : (items.length ? 'Replace photo' : 'Choose photo')),
        h('span', { className: 'trv-photos-hint' }, multi ? 'or drop them here · drag to reorder' : 'or drop one here'),
        error ? h('span', { className: 'trv-photos-error' }, error) : null),
      h('input', { type: 'file', accept: 'image/*', multiple: multi, hidden: true, ref: (el) => { this.input = el; },
        onChange: (e) => { this.add(e.target.files); e.target.value = ''; } }));
  },
});
CMS.registerWidget('photos', Photos, () => null);

// ── Position widget: the whole page as a list; drag this project (or any other) into place ──
// Dropping renumbers every project 1, 2, 3… This project's number saves when you Publish; the
// others are saved straight away in one commit, so the page order is exactly what you see.
const enc = (str) => btoa(unescape(encodeURIComponent(str)));
const dec = (b) => decodeURIComponent(escape(atob(b.replace(/\n/g, ''))));
const firstPhoto = (d) => [].concat(d.images || [], d.photos || [], d.thumbnail || [], d.hero || []).find((x) => typeof x === 'string' && x);
const Position = createClass({
  getInitialState() { return { rows: null, error: '', drag: null, saving: false }; },
  folder() { return this.props.field.get('folder'); },
  selfSlug() { return this.props.entry && this.props.entry.get('slug'); },
  async componentDidMount() {
    try {
      const dir = await gh(`/contents/${this.folder()}?ref=main`);
      const files = await Promise.all(dir.filter((f) => f.name.endsWith('.json')).map(async (f) => {
        const j = await gh(`/contents/${f.path}?ref=main`);
        const text = dec(j.content); const data = JSON.parse(text);
        return { slug: f.name.replace(/\.json$/, ''), path: f.path, data, title: data.title || data.name || f.name, order: data.order, hidden: !!data.draft, thumb: firstPhoto(data) };
      }));
      const self = this.selfSlug();
      const others = files.filter((r) => r.slug !== self)
        .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.title).localeCompare(String(b.title)));
      const mine = { self: true };
      const want = Number(this.props.value);
      const at = Number.isFinite(want) && want > 0 ? Math.min(others.length, want - 1) : others.length;
      others.splice(at, 0, mine);
      this.setState({ rows: others });
      if (!(want > 0)) this.props.onChange(at + 1);
    } catch (e) { this.setState({ error: e.message }); }
  },
  async drop(to) {
    const { drag, rows } = this.state; if (drag == null || drag === to) return this.setState({ drag: null });
    const next = rows.slice(); const [x] = next.splice(drag, 1); next.splice(to, 0, x);
    this.setState({ rows: next, drag: null });
    const changed = [];
    next.forEach((r, i) => {
      if (r.self) { this.props.onChange(i + 1); return; }
      if (r.order !== i + 1) { r.order = i + 1; r.data = { ...r.data, order: i + 1 }; changed.push(r); }
    });
    if (!changed.length) return;
    this.setState({ saving: true, error: '' });
    try {
      if (window.TRV_TEST_BACKEND) window.TRV_LAST_REORDER = changed.map((r) => [r.slug, r.order]);
      else await commitFiles(changed.map((r) => ({ path: r.path, base64: enc(JSON.stringify(r.data, null, 2) + '\n') })), `Reorder ${this.folder().split('/').pop()}`);
    } catch (e) { this.setState({ error: `Couldn't save the new order. ${e.message}` }); }
    this.setState({ saving: false });
  },
  render() {
    const { rows, error, drag, saving } = this.state;
    const d = this.props.entry ? this.props.entry.get('data') : null;
    const data = d && d.toJS ? d.toJS() : {};
    const myTitle = data.title || data.name || 'This project';
    const myThumb = firstPhoto(data);
    if (!rows) return h('div', { className: 'trv-pos' }, h('p', { className: 'trv-pos-note' }, error || 'Loading the page…'));
    return h('div', { className: 'trv-pos' },
      h('ol', { className: 'trv-pos-list' }, ...rows.map((r, i) => {
        const thumb = r.self ? myThumb : r.thumb;
        return h('li', {
          key: r.self ? '__self' : r.slug, draggable: true,
          className: 'trv-pos-row' + (r.self ? ' is-self' : '') + (drag === i ? ' is-drag' : '') + (r.hidden ? ' is-hidden' : ''),
          onDragStart: (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); this.setState({ drag: i }); },
          onDragOver: (e) => { if (this.state.drag != null) e.preventDefault(); },
          onDrop: (e) => { e.preventDefault(); this.drop(i); },
          onDragEnd: () => this.setState({ drag: null }),
        },
          h('span', { className: 'trv-pos-num' }, String(i + 1)),
          h('span', { className: 'trv-pos-thumb' }, thumb ? h('img', { src: thumbUrl(thumb), alt: '', onError: (e) => { const u = location.origin + (thumb.startsWith('/') ? '' : '/') + thumb; if (e.target.src !== u) e.target.src = u; } }) : null),
          h('span', { className: 'trv-pos-title' }, r.self ? myTitle : r.title),
          r.self ? h('span', { className: 'trv-pos-tag' }, 'This project') : r.hidden ? h('span', { className: 'trv-pos-tag is-muted' }, 'Hidden') : null,
          h('span', { className: 'trv-pos-grip', 'aria-hidden': true }, '⋮⋮'));
      })),
      h('p', { className: 'trv-pos-note' }, saving ? 'Saving the new order…' : error || 'Drag to reorder. Top of the list shows first on the page.'));
  },
});
CMS.registerWidget('position', Position, () => null);

// ── Build the config: Type and Goods from Shopify, then Print and Digital ─────
(async () => {
  const [configText, index, products] = await Promise.all([
    fetch('/admin/config.yml', { cache: 'no-cache' }).then((r) => r.text()),
    fetch('/admin/site-index.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({ goods: [], type: [] })),
    fetchShop().catch((e) => { console.warn('Shopify unavailable', e); return []; }),
  ]);
  const config = jsyaml.load(configText);
  products.forEach((p) => shopData.set(p.handle, p));
  (index.builtInFonts || []).forEach((hd) => builtIn.add(hd));
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
          { label: 'Details', name: 'details', widget: 'photos', multiple: true, captions: true, required: false, hint: 'The image-and-paragraph carousel on the font’s page. Drop all the images at once, write a line under each, and drag to reorder.' },
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
        { label: 'Photos', name: 'photos', widget: 'photos', multiple: true, required: false, hint: inShop ? 'Optional. Leave empty to use the Printful mockups from Shopify. The first photo is the thumbnail.' : 'The first photo is the thumbnail.' },
        ...(inShop ? [{ label: 'Shopify handle', name: 'shopify_handle', widget: 'hidden', default: handle }] : [{ label: 'Sold out', name: 'sold_out', widget: 'boolean', required: false, default: true }]),
        { label: 'Position on the Goods page', name: 'order', widget: 'position', folder: 'content/goods', required: false },
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
