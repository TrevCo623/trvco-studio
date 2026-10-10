# trvco.studio

A hand-built, one-page-app version of trvco.studio, made from the Figma file. Plain HTML, CSS and JavaScript, with no framework and no build step.

## How it's hosted

- This repo is the site. **Netlify** publishes it: every change pushed to `main` goes live at trvco.studio in under a minute.
- `specimen.css` and `specimen.js` are the old font tester for the Squarespace site (served by GitHub Pages). Leave them until Squarespace is cancelled.
- To preview locally, double-click `start.command` (needs Node.js), then open http://localhost:8080.

## Where things live

| To change… | Edit |
|---|---|
| Any copy, product, price, font, project, or the homepage order | `js/data.js` |
| Type tile colours (placeholder palette) | `tile` and `ink` on each font in `js/data.js` |
| Fonts | Drop files in `assets/fonts/`, add a line to `css/fonts.css` |
| Colours, spacing, type styles | Top of `css/site.css` (the tokens match the Figma variables) |
| Behaviour (nav, filters, carousel, transitions) | `js/app.js` |

## How the pages work

- **Home `/`**: a masonry grid of all the work. The nav sits under the headline. When you scroll past it, it hands off to the header.
- **Filters `/type` `/digital` `/print` `/goods`**: the hero and other work fade out, the nav flies up to the header, the page returns to the top, and the matching tiles glide into place. Clicking the active filter again clears it.
- **Type `/type/:font`**: the Product Nav, then a carousel with the previous and next fonts at the edges. Hovering one pulls it in and tints it; clicking it slides the carousel (arrow keys work too). The glyph tester and details below swap to the new font. The Glyphs, Sizes and Custom tabs all work.
- **Goods `/goods/:item`**: the Product Nav (with a colour picker when an item has variants), then the title, copy and stacked images.
- **Print `/print/:item`**: the same template, without the Product Nav.
- **Digital `/digital/:project`**: the case-study template. Feel Good and Storyright are built.
- Between pages, the content fades out and in while the nav stays put.

## Cart and checkout

- **`/cart`** lists what's in the cart (kept in the visitor's browser). Goods have a quantity stepper. Fonts are one license each.
- **Checkout** sends the cart to Shopify, which handles payment, tax, shipping, Printify orders and font downloads.
- **`/license`** shows the font license. The text lives in `js/license.js`.

### Connecting Shopify

1. In Shopify, add the **Headless** sales channel and create a storefront. Copy its **public** Storefront API access token.
2. Put your store domain (`something.myshopify.com`) and that token into `js/shop.js`.
3. Give each Shopify product the same **handle** as its slug on this site (e.g. `go-outside-hat`, `oxomoco`). If a handle has to differ, add `shopify: 'the-handle'` to that product in `js/data.js`.
4. Variant names in Shopify must match the option names in `js/data.js` (Black, Navy, Spruce…).

Until step 2 is done, Checkout shows "Checkout opens once the shop is connected."

## Deploying

Netlify publishes the repo root as-is (no build step). `_redirects` handles: deep links, plus 301s from the old Squarespace URLs (`/goods/p/…`, `/feelgoodapp`, `/storyright`).

## Not done yet

- **Checkout** needs the Shopify store connected (see above).
- **Font license** is a draft. Have it reviewed before launch.
- **Fonts.** These are the current files from the live site. Swap in your final set.
- **Print titles and descriptions** are placeholders.
- **Font prices** are $10 across the board. Only Oxomoco's price came from the design.
- **Body text** uses Crimson Pro, from Google Fonts, to match the Figma file. Freight Text Pro needs an Adobe Fonts web project.
