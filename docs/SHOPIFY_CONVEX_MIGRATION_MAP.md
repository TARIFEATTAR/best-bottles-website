# Shopify + Convex Migration Map

Reference document for the Best Bottles commerce migration.
Shopify Plus = source of truth for commerce.
Convex = derived intelligence/app layer for Grace AI + fast UI.
Sanity = editorial content + visual assets.

---

## Part 1: Field-by-Field Ownership Map

### `productGroups` table (~230 rows)

| Field | Current Owner | After Migration | Shopify Mapping | Notes |
|---|---|---|---|---|
| `slug` | Convex | **Shopify** | `product.handle` | Shopify handle becomes the canonical URL key |
| `displayName` | Convex | **Shopify** | `product.title` | Synced to Convex mirror for Grace search |
| `family` | Convex | **Shopify metafield** | `product.metafields.custom.bottle_family` | Bottle family taxonomy (Cylinder, Elegant, etc.) |
| `capacity` | Convex | **Shopify metafield** | `product.metafields.custom.capacity_label` | Human-readable e.g. "9 ml" |
| `capacityMl` | Convex | **Shopify metafield** | `product.metafields.custom.capacity_ml` (integer) | Numeric for filtering/sorting |
| `color` | Convex | **Shopify** | `product.options[].values` (Glass Color option) | Native Shopify option |
| `category` | Convex | **Shopify** | `product.product_type` | "Glass Bottle", "Component", "Aluminum Bottle", etc. |
| `bottleCollection` | Convex | **Shopify** | `product.collections[]` via custom collection membership | Mapped to Shopify collections |
| `neckThreadSize` | Convex | **Shopify metafield** | `product.metafields.custom.neck_thread_size` | Critical for fitment; mirrored to Convex |
| `variantCount` | Convex | **Convex derived** | Computed from Shopify variant count | Convex computes on webhook sync |
| `priceRangeMin` | Convex | **Shopify** | Computed from `variants[].price` | Convex mirrors for fast catalog; Shopify is authoritative |
| `priceRangeMax` | Convex | **Shopify** | Computed from `variants[].price` | Same |
| `shopifyProductId` | Convex (optional) | **Shopify** | `product.id` (GID) | Becomes required; written by webhook sync |
| `sanitySlug` | Convex | **Convex** | N/A | Editorial layer, Convex-owned |
| `heroImageUrl` | Convex | **Shopify** | `product.images[0].src` | Shopify image CDN becomes primary |
| `applicatorTypes` | Convex | **Shopify metafield** | `product.metafields.custom.applicator_types` (list) | e.g. ["Metal Roller", "Fine Mist Sprayer"] |
| `primaryGraceSku` | Convex | **Convex derived** | Computed from first variant's SKU | Convex derives from Shopify variant data |
| `primaryWebsiteSku` | Convex | **Convex derived** | Same | Legacy field; may retire |
| `groupDescription` | Convex | **Shopify** | `product.body_html` or metafield | SEO description lives in Shopify |
| `paperDollFamilyKey` | Convex | **Convex** | N/A | Sanity Paper Doll integration, Convex-owned |

### `products` table (~2,354 rows — individual SKU variants)

| Field | Current Owner | After Migration | Shopify Mapping | Notes |
|---|---|---|---|---|
| **Identity** | | | | |
| `productId` | Convex | **Convex** | N/A | Internal anchor ID; Convex-owned |
| `websiteSku` | Convex | **Convex derived** | Derived from Shopify variant SKU | Legacy; keep for backward compat |
| `graceSku` | Convex | **Shopify** | `variant.sku` | SKU is the primary commerce identity bridge |
| **Classification** | | | | |
| `category` | Convex | **Shopify** | `product.product_type` | Inherited from parent product |
| `family` | Convex | **Shopify metafield** | Inherited from parent product metafield | Mirrored to Convex for Grace |
| `shape` | Convex | **Convex** | N/A | Grace-specific shape intelligence; not in Shopify |
| `color` | Convex | **Shopify** | `product.options` (Glass Color) | Native option value |
| `capacity` | Convex | **Shopify metafield** | Inherited from parent product | Human-readable |
| `capacityMl` | Convex | **Shopify metafield** | Inherited from parent product | Numeric |
| `capacityOz` | Convex | **Convex derived** | Computed from capacityMl | Convex derives; not stored in Shopify |
| **Applicator & Cap** | | | | |
| `applicator` | Convex | **Shopify** | `variant.option` (Applicator option) | Native Shopify variant option |
| `capColor` | Convex | **Shopify** | `variant.option` (Cap Color option) | Native Shopify variant option |
| `trimColor` | Convex | **Shopify metafield** | `variant.metafields.custom.trim_color` | Variant-level metafield |
| `capStyle` | Convex | **Shopify metafield** | `variant.metafields.custom.cap_style` | Variant-level metafield |
| `capHeight` | Convex | **Shopify metafield** | `variant.metafields.custom.cap_height` | Short/Tall/Leather |
| `ballMaterial` | Convex | **Shopify metafield** | `variant.metafields.custom.ball_material` | Metal/Plastic/Glass |
| **Physical Dimensions** | | | | |
| `neckThreadSize` | Convex | **Shopify metafield** | Product-level `custom.neck_thread_size` | Fitment-critical; mirrored to Convex |
| `heightWithCap` | Convex | **Shopify metafield** | `product.metafields.custom.height_with_cap` | |
| `heightWithoutCap` | Convex | **Shopify metafield** | `product.metafields.custom.height_without_cap` | |
| `diameter` | Convex | **Shopify metafield** | `product.metafields.custom.diameter` | |
| `bottleWeightG` | Convex | **Shopify metafield** | `product.metafields.custom.weight_grams` | |
| `caseQuantity` | Convex | **Shopify metafield** | `product.metafields.custom.case_quantity` (integer) | B2B critical |
| **Pricing** | | | | |
| `qbPrice` | Convex | **Convex** | N/A | QuickBooks internal; never in Shopify |
| `webPrice1pc` | Convex | **Shopify** | `variant.price` | Shopify is authoritative |
| `webPrice10pc` | Convex | **Shopify** | Shopify Plus B2B price list or quantity rule | Tiered pricing via Shopify Plus |
| `webPrice12pc` | Convex | **Shopify** | Shopify Plus B2B price list or quantity rule | Same |
| **Content & Status** | | | | |
| `stockStatus` | Convex | **Shopify** | `inventoryLevel.available` + `variant.inventoryPolicy` | Shopify inventory is authoritative |
| `itemName` | Convex | **Shopify** | `variant.title` or computed from product + option values | Mirrored for Grace search index |
| `itemDescription` | Convex | **Shopify** | `product.body_html` | Shopify product description |
| `imageUrl` | Convex | **Shopify** | `variant.image.src` or `product.images[].src` | Shopify image CDN |
| `productUrl` | Convex | **Retired** | Computed from Shopify handle | No longer stored; derived from handle |
| `dataGrade` | Convex | **Convex** | N/A | Internal quality flag; Convex-owned |
| `bottleCollection` | Convex | **Shopify** | Collection membership | |
| **Fitment** | | | | |
| `fitmentStatus` | Convex | **Convex** | N/A | Grace intelligence layer |
| `components` | Convex | **Convex** | N/A | Compatibility graph; Convex-owned (too complex for Shopify) |
| `graceDescription` | Convex | **Convex** | N/A | AI-specific description |
| `assemblyType` | Convex | **Convex** | N/A | 2-part/3-part assembly logic |
| `componentGroup` | Convex | **Convex** | N/A | Component classification |
| **Meta** | | | | |
| `verified` | Convex | **Convex** | N/A | Internal QA flag |
| `importSource` | Convex | **Convex** | N/A | Data lineage tracking |
| `productGroupId` | Convex | **Convex derived** | Derived from Shopify product GID | FK changes to use shopifyProductId |
| **Paper Doll** | | | | |
| `paperDollBodyUrl` | Convex | **Convex** | N/A | Sanity Paper Doll layer |
| `paperDollFitmentUrl` | Convex | **Convex** | N/A | |
| `paperDollCapUrl` | Convex | **Convex** | N/A | |
| `paperDollRollerUrl` | Convex | **Convex** | N/A | |
| `paperDollLayerOrder` | Convex | **Convex** | N/A | |
| `paperDollReady` | Convex | **Convex** | N/A | |
| `paperDollProcessedAt` | Convex | **Convex** | N/A | |

### `fitments` table — **Stays entirely in Convex**

| Field | After Migration | Notes |
|---|---|---|
| `threadSize` | Convex | Core fitment intelligence |
| `bottleName` | Convex | |
| `bottleCode` | Convex | |
| `familyHint` | Convex | |
| `capacityMl` | Convex | |
| `components` | Convex | Compatibility matrix |

### Grace Knowledge tables — **Stay entirely in Convex**

`graceKnowledge`, `gracePersonas`, `graceObjections`, `graceTrends`, `graceStatistics`, `conversations`, `messages` — all remain Convex-only. No Shopify interaction.

### Portal tables — **Stay in Convex, will bridge to Shopify**

| Table | After Migration | Shopify Bridge |
|---|---|---|
| `portalAccounts` | Convex + Shopify customer ID | `shopifyCustomerId` becomes populated from Shopify B2B customer |
| `portalOrders` | Convex mirror of Shopify orders | Shopify webhooks feed order data |
| `portalDrafts` | Convex-only | Native app data |
| `graceProjects` | Convex-only | Native app data |

---

## Part 2: Shopify Metafield & Metaobject Model

### Product-Level Metafields (namespace: `custom`)

| Key | Type | Description | Example |
|---|---|---|---|
| `bottle_family` | `single_line_text_field` | Design family name | "Cylinder" |
| `capacity_label` | `single_line_text_field` | Human-readable capacity | "9 ml" |
| `capacity_ml` | `number_integer` | Numeric capacity in ml | 9 |
| `neck_thread_size` | `single_line_text_field` | Thread specification | "13-415" |
| `applicator_types` | `list.single_line_text_field` | Available applicator types | ["Metal Roller Ball", "Fine Mist Sprayer"] |
| `case_quantity` | `number_integer` | Units per case | 144 |
| `height_with_cap` | `single_line_text_field` | Dimension string | "3.5 in" |
| `height_without_cap` | `single_line_text_field` | Dimension string | "2.8 in" |
| `diameter` | `single_line_text_field` | Dimension string | "0.65 in" |
| `weight_grams` | `number_decimal` | Bottle weight | 28.5 |
| `paper_doll_family_key` | `single_line_text_field` | Sanity Paper Doll reference | "CYL-9ML" |
| `compatible_threads` | `list.single_line_text_field` | Cross-reference for fitment | ["13-415", "18-415"] |

### Variant-Level Metafields (namespace: `custom`)

| Key | Type | Description | Example |
|---|---|---|---|
| `trim_color` | `single_line_text_field` | Trim/accent color | "Gold" |
| `cap_style` | `single_line_text_field` | Cap style descriptor | "Dome" |
| `cap_height` | `single_line_text_field` | Cap height category | "Tall" |
| `ball_material` | `single_line_text_field` | Roller ball material | "Metal" |
| `assembly_type` | `single_line_text_field` | Assembly type for components | "3-part" |
| `component_group` | `single_line_text_field` | Component classification | "Fine Mist Sprayer" |
| `grace_sku` | `single_line_text_field` | Legacy Grace SKU if differs from variant.sku | "GB-CYL-CLR-9ML-MRL-SBLK" |

### Shopify Product Options (native, no metafields)

Best Bottles products use up to 3 native Shopify options:

| Option | Purpose | Example Values |
|---|---|---|
| **Applicator** | Primary variant axis | "Metal Roller Ball", "Fine Mist Sprayer", "Cap/Closure" |
| **Cap Color** | Secondary variant axis | "Shiny Black", "Matte Gold", "Shiny Silver" |
| **Glass Color** | Handled via separate products (siblings), not variant option | Clear, Amber, Frosted, Blue |

Glass Color is **not** a variant option because each glass color has different imagery, different Paper Doll assets, and often different thread sizes. It stays as separate Shopify products linked by the `bottle_family` + `capacity_ml` metafields, matching the current `getSiblingGroups` pattern.

### Metaobject: `bottle_family` (shared reference)

A single metaobject definition for family-level data that multiple products reference.

| Field | Type | Description |
|---|---|---|
| `name` | `single_line_text_field` | "Cylinder" |
| `description` | `rich_text_field` | Family overview for PDP |
| `available_sizes` | `list.single_line_text_field` | ["5ml", "9ml", "15ml", "30ml", "50ml", "100ml"] |
| `shape_keywords` | `list.single_line_text_field` | ["cylindrical", "tube", "tall", "narrow"] |
| `hero_image` | `file_reference` | Family hero image |
| `grace_talking_points` | `rich_text_field` | AI context for Grace |

Products reference this via: `product.metafields.custom.bottle_family_ref` (type: `metaobject_reference`)

### Metaobject: `fitment_rule` (compatibility reference)

| Field | Type | Description |
|---|---|---|
| `thread_size` | `single_line_text_field` | "13-415" |
| `compatible_components` | `list.single_line_text_field` | SKU list of compatible components |
| `family_hint` | `single_line_text_field` | e.g. "Cylinder" |
| `capacity_ml` | `number_integer` | Capacity constraint |

> **Note:** The fitment matrix is complex and deeply nested. The `fitment_rule` metaobject serves as a Shopify-side reference, but the full compatibility graph (nested component arrays, multi-rule matching, assembly-type logic) stays in Convex's `fitments` table. Shopify stores the thread size and basic references; Convex does the actual compatibility computation.

### Shopify Collections Strategy

| Collection Type | Maps To | Example |
|---|---|---|
| **Automated** by `product_type` | `category` | "Glass Bottle", "Component", "Aluminum Bottle" |
| **Automated** by `bottle_family` metafield | `family` | "Cylinder", "Elegant", "Boston Round" |
| **Manual** | `bottleCollection` | "Fragrance Collection", "Essential Oil Collection" |
| **Automated** by `capacity_ml` range | Capacity buckets | "Under 15ml", "15-50ml", "50ml+" |

### Shopify Plus B2B Pricing

| Tier | Maps To | Implementation |
|---|---|---|
| 1pc web price | `webPrice1pc` | `variant.price` (default) |
| 10pc price | `webPrice10pc` | Shopify Plus quantity price rule |
| 12pc / case price | `webPrice12pc` | Shopify Plus quantity price rule |
| QB wholesale price | `qbPrice` | Shopify Plus B2B catalog / company pricing |

---

## Part 3: Files to Refactor — Priority Order

### Phase 0: Commerce Adapter (do first)

| File | Action | What Changes |
|---|---|---|
| `src/lib/shopify.ts` | **Expand** | Add: `getProductByHandle`, `getVariantBySku`, `getProductMetafields`, `getInventoryLevel`, `createCheckoutUrl` (Storefront API cart). Consolidate all Shopify access here. |
| `src/lib/shopify-webhooks.ts` | **Create** | Webhook signature verification + event routing. Handles `products/create`, `products/update`, `products/delete`, `inventory_levels/update`. |
| `src/app/api/shopify/webhooks/route.ts` | **Create** | Next.js API route that receives Shopify webhooks and calls Convex sync mutations. |
| `src/app/api/shopify/resolve-variants/route.ts` | **Keep** | Already works. Minor update: use expanded adapter instead of raw `adminGraphQL`. |

### Phase 1: Convex Webhook Sync Layer

| File | Action | What Changes |
|---|---|---|
| `convex/shopifySync.ts` | **Create** | New module with mutations: `syncProduct`, `syncProductDelete`, `syncInventoryLevel`. These receive webhook payloads and upsert into Convex mirror tables. |
| `convex/schema.ts` | **Modify** | Add `shopifyProductGid` (required string) and `shopifyVariantGid` (optional) fields to `productGroups` and `products`. Add `shopifyUpdatedAt` timestamp. Add `lastSyncedAt` to both tables. Mark `shopifyProductId` as required instead of optional. |
| `convex/products.ts` | **Modify (later)** | After sync is stable: update `getHomepageStats` to remove hardcoded `inStockCount`. Update price reads to use synced Shopify prices. |

### Phase 2: Shopify Metafield Definitions

| File | Action | What Changes |
|---|---|---|
| `scripts/shopify-create-metafields.mjs` | **Create** | Script that defines all metafield definitions and metaobject types on the Shopify store using Admin API. Run once. |
| `scripts/shopify-sync.mjs` | **Rewrite** | Current script pushes Convex → Shopify. Rewrite to: (1) create products with metafields, (2) write `shopifyProductGid` back to Convex, (3) set up inventory tracking. Direction stays Convex → Shopify for initial seed, then flips to webhook-driven. |
| `shopify.app.toml` | **Modify** | Update `application_url` and `redirect_urls` from placeholders to real values. Verify `api_version` matches webhook subscription version. |

### Phase 3: Grace Tool Updates

| File | Action | What Changes |
|---|---|---|
| `convex/grace.ts` | **Modify** | `searchCatalog`: reads from Convex mirror (no change to query shape, but backing data comes from webhook sync). `getCatalogStats`: remove hardcoded assumptions. Add staleness check: if `lastSyncedAt` is old, warn Grace. |
| `convex/graceSearchUtils.ts` | **No change** | Search normalization and scoring logic is Convex-internal and stays unchanged. |
| `convex/gracePrompt.ts` | **Minor update** | Update catalog overview in system prompt to reference Shopify-backed data. |
| `convex/graceToolDefs.ts` | **No change** | Tool signatures stay stable. |
| `src/app/api/elevenlabs/server-tools/route.ts` | **No change** | Proxies to Convex; Convex handles the data source change internally. |

### Phase 4: Frontend Catalog Migration

| File | Action | What Changes |
|---|---|---|
| `src/app/catalog/page.tsx` | **Modify** | Reads from same Convex queries, but data is now Shopify-backed. No breaking change if webhook sync populates the same field shapes. |
| `src/app/products/[slug]/page.tsx` | **Modify** | PDP: `getProductGroup` still works. Add live price/availability fetch from Shopify adapter for freshness where needed. |
| `src/components/CartProvider.tsx` | **Modify** | Replace localStorage `unitPrice` snapshots with live variant price from Shopify at checkout time. Cart items should store `shopifyVariantGid` alongside `graceSku`. |

### Phase 5: Cleanup & Retirement

| File | Action | What Changes |
|---|---|---|
| `convex/seedProducts.ts` | **Retire** | No longer needed once Shopify is the seed source. |
| `convex/migrations.ts` | **Retire (gradually)** | Migration mutations become unnecessary as Shopify webhook sync handles data. |
| `scripts/shopify-sync.mjs` (old version) | **Replace** | Replaced by new sync script in Phase 2. |
| `convex/products.ts` — `patchDescriptions`, `backfillPrimarySkus` | **Retire** | One-time backfill utilities; unnecessary with webhook sync. |

---

## Summary: What Stays Where

```
SHOPIFY PLUS (source of truth)
├── Products (title, handle, images, body_html)
├── Variants (SKU, price, inventory, options)
├── Metafields (family, capacity, thread size, dimensions, case qty)
├── Metaobjects (bottle_family, fitment_rule)
├── Collections (category, family, collection)
├── B2B pricing (quantity rules, company catalogs)
├── Cart + Checkout
├── Customers + Orders
└── Inventory levels

CONVEX (derived intelligence layer)
├── Mirror tables (productGroups, products) — fed by Shopify webhooks
├── Fitment compatibility graph (fitments table)
├── Grace AI (knowledge, personas, objections, trends, stats)
├── Conversation engine (conversations, messages)
├── Shape intelligence + search scoring
├── Paper Doll compositor references
├── Portal (accounts, orders mirror, drafts, projects)
├── Form submissions
├── Internal QA flags (verified, dataGrade, importSource)
└── Derived fields (variantCount, capacityOz, shape, componentGroup)

SANITY (editorial content)
├── Product family storytelling
├── Paper Doll visual assets
├── Journal/blog content
└── Merchandising blocks
```

---

## Conflict Prevention Rules

1. **Price**: Shopify variant.price is authoritative. Convex mirrors it but never overrides it. Grace reads the Convex mirror for speed; checkout reads Shopify live.
2. **Inventory**: Shopify inventory_levels is authoritative. Convex `stockStatus` is derived from webhook updates.
3. **Product identity**: Shopify product GID + variant SKU is the canonical identity. Convex `graceSku` maps 1:1 to Shopify variant SKU.
4. **Metafields**: Defined once via script. Managed in Shopify admin. Synced to Convex via webhooks.
5. **Fitment logic**: Stays entirely in Convex. Too complex for Shopify. Thread size is the bridge field stored in both systems.
6. **Grace tool signatures**: Do not change. Only the backing data source changes.
