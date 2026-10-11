// Shopify connection for checkout.
//
// The cart lives on this site (in the visitor's browser). When they press Checkout, the cart is
// sent to Shopify, and Shopify takes over: payment, tax, shipping, Printify fulfilment and font
// downloads all happen there.
//
// To connect a store, fill in the two values below (see README → "Connecting Shopify"):
//   domain: your store's myshopify domain, e.g. 'trvco-studio.myshopify.com'
//   token:  the public Storefront API access token from the Headless channel
// Both are safe to publish; the Storefront token can only read products and create carts.
export const SHOP = {
  domain: 'trvcostudio.myshopify.com',
  token: '79322106676146621e95872ea4af1f11',
  apiVersion: '2025-07',
};

export const shopReady = () => !!(SHOP.domain && SHOP.token);

async function gql(query, variables) {
  const res = await fetch(`https://${SHOP.domain}/api/${SHOP.apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': SHOP.token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify responded ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// Each product on this site points at a Shopify product by handle (the slug, unless a product
// in data.js sets `shopify: 'other-handle'`). Variants are matched by name ("Black", "Navy"…);
// a product with a single variant just uses that one.
const variantCache = new Map();
async function variantsFor(handle) {
  if (!variantCache.has(handle)) {
    variantCache.set(handle, gql(
      `query($h: String!) { product(handle: $h) { variants(first: 100) { nodes { id title availableForSale } } } }`,
      { h: handle },
    ).then((d) => d.product?.variants.nodes || null));
  }
  return variantCache.get(handle);
}

// lines: [{ handle, variant, qty, name }] → the Shopify checkout URL
export async function checkoutUrl(lines) {
  const resolved = [];
  for (const l of lines) {
    const vs = await variantsFor(l.handle);
    if (!vs?.length) throw new Error(`${l.name} isn't set up in the shop yet.`);
    const v = l.variant ? vs.find((x) => x.title.toLowerCase() === l.variant.toLowerCase()) : vs[0];
    if (!v) throw new Error(`${l.name} (${l.variant}) isn't set up in the shop yet.`);
    if (!v.availableForSale) throw new Error(`${l.name}${l.variant ? ` (${l.variant})` : ''} just sold out.`);
    resolved.push({ merchandiseId: v.id, quantity: l.qty });
  }
  const d = await gql(
    `mutation($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { checkoutUrl } userErrors { message } } }`,
    { lines: resolved },
  );
  const err = d.cartCreate.userErrors?.[0];
  if (err) throw new Error(err.message);
  return d.cartCreate.cart.checkoutUrl;
}

// ── The Type catalog comes from Shopify ─────────────────────────────────────────
// Every product whose Product type is "typeface" (and is published to the Headless
// storefront) is listed on the site. Two optional product fields (metafields) fill in
// what Shopify doesn't have on its own:
//   custom.web_font    File: the font file the site displays (.woff2, .woff or .otf)
//   custom.descriptor  Single line text: the one-liner under the name ("A fun, flowy slab")
// If Shopify can't be reached, the site falls back to the list in js/data.js.
export async function fetchTypeCatalog(timeoutMs = 2500) {
  if (!shopReady()) return null;
  const query = `{ products(first: 100, query: "product_type:typeface") { nodes {
    handle title description availableForSale
    variants(first: 1) { nodes { price { amount } } }
    webFont: metafield(namespace: "custom", key: "web_font") { reference { ... on GenericFile { url } ... on MediaImage { image { url } } } }
    descriptor: metafield(namespace: "custom", key: "descriptor") { value }
  } } }`;
  try {
    const d = await Promise.race([gql(query), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), timeoutMs))]);
    return d.products.nodes.map((p) => ({
      handle: p.handle,
      name: p.title.replace(/\s+font$/i, '').trim(),
      price: Number(p.variants.nodes[0]?.price.amount) || null,
      available: p.availableForSale,
      fontUrl: p.webFont?.reference?.url || null,
      descriptor: p.descriptor?.value || p.description.split(/(?<=[.!?])\s/)[0].trim() || '',
    }));
  } catch (err) {
    console.warn('[trvco] Shopify catalog unavailable, using the built-in list.', err.message);
    return null;
  }
}
