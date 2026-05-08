# Shopify Sync Foundation

Linear: BB-1 and BB-7

This is the launch-safe contract for moving Best Bottles catalog groups from Convex into Shopify and then backfilling stable Shopify IDs for checkout.

## Canonical Mapping

Convex remains the source of truth for product grouping, merchandising, fitment rules, Paper Doll fields, and Grace metadata.

Shopify becomes the source of truth for purchasable product and variant IDs:

```text
productGroups.slug
  -> Shopify product.handle

products.graceSku or products.websiteSku
  -> Shopify variant.sku

Shopify product.id
  -> productGroups.shopifyProductId

Shopify variant.id
  -> products.shopifyVariantId

Shopify inventoryItem.id
  -> products.shopifyInventoryItemId
```

Checkout must use `products.shopifyVariantId`. It should not infer Shopify variant IDs from labels, handles, selected options, or SKU suffixes.

## Run Order

1. Validate Convex data only:

```bash
npm run shopify:sync:validate -- --limit 10
```

This checks SKU presence, duplicate SKU values inside each group, Shopify's 100-variant-per-product limit, and missing prices. It does not require Shopify credentials.

2. Dry-run against Shopify:

```bash
npm run shopify:sync:dry -- --limit 10
```

This checks whether each `productGroups.slug` already exists as a Shopify handle and writes a manifest under `tmp/shopify-sync/`.

3. Apply to Shopify as draft products:

```bash
node scripts/push_convex_to_shopify.mjs --apply --limit 10
```

Missing prices block live apply by default. Only use `--allow-placeholder-prices` for a deliberately scoped rehearsal where `$0.01` placeholder prices are acceptable.

4. Backfill Shopify IDs into Convex:

```bash
node scripts/backfill_shopify_ids.mjs --apply --limit 10
```

The backfill is the BB-7 bridge that makes checkout deterministic.

## Manifest Expectations

Every run writes a JSON manifest with:

- `created`, `updated`, `skipped`, and `failed` counts.
- one row per product group.
- each variant's `productId`, `graceSku`, `websiteSku`, current Shopify IDs, and price.
- actionable failure reasons such as `missing_skus`, `duplicate_skus`, `missing_prices`, or `too_many_variants`.

The manifest is the handoff artifact for debugging by product group slug or SKU.
