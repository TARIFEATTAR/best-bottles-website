# PDF Catalog System

This subsystem generates print-grade catalogs with React templates, print CSS, and headless Chrome via Puppeteer.

## Architecture

- API route: `src/app/api/pdf/catalog/route.ts`
- Data layer: `src/lib/pdf/catalog/data.ts`
- Query parsing: `src/lib/pdf/catalog/query.ts`
- Print components: `src/lib/pdf/catalog/template.tsx`
- Print CSS: `src/lib/pdf/catalog/styles.ts`
- Chrome renderer: `src/lib/pdf/catalog/puppeteer.ts`

The route fetches Convex catalog data, normalizes it into print-safe records, renders React to static HTML, waits for fonts/images in headless Chrome, then returns a PDF with `printBackground` and `preferCSSPageSize`.

## Endpoint

`GET /api/pdf/catalog`

Common query params:

- `mode=lookbook|line-sheet|spec-book`
- `pageSize=letter|a4|square|presentation|luxury`
- `orientation=portrait|landscape`
- `category=Glass Bottle`
- `collection=Essential Oil Bottles`
- `family=Cylinder,Empire`
- `brand=Best Bottles`
- `applicators=rollon,finemist,dropper`
- `search=amber`
- `limit=240`
- `pricing=false`
- `index=false`
- `imageQuality=print|preview`
- `inline=true`
- `debug=true` to inspect HTML before PDF rendering

Examples:

```txt
/api/pdf/catalog?mode=lookbook&pageSize=luxury&family=Cylinder&limit=80
/api/pdf/catalog?mode=line-sheet&pageSize=letter&orientation=landscape&category=Glass%20Bottle
/api/pdf/catalog?mode=spec-book&pageSize=a4&applicators=finemist&pricing=false
```

## Print Layout

The CSS uses `@page` with zero browser margins and defines the actual page size in CSS. Each `.print-page` is fixed to the configured trim size, with an internal safe margin and bleed simulation for cover/divider treatments.

Pagination controls:

- Product cards use fixed image boxes and `break-inside: avoid`.
- Grids are chunked in React by page preset, so Chrome does not decide where a catalog card splits.
- Line sheets are chunked by row count.
- Spec books render two SKUs per page by default for large imagery and readable specs.
- Footers use CSS counters for running page numbers.

## Image Quality

Sanity CDN images are normalized with high-resolution print params: `fit=max`, `q=95`, and a wide render width for print mode. All print images are `loading="eager"` and `decoding="sync"`. Puppeteer waits for every image to either load or error before generating the PDF, preventing missing renders and layout jumps.

## Typography

The print document loads Cormorant, EB Garamond, and Inter through Google Fonts inside the isolated HTML document. Puppeteer waits for `document.fonts.ready`, so the generated PDF embeds the loaded web fonts instead of racing fallback fonts.

For stricter brand control, replace the Google Fonts import in `styles.ts` with self-hosted `@font-face` assets from `public/fonts`.

## Vercel Notes

Dependencies:

- `puppeteer-core`
- `@sparticuz/chromium`

The route runs in the Node.js runtime and is configured for a longer serverless window in `vercel.json`. Use Node 24 on Vercel for the installed Chromium package. For very large catalogs, consider Vercel Fluid Compute or a dedicated worker endpoint because 2,000+ high-resolution images can exceed normal request budgets.

Useful environment variables:

- `NEXT_PUBLIC_CONVEX_URL` or `CONVEX_URL`
- `PUPPETEER_EXECUTABLE_PATH` for local Chrome
- `PDF_RENDER_TIMEOUT_MS`, default `120000`
- `PDF_PROTOCOL_TIMEOUT_MS`, default `180000`
- `PDF_BROWSER_POOL=true` for local/stable long-running workers
- `CHROMIUM_PACK_URL` if hosting a remote Chromium pack

## Docker Recommendation

For the most predictable production rendering, run the catalog generator in a worker image with system Chrome installed and set:

```txt
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
PDF_BROWSER_POOL=true
```

Keep the Next.js API route as the public entrypoint, but hand very large jobs to the worker and return a signed URL when complete.

## Memory Strategy

- Default lookbook mode uses lightweight product groups.
- SKU-heavy modes page through Convex with `chunkSize`, capped by `limit`.
- The renderer closes Chrome per request on serverless to avoid leaking memory.
- For catalogs above a few hundred pages, generate section PDFs independently and merge in a background worker.
- Use `imageQuality=preview` for fast internal drafts.

## Testing

Current tests cover option parsing and filter behavior:

```bash
npx vitest run tests/pdf-catalog.test.ts
```

Manual verification:

1. Start the app with `npm run dev`.
2. Open `/api/pdf/catalog?debug=true&limit=12` and inspect layout HTML.
3. Open `/api/pdf/catalog?inline=true&limit=12` and verify PDF output.
4. Test a line sheet: `/api/pdf/catalog?mode=line-sheet&orientation=landscape&limit=60`.
5. Check the PDF at 100% zoom for cropped edges, image sharpness, page breaks, and font embedding.
