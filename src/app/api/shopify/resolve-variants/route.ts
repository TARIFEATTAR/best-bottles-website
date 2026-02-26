import { NextRequest } from "next/server";
import { resolveVariantsBySkus, buildCheckoutUrl } from "@/lib/shopify";

/**
 * POST /api/shopify/resolve-variants
 *
 * Takes an array of { sku, quantity } items and returns:
 * - resolved variant info for each SKU
 * - a ready-to-use Shopify checkout URL
 */
export async function POST(req: NextRequest) {
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!token) {
        return Response.json(
            { error: "Shopify Admin token not configured" },
            { status: 503 }
        );
    }

    const body = (await req.json().catch(() => ({}))) as {
        items?: Array<{ sku: string; quantity: number }>;
    };

    if (!body.items?.length) {
        return Response.json({ error: "No items provided" }, { status: 400 });
    }

    try {
        const skus = body.items.map((i) => i.sku);
        const variants = await resolveVariantsBySkus(skus);

        const skuToQuantity = Object.fromEntries(
            body.items.map((i) => [i.sku, i.quantity])
        );

        const checkoutItems = variants.map((v) => ({
            variantId: v.variantId,
            quantity: skuToQuantity[v.sku] ?? 1,
        }));

        const checkoutUrl = checkoutItems.length > 0
            ? buildCheckoutUrl(checkoutItems)
            : null;

        return Response.json({
            variants,
            checkoutUrl,
            unmatchedSkus: skus.filter(
                (s) => !variants.some((v) => v.sku === s)
            ),
        });
    } catch (err) {
        console.error("[shopify/resolve-variants] Error:", err);
        return Response.json(
            { error: err instanceof Error ? err.message : "Failed to resolve variants" },
            { status: 502 }
        );
    }
}
