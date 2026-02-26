/**
 * Shopify integration utilities.
 *
 * - Admin API (server-side only) resolves SKUs → Shopify variant IDs.
 * - Checkout URLs are built using Shopify's permalink format, which
 *   requires no token and works for any public store.
 */

// ─── Domain helper ────────────────────────────────────────────────────────────

export function getShopifyDomain(): string {
    const raw = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "";
    return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// ─── Checkout URL builder (no token required) ────────────────────────────────

export interface CheckoutLineItem {
    /** Numeric Shopify variant ID (not the GID) */
    variantId: string;
    quantity: number;
}

/**
 * Builds a Shopify `/cart/{variantId:qty,...}` permalink.
 * Opening this URL adds items directly to the store's cart and
 * redirects to checkout.
 */
export function buildCheckoutUrl(items: CheckoutLineItem[]): string {
    const domain = getShopifyDomain();
    const lineItems = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");
    return `https://${domain}/cart/${lineItems}`;
}

// ─── Admin API GraphQL client (server-side only) ─────────────────────────────

interface AdminGqlResult<T> {
    data: T;
    errors?: Array<{ message: string }>;
}

async function adminGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const domain = getShopifyDomain();
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    if (!token) throw new Error("SHOPIFY_ADMIN_TOKEN not set");

    const res = await fetch(`https://${domain}/admin/api/2025-01/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Shopify Admin API ${res.status}: ${text}`);
    }

    const json = (await res.json()) as AdminGqlResult<T>;
    if (json.errors?.length) {
        throw new Error(`Shopify GQL: ${json.errors.map((e) => e.message).join(", ")}`);
    }
    return json.data;
}

// ─── Variant resolver (SKU → Shopify variant ID) ────────────────────────────

export interface ResolvedVariant {
    sku: string;
    variantId: string;       // numeric ID (extracted from GID)
    variantGid: string;      // full GID like gid://shopify/ProductVariant/12345
    productTitle: string;
    available: boolean;
    price: string;
}

/**
 * Resolves an array of SKUs to Shopify variant info using the Admin API.
 * Queries each SKU individually (Shopify doesn't support batch SKU lookup).
 */
export async function resolveVariantsBySkus(skus: string[]): Promise<ResolvedVariant[]> {
    const resolved: ResolvedVariant[] = [];

    for (const sku of skus) {
        try {
            const data = await adminGraphQL<{
                productVariants: {
                    edges: Array<{
                        node: {
                            id: string;
                            sku: string;
                            availableForSale: boolean;
                            price: string;
                            product: { title: string };
                        };
                    }>;
                };
            }>(
                `query VariantBySku($query: String!) {
                    productVariants(first: 1, query: $query) {
                        edges {
                            node {
                                id
                                sku
                                availableForSale
                                price
                                product { title }
                            }
                        }
                    }
                }`,
                { query: `sku:${sku}` }
            );

            const node = data.productVariants.edges[0]?.node;
            if (node) {
                const numericId = node.id.split("/").pop() ?? node.id;
                resolved.push({
                    sku,
                    variantId: numericId,
                    variantGid: node.id,
                    productTitle: node.product.title,
                    available: node.availableForSale,
                    price: node.price,
                });
            }
        } catch (err) {
            console.error(`[Shopify] Failed to resolve SKU "${sku}":`, err);
        }
    }

    return resolved;
}
