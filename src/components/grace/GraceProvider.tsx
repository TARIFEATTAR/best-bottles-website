"use client";

import { useConversation } from "@elevenlabs/react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@clerk/nextjs";
import {
    useState,
    useRef,
    useCallback,
    useEffect,
    useMemo,
    type ReactNode,
} from "react";
import { analytics } from "@/lib/analytics";
import {
    GraceContext,
    type GraceContextValue,
    type GraceStatus,
    type GraceMessage,
    type PanelMode,
    type PageContext,
    type BrowsingHistoryEntry,
    type ActiveForm,
    type FormType,
    type ProductCard,
} from "@/components/GraceContext";

// ─── Core product intelligence injected into ElevenLabs session ─────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPageContextForGrace(ctx: PageContext | null, history?: BrowsingHistoryEntry[]): string {
    if (!ctx) return "";
    const lines: string[] = ["=== CURRENT SESSION CONTEXT ==="];

    if (ctx.pageType === "pdp" && ctx.currentProduct) {
        const p = ctx.currentProduct;
        lines.push(`Page: Product Detail — ${p.name}`);
        lines.push(`Family: ${p.family} | Size: ${p.capacity} | Color: ${p.color}`);
        if (p.neckThreadSize) lines.push(`Thread Size: ${p.neckThreadSize}`);
        if (p.applicator) lines.push(`Applicator: ${p.applicator}`);
        if (p.webPrice1pc) lines.push(`Price: $${p.webPrice1pc.toFixed(2)}/pc`);
        lines.push(`SKU: ${p.graceSku}`);
        lines.push(`CONTEXT NOTE: Customer is currently viewing this product. If they ask about it, you already know the details above. If they ask about compatible closures, use getBottleComponents with SKU ${p.graceSku}. Do NOT mention this product until the customer brings it up.`);
    } else if (ctx.pageType === "catalog") {
        lines.push(`Page: Product Catalog`);
        if (ctx.currentCollection) lines.push(`Active Family Filter: ${ctx.currentCollection}`);
        if (ctx.catalogSearch) lines.push(`Active Search: "${ctx.catalogSearch}"`);
        lines.push(`CONTEXT NOTE: Customer is browsing the catalog. Wait for them to ask a question before offering help.`);
    } else if (ctx.pageType === "cart") {
        lines.push(`Page: Shopping Cart`);
        lines.push(`CONTEXT NOTE: Customer is reviewing their cart. If they ask, you can help with accessories, quantities, or checkout.`);
    } else if (ctx.pageType === "contact") {
        lines.push(`Page: Contact / Request Form`);
    } else if (ctx.pageType === "home") {
        lines.push(`Page: Homepage`);
        lines.push(`CONTEXT NOTE: Customer is on the homepage. Greet them briefly and wait for their question.`);
    } else {
        lines.push(`Page: ${ctx.pathname}`);
    }

    if (ctx.cartItems.length > 0) {
        lines.push(`Cart (${ctx.cartItems.length} item${ctx.cartItems.length > 1 ? "s" : ""}${ctx.cartTotal ? `, ~$${ctx.cartTotal.toFixed(2)} total` : ""}):`);
        for (const i of ctx.cartItems) {
            const price = i.unitPrice ? ` @ $${i.unitPrice.toFixed(2)}/pc` : "";
            lines.push(`  • ${i.name} ×${i.quantity}${price}`);
        }
    } else {
        lines.push(`Cart: Empty`);
    }

    if (history && history.length > 1) {
        const recent = history.slice(-6, -1).reverse();
        if (recent.length > 0) {
            lines.push(`Recent browsing:`);
            for (const h of recent) {
                if (h.productName) lines.push(`  • Viewed: ${h.productName} (${h.productFamily ?? ""} ${h.productCapacity ?? ""})`);
                else if (h.searchTerm) lines.push(`  • Searched: "${h.searchTerm}"`);
                else lines.push(`  • Visited: ${h.pageType} page`);
            }
        }
    }

    lines.push("=== END CONTEXT ===");
    return lines.join("\n");
}

function sanitizeCatalogQuery(rawQuery: string | undefined): string {
    return (rawQuery ?? "").split(/,|\s+and\s+/i)[0].replace(/\s+/g, " ").trim();
}

/** Normalize for deduping duplicate agent_response + streaming copies of the same line */
function normalizeGraceMessageText(s: string): string {
    return s.replace(/\s+/g, " ").trim();
}

function slugToSearchTerm(rawSlug: string): string {
    return rawSlug
        .replace(/[-_]+/g, " ")
        .replace(/\broll\s*on\b/gi, "roll-on")
        .replace(/\brollon\b/gi, "roll-on")
        .replace(/\bfinemist\b/gi, "fine mist")
        .replace(/\blotionpump\b/gi, "lotion pump")
        .replace(/\s+/g, " ")
        .trim();
}

function buildCatalogPath(products: ProductCard[], query?: string, family?: string): string {
    const qs = new URLSearchParams();
    const sanitizedQuery = sanitizeCatalogQuery(query);

    if (family) {
        qs.set("families", family);
    } else {
        const familyCounts = new Map<string, number>();
        for (const p of products) {
            if (p.family) familyCounts.set(p.family, (familyCounts.get(p.family) || 0) + 1);
        }
        const sorted = [...familyCounts.entries()].sort((a, b) => b[1] - a[1]);
        const total = products.length;
        if (sorted.length > 0) {
            const dominant = sorted.filter(([, count]) => count / total >= 0.3).map(([f]) => f);
            const families = dominant.length > 0 ? dominant : [sorted[0][0]];
            qs.set("families", families.join(","));
        } else if (sanitizedQuery) {
            qs.set("search", sanitizedQuery);
        }
    }

    const capMatch = query?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
    if (capMatch) qs.set("search", `${capMatch[1]}ml`);
    qs.set("grace", "1");
    return `/catalog?${qs.toString()}`;
}

function buildBrowsePath(products: ProductCard[], query?: string, family?: string): string {
    if (products.length === 1 && products[0].slug) return `/products/${products[0].slug}`;
    return buildCatalogPath(products, query, family);
}

function normalizeSearchText(rawValue: string): string {
    return rawValue
        .toLowerCase()
        .replace(/(\d+)\s*ml\b/g, "$1ml")
        .replace(/\broll[\s-]?on\b/g, "roll-on")
        .replace(/[^a-z0-9-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenizeSearchText(rawValue: string): string[] {
    const stopWords = new Set(["a", "an", "and", "bottle", "bottles", "browse", "can", "find", "for", "me", "open", "please", "show", "take", "the", "to", "you"]);
    return normalizeSearchText(rawValue).split(" ").filter((t) => t && !stopWords.has(t));
}

function selectDirectProductMatch(products: ProductCard[], query?: string): ProductCard | null {
    const tokens = tokenizeSearchText(query ?? "");
    if (tokens.length < 2) return null;

    const unique = Array.from(new Map(products.map((p) => [p.slug || p.graceSku, p] as const)).values());
    const scored = unique
        .map((product) => {
            const haystack = normalizeSearchText(
                [product.itemName.split(/[.!?]/)[0], product.family, product.capacity, product.color, product.applicator, product.neckThreadSize, product.graceSku, product.slug].filter(Boolean).join(" ")
            );
            const matches = tokens.filter((t) => haystack.includes(t)).length;
            return { product, matches, coverage: matches / tokens.length };
        })
        .sort((a, b) => b.coverage - a.coverage || b.matches - a.matches);

    const [best, secondBest] = scored;
    if (!best?.product.slug || best.coverage < 0.75) return null;
    if (secondBest && secondBest.coverage >= best.coverage - 0.1 && secondBest.matches >= best.matches - 1) {
        if (secondBest.product.slug !== best.product.slug) return null;
    }
    return best.product;
}

function checkSizeWarning(products: ProductCard[], query?: string): string {
    const capMatch = query?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
    if (!capMatch) return "";
    const requestedMl = parseFloat(capMatch[1]);
    const tolerance = Math.max(1, requestedMl * 0.1);
    const hasSize = products.some((p) => {
        const pMl = parseFloat(p.capacity || "0");
        return pMl > 0 && Math.abs(pMl - requestedMl) <= tolerance;
    });
    if (hasSize) return "";
    const sizes = [...new Set(products.map((p) => p.capacity).filter(Boolean))].slice(0, 6).join(", ");
    const families = [...new Set(products.map((p) => p.family).filter(Boolean))].slice(0, 4).join(", ");
    return `WARNING: We do NOT stock a ${requestedMl}ml in this search (families: ${families}). Available sizes: ${sizes}. Do NOT tell the customer we have ${requestedMl}ml.`;
}

function checkRollOnMinimum(query: string, requestedMl: number | null, products: ProductCard[]): string | null {
    if (!/roll.?on|roller/i.test(query)) return null;
    if (!requestedMl || requestedMl >= 5) return null;
    const rollOnSizes = products
        .filter((p) => /roller|roll/i.test(p.applicator || ""))
        .map((p) => p.capacity)
        .filter(Boolean);
    const uniqueSizes = [...new Set(rollOnSizes)].slice(0, 5).join(", ");
    return `WARNING: We do NOT stock roll-on bottles smaller than 5ml. A ${requestedMl}ml roll-on does NOT exist. Our smallest roll-on is 5ml. Available roll-on sizes: ${uniqueSizes || "5ml, 9ml, 15ml, 28ml, 30ml"}.`;
}

let msgCounter = 0;
function nextMsgId(): string {
    return `grace-msg-${Date.now()}-${++msgCounter}`;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export default function GraceProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { addItems: addToCart, items: cartItems } = useCart();
    const { userId } = useAuth();

    const submitFormMutation = useMutation(api.forms.submit);
    const submitFormRef = useRef(submitFormMutation);
    useEffect(() => { submitFormRef.current = submitFormMutation; }, [submitFormMutation]);

    // ── Panel state ──────────────────────────────────────────────────────────
    const [panelMode, setPanelMode] = useState<PanelMode>("closed");
    const isOpen = panelMode === "open";

    const openPanel = useCallback(() => {
        setPanelMode("open");
    }, []);

    const closePanel = useCallback(() => {
        setPanelMode("closed");
    }, []);

    const minimizeToStrip = useCallback(() => {
        setPanelMode("strip");
    }, []);

    // ── Connection state ─────────────────────────────────────────────────────
    const [graceStatus, setGraceStatus] = useState<GraceStatus>("idle");
    const [conversationActive, setConversationActive] = useState(false);
    const connectingRef = useRef(false);
    const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

    // ── Messages & streaming ─────────────────────────────────────────────────
    const [messages, setMessages] = useState<GraceMessage[]>([]);
    const [streamingText, setStreamingText] = useState("");
    const [input, setInput] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [voiceFailed, setVoiceFailed] = useState(false);
    const [graceQuery, setGraceQuery] = useState("");

    const toggleVoiceRef = useRef<(() => void) | null>(null);

    // ── Page context ─────────────────────────────────────────────────────────
    const pageType = useMemo((): PageContext["pageType"] => {
        if (pathname === "/") return "home";
        if (pathname.startsWith("/catalog")) return "catalog";
        if (pathname.startsWith("/products/")) return "pdp";
        if (pathname.startsWith("/cart")) return "cart";
        if (pathname.startsWith("/contact") || pathname.startsWith("/request")) return "contact";
        if (pathname.startsWith("/about")) return "about";
        return "other";
    }, [pathname]);

    const productSlug = pageType === "pdp" ? (pathname.split("/products/")[1] ?? null) : null;
    const productGroupResult = useQuery(api.products.getProductGroup, productSlug ? { slug: productSlug } : "skip");

    const pageContext = useMemo((): PageContext => {
        const cartSummary = cartItems.map((i) => ({
            graceSku: i.graceSku,
            name: i.itemName,
            quantity: i.quantity,
            unitPrice: i.unitPrice ?? null,
        }));
        const cartTotal = cartItems.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0);

        if (pageType === "pdp" && productGroupResult?.group) {
            const g = productGroupResult.group;
            return {
                pageType, pathname,
                cartItems: cartSummary, cartTotal,
                currentProduct: {
                    name: g.displayName,
                    family: g.family ?? "",
                    capacity: g.capacity ?? "",
                    color: g.color ?? "",
                    neckThreadSize: g.neckThreadSize ?? null,
                    graceSku: g.primaryGraceSku ?? "",
                    webPrice1pc: g.priceRangeMin ?? null,
                    applicator: (g.applicatorTypes as string[] | undefined)?.[0] ?? undefined,
                    slug: productSlug ?? undefined,
                },
            };
        }
        if (pageType === "catalog") {
            const familiesParam = searchParams.get("families") ?? searchParams.get("family");
            return {
                pageType, pathname,
                cartItems: cartSummary, cartTotal,
                currentCollection: familiesParam ?? searchParams.get("collection") ?? undefined,
                catalogSearch: searchParams.get("search") ?? undefined,
            };
        }
        return { pageType, pathname, cartItems: cartSummary, cartTotal };
    }, [pageType, pathname, productGroupResult, productSlug, searchParams, cartItems]);

    const pageContextRef = useRef<PageContext>(pageContext);
    useEffect(() => { pageContextRef.current = pageContext; }, [pageContext]);

    // ── Browsing history ─────────────────────────────────────────────────────
    const [browsingHistory, setBrowsingHistory] = useState<BrowsingHistoryEntry[]>([]);
    const browsingHistoryRef = useRef<BrowsingHistoryEntry[]>([]);
    useEffect(() => { browsingHistoryRef.current = browsingHistory; }, [browsingHistory]);

    useEffect(() => {
        if (!pageContext) return;
        const last = browsingHistoryRef.current[browsingHistoryRef.current.length - 1];
        if (last?.pathname === pageContext.pathname) return;
        const entry: BrowsingHistoryEntry = { pathname: pageContext.pathname, pageType: pageContext.pageType, visitedAt: new Date().toISOString() };
        if (pageContext.pageType === "pdp" && pageContext.currentProduct) {
            entry.productName = pageContext.currentProduct.name;
            entry.productFamily = pageContext.currentProduct.family;
            entry.productCapacity = pageContext.currentProduct.capacity;
        }
        if (pageContext.pageType === "catalog" && pageContext.catalogSearch) entry.searchTerm = pageContext.catalogSearch;
        setBrowsingHistory((prev) => [...prev.slice(-49), entry]);
    }, [pageContext]);

    // ── Form state ───────────────────────────────────────────────────────────
    const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
    const activeFormRef = useRef<{ formType: string; fields: Record<string, string> } | null>(null);

    const updateFormField = useCallback((formType: FormType, fieldName: string, value: string) => {
        if (!activeFormRef.current) activeFormRef.current = { formType, fields: {} };
        activeFormRef.current.fields[fieldName] = value;
        setActiveForm((prev) => {
            const fields = { ...(prev?.fields ?? {}), [fieldName]: value };
            const filledOrder = prev?.filledOrder ? [...prev.filledOrder] : [];
            if (!filledOrder.includes(fieldName)) filledOrder.push(fieldName);
            return { formType, fields, filledOrder, submitting: false, submitted: false, error: "" };
        });
    }, []);

    const submitActiveForm = useCallback(async () => {
        const form = activeFormRef.current;
        if (!form || !form.fields.email) return;
        try {
            setActiveForm((prev) => prev ? { ...prev, submitting: true } : null);
            await submitFormRef.current({
                formType: form.formType as "sample" | "quote" | "contact" | "newsletter",
                name: form.fields.name || undefined,
                email: form.fields.email,
                company: form.fields.company || undefined,
                phone: form.fields.phone || undefined,
                message: form.fields.message || undefined,
                products: form.fields.products || undefined,
                quantities: form.fields.quantities || undefined,
                source: "grace",
            });
            setActiveForm((prev) => prev ? { ...prev, submitting: false, submitted: true } : null);
            activeFormRef.current = null;
        } catch (err) {
            setActiveForm((prev) => prev ? { ...prev, submitting: false, error: err instanceof Error ? err.message : "Unknown error" } : null);
        }
    }, []);

    const dismissActiveForm = useCallback(() => {
        activeFormRef.current = null;
        setActiveForm(null);
    }, []);

    // ── Session metrics ──────────────────────────────────────────────────────
    const sessionMetricsRef = useRef({ toolsCalled: 0, toolsUsed: new Set<string>(), cartItemsAdded: 0, navigations: 0 });

    // ── Stable refs ──────────────────────────────────────────────────────────
    const routerRef = useRef(router);
    useEffect(() => { routerRef.current = router; }, [router]);

    // ── Client tools ─────────────────────────────────────────────────────────
    const clientTools = useMemo(() => ({

        searchCatalog: async (params: { searchTerm: string; familyLimit?: string; applicatorFilter?: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tool_name: "searchCatalog", parameters: { searchTerm: params.searchTerm ?? "", familyLimit: params.familyLimit, applicatorFilter: params.applicatorFilter } }),
                });
                const data = await r.json() as { result?: ProductCard[] };
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("searchCatalog");
                analytics.graceToolCalled({ toolName: "searchCatalog", searchTerm: params.searchTerm, family: params.familyLimit, success: products.length > 0 });
                if (products.length === 0) return "No products found matching that description. Try a different search term.";

                const sizeNote = checkSizeWarning(products, params.searchTerm);
                const unique = new Map<string, ProductCard>();
                for (const p of products) { const key = `${p.family}-${p.capacity}-${p.color}`; if (!unique.has(key)) unique.set(key, p); }
                const summary = [...unique.values()].slice(0, 8).map((p) => `${p.family} ${p.capacity || ""} ${p.color || ""} (${p.applicator || "N/A"}, thread: ${p.neckThreadSize || "N/A"})`).join("; ");
                return `Found ${products.length} products.${sizeNote ? ` ${sizeNote}` : ""} Top matches: ${summary}`;
            } catch (e) { console.error("[Grace] searchCatalog:", e); return "Search failed. Please try again."; }
        },

        getFamilyOverview: async (params: { family: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tool_name: "getFamilyOverview", parameters: { family: params.family } }),
                });
                const data = await r.json() as { result?: Record<string, unknown> };
                if (!data.result) return `No data found for the ${params.family} family.`;
                const v = data.result as { sizes?: Array<{ label: string }>; colors?: string[]; applicatorTypes?: string[]; threadSizes?: string[] };
                return `${params.family} family — Sizes: ${(v.sizes || []).map((s) => s.label).join(", ")}. Colors: ${(v.colors || []).join(", ")}. Applicators: ${(v.applicatorTypes || []).join(", ")}. Thread sizes: ${(v.threadSizes || []).join(", ")}.`;
            } catch (e) { console.error("[Grace] getFamilyOverview:", e); return "Lookup failed."; }
        },

        getBottleComponents: async (params: { bottleSku: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tool_name: "getBottleComponents", parameters: { bottleSku: params.bottleSku } }),
                });
                const data = await r.json() as { result?: Record<string, unknown> | null };
                if (!data.result) return `No compatible components found for SKU "${params.bottleSku}".`;
                const result = data.result as { bottle?: { itemName?: string; neckThreadSize?: string; family?: string; capacity?: string }; components?: Record<string, Array<{ graceSku?: string; itemName?: string; webPrice1pc?: number; capColor?: string; stockStatus?: string }>> };
                const lines: string[] = [];
                if (result.bottle) { lines.push(`Bottle: ${result.bottle.itemName ?? params.bottleSku}`, `Thread: ${result.bottle.neckThreadSize ?? "unknown"} | Family: ${result.bottle.family ?? "unknown"} | Size: ${result.bottle.capacity ?? "unknown"}`); }
                if (result.components) {
                    for (const [type, items] of Object.entries(result.components)) {
                        if (!Array.isArray(items) || items.length === 0) continue;
                        lines.push(`\n${type.replace(/([A-Z])/g, " $1").trim()} (${items.length} options):`);
                        for (const item of items.slice(0, 6)) { lines.push(`  • ${item.itemName ?? item.graceSku}${item.capColor ? `, ${item.capColor}` : ""} — ${item.webPrice1pc ? `$${item.webPrice1pc.toFixed(2)}/pc` : "price TBD"}${item.stockStatus ? ` [${item.stockStatus}]` : ""}`); }
                        if (items.length > 6) lines.push(`  ... and ${items.length - 6} more`);
                    }
                }
                return lines.length > 0 ? lines.join("\n") : JSON.stringify(data.result).slice(0, 800);
            } catch (e) { console.error("[Grace] getBottleComponents:", e); return "Component lookup failed."; }
        },

        checkCompatibility: async (params: { threadSize: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tool_name: "checkCompatibility", parameters: { threadSize: params.threadSize } }),
                });
                const data = await r.json() as { result?: Array<Record<string, unknown>> };
                const fitments = Array.isArray(data.result) ? data.result : [];
                if (fitments.length === 0) return `No bottles found with thread size "${params.threadSize}". Common sizes: 13-415, 15-415, 18-415, 20-410, 24-410, 28-410.`;
                const lines = [`Bottles compatible with ${params.threadSize} thread (${fitments.length} found):`];
                for (const f of fitments.slice(0, 10)) lines.push(`  • ${f.bottleName ?? f.bottleCode} — ${f.capacityMl ?? "?"}ml (${f.familyHint ?? "unknown family"})`);
                if (fitments.length > 10) lines.push(`  ... and ${fitments.length - 10} more`);
                return lines.join("\n");
            } catch (e) { console.error("[Grace] checkCompatibility:", e); return "Compatibility check failed."; }
        },

        getCatalogStats: async () => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tool_name: "getCatalogStats", parameters: {} }),
                });
                const data = await r.json() as { result?: Record<string, unknown> };
                if (!data.result) return "Could not retrieve catalog statistics.";
                const stats = data.result as { totalVariants?: number; totalGroups?: number; familyCounts?: Record<string, number>; categoryCounts?: Record<string, number> };
                const lines = [`Best Bottles Catalog: ${stats.totalVariants ?? "2,285"} individual SKUs across ${stats.totalGroups ?? "230"} product groups.`];
                if (stats.familyCounts) lines.push(`Families: ${Object.entries(stats.familyCounts).sort(([, a], [, b]) => b - a).map(([n, c]) => `${n} (${c})`).join(", ")}`);
                return lines.join("\n");
            } catch (e) { console.error("[Grace] getCatalogStats:", e); return "Stats lookup failed."; }
        },

        getCurrentPageContext: () => {
            const ctx = pageContextRef.current;
            if (!ctx) return "No page context available.";
            const lines: string[] = [`Page type: ${ctx.pageType}`, `URL: ${ctx.pathname}`];
            if (ctx.pageType === "pdp" && ctx.currentProduct) {
                const p = ctx.currentProduct;
                lines.push(`\nCustomer is viewing:`, `  Product: ${p.name}`, `  Family: ${p.family}`, `  Size: ${p.capacity}`, `  Color: ${p.color}`);
                if (p.neckThreadSize) lines.push(`  Thread: ${p.neckThreadSize}`);
                if (p.applicator) lines.push(`  Applicator: ${p.applicator}`);
                if (p.graceSku) lines.push(`  SKU: ${p.graceSku}`);
                if (p.webPrice1pc) lines.push(`  Price: $${p.webPrice1pc.toFixed(2)}/pc`);
            } else if (ctx.pageType === "catalog") {
                lines.push(`\nCustomer is browsing the catalog.`);
                if (ctx.currentCollection) lines.push(`  Active filter: ${ctx.currentCollection}`);
                if (ctx.catalogSearch) lines.push(`  Search: "${ctx.catalogSearch}"`);
            }
            if (ctx.cartItems.length > 0) {
                lines.push(`\nCart (${ctx.cartItems.length} items):`);
                for (const item of ctx.cartItems) lines.push(`  • ${item.name} ×${item.quantity}${item.unitPrice ? ` @ $${item.unitPrice.toFixed(2)}/pc` : ""}`);
                if (ctx.cartTotal) lines.push(`  Total: ~$${ctx.cartTotal.toFixed(2)}`);
            } else lines.push(`\nCart: Empty`);
            return lines.join("\n");
        },

        getCartContents: () => {
            const ctx = pageContextRef.current;
            if (!ctx || ctx.cartItems.length === 0) return "The customer's cart is empty.";
            const lines = [`Cart contains ${ctx.cartItems.length} item${ctx.cartItems.length > 1 ? "s" : ""}:`];
            for (const item of ctx.cartItems) {
                const price = item.unitPrice ? `$${item.unitPrice.toFixed(2)}/pc` : "price TBD";
                const subtotal = item.unitPrice ? ` (subtotal: $${(item.unitPrice * item.quantity).toFixed(2)})` : "";
                lines.push(`  • ${item.name} — SKU: ${item.graceSku} — Qty: ${item.quantity} — ${price}${subtotal}`);
            }
            if (ctx.cartTotal) lines.push(`\nCart total: $${ctx.cartTotal.toFixed(2)}`);
            return lines.join("\n");
        },

        getBrowsingHistory: () => {
            const history = browsingHistoryRef.current;
            if (!history || history.length === 0) return "No browsing history yet.";
            const lines = [`Customer visited ${history.length} page${history.length > 1 ? "s" : ""} this session:`];
            const recent = [...history].reverse().slice(0, 15);
            for (const e of recent) {
                const time = new Date(e.visitedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                if (e.productName) lines.push(`  • [${time}] Viewed: ${e.productName} (${e.productFamily ?? ""} ${e.productCapacity ?? ""})`);
                else if (e.searchTerm) lines.push(`  • [${time}] Searched: "${e.searchTerm}"`);
                else lines.push(`  • [${time}] ${e.pageType} page`);
            }
            const productViews = history.filter((h) => h.productName);
            if (productViews.length >= 2) {
                const families = [...new Set(productViews.map((h) => h.productFamily).filter(Boolean))];
                if (families.length === 1) lines.push(`\nInsight: Customer viewed ${productViews.length} products all in the ${families[0]} family.`);
                else if (families.length > 1) lines.push(`\nInsight: Comparing across families: ${families.join(", ")}.`);
            }
            return lines.join("\n");
        },

        showProducts: async (params: { query: string; family?: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tool_name: "searchCatalog", parameters: { searchTerm: params.query ?? "", familyLimit: params.family } }),
                });
                const data = await r.json() as { result?: ProductCard[] };
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                if (products.length === 0) return "No products found. Try a different description.";

                const capMatch = params.query?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
                const requestedMl = capMatch ? parseFloat(capMatch[1]) : null;
                const rollOnWarning = checkRollOnMinimum(params.query || "", requestedMl, products);
                if (rollOnWarning) return rollOnWarning;

                const sizeWarning = checkSizeWarning(products, params.query);
                const exactSizeFound = !sizeWarning;
                const directProduct = selectDirectProductMatch(products, params.query);
                const displayProducts = directProduct ? [directProduct] : products;
                const summary = displayProducts.slice(0, 3).map((p) => [p.itemName, p.capacity, p.color].filter(Boolean).join(" ")).join(", ");

                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("showProducts");
                analytics.graceToolCalled({ toolName: "showProducts", searchTerm: params.query, family: params.family, success: products.length > 0 });
                if (exactSizeFound) {
                    const redirectUrl = buildBrowsePath(displayProducts, params.query, params.family);
                    sessionMetricsRef.current.navigations++;
                    analytics.graceNavigation({ destination: redirectUrl, triggeredBy: "showProducts", query: params.query });
                    setTimeout(() => { routerRef.current.push(redirectUrl); }, 500);
                    return `Found ${products.length} options — top matches: ${summary}. Navigating the customer there now.`;
                }
                return `${sizeWarning} Search returned ${products.length} nearby products: ${summary}.`;
            } catch (e) { console.error("[Grace] showProducts:", e); return "Catalog search failed."; }
        },

        compareProducts: async (params: { query: string; family?: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tool_name: "searchCatalog", parameters: { searchTerm: params.query ?? "", familyLimit: params.family } }),
                });
                const data = await r.json() as { result?: ProductCard[] };
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                if (products.length === 0) return "No products found to compare.";

                const top = products.slice(0, 4);
                const lines = [`Comparing ${top.length} products:`];
                for (const p of top) {
                    lines.push(`\n• ${p.itemName}`);
                    lines.push(`  Family: ${p.family || "N/A"} | Size: ${p.capacity || "N/A"} | Color: ${p.color || "N/A"}`);
                    lines.push(`  Applicator: ${p.applicator || "N/A"} | Thread: ${p.neckThreadSize || "N/A"}`);
                    if (p.webPrice1pc) lines.push(`  Price: $${p.webPrice1pc.toFixed(2)}/pc`);
                }
                return lines.join("\n");
            } catch (e) { console.error("[Grace] compareProducts:", e); return "Comparison failed."; }
        },

        proposeCartAdd: (params: { products: Array<{ itemName: string; graceSku: string; quantity?: number; webPrice1pc?: number }> }) => {
            const products = (params.products ?? []).map((p) => ({ ...p, quantity: p.quantity ?? 1 }));
            if (products.length === 0) return "No products specified to add.";
            try {
                addToCart(products.map((p) => ({
                    graceSku: p.graceSku,
                    itemName: p.itemName,
                    quantity: p.quantity,
                    unitPrice: p.webPrice1pc ?? null,
                })));
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("proposeCartAdd");
                sessionMetricsRef.current.cartItemsAdded += products.length;
                const valueDelta = products.reduce((sum, p) => sum + (p.webPrice1pc ?? 0) * p.quantity, 0);
                analytics.graceToolCalled({ toolName: "proposeCartAdd", success: true });
                analytics.graceCartConversion({ itemCount: products.length, itemNames: products.map((p) => p.itemName).join(", "), cartValueDelta: valueDelta });
                for (const p of products) {
                    analytics.cartItemAdded({ sku: p.graceSku, name: p.itemName, quantity: p.quantity, unitPrice: p.webPrice1pc, source: "grace" });
                }
                const names = products.map((p) => `${p.itemName} ×${p.quantity}`).join(", ");
                return `Added to cart: ${names}. The customer can see the updated cart icon. Confirm with them that the items were added.`;
            } catch (e) { console.error("[Grace] proposeCartAdd:", e); return "Failed to add items to cart."; }
        },

        navigateToPage: async (params: { path: string; title: string; description?: string; autoNavigate?: boolean; prefillFields?: Record<string, string> }) => {
            let navPath = params.path ?? "/";
            if (params.prefillFields && Object.keys(params.prefillFields).length > 0) {
                const qs = new URLSearchParams(params.prefillFields).toString();
                navPath = `${navPath}?${qs}`;
            }

            if (navPath.startsWith("/products/")) {
                const rawSlug = navPath.replace(/^\/products\//, "").split("?")[0];
                try {
                    const checkRes = await fetch("/api/elevenlabs/server-tools", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tool_name: "getProductGroup", parameters: { slug: rawSlug } }),
                    });
                    const checkData = await checkRes.json() as { result?: { group?: unknown } | null };
                    if (!checkData.result || !(checkData.result as { group?: unknown }).group) {
                        const searchTerm = params.title && params.title.length > 3 ? params.title : slugToSearchTerm(rawSlug);
                        const searchRes = await fetch("/api/elevenlabs/server-tools", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tool_name: "searchCatalog", parameters: { searchTerm } }),
                        });
                        const searchData = await searchRes.json() as { result?: ProductCard[] };
                        const hits: ProductCard[] = Array.isArray(searchData.result) ? searchData.result : [];
                        if (hits.length > 0) {
                            const directHit = selectDirectProductMatch(hits, searchTerm);
                            navPath = directHit ? `/products/${directHit.slug}` : buildBrowsePath(hits, searchTerm);
                        } else {
                            navPath = buildCatalogPath([], searchTerm);
                        }
                    }
                } catch (e) { console.error("[Grace] slug validation:", e); }
            }

            if (navPath.startsWith("/catalog") && !navPath.includes("grace=")) {
                navPath = `${navPath}${navPath.includes("?") ? "&" : "?"}grace=1`;
            }

            sessionMetricsRef.current.toolsCalled++;
            sessionMetricsRef.current.toolsUsed.add("navigateToPage");
            sessionMetricsRef.current.navigations++;
            analytics.graceToolCalled({ toolName: "navigateToPage", success: true });
            analytics.graceNavigation({ destination: navPath, triggeredBy: "navigateToPage" });
            setTimeout(() => { routerRef.current.push(navPath); }, 500);
            return `Navigating the customer to ${params.title ?? "the page"} now.`;
        },

        showProductPresentation: async (params: { searchTerm: string; headline?: string; familyLimit?: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tool_name: "searchCatalog", parameters: { searchTerm: params.searchTerm ?? "", familyLimit: params.familyLimit } }),
                });
                const data = await r.json() as { result?: ProductCard[] };
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                if (products.length === 0) return "No products found to present.";

                const presented = products.slice(0, 6);
                const summary = presented.map((p) => `${p.itemName} (${p.capacity ?? ""} ${p.color ?? ""}, ${p.applicator ?? "N/A"}, $${p.webPrice1pc?.toFixed(2) ?? "TBD"}/pc)`).join("; ");
                return `Presenting ${presented.length} products: ${summary}. Describe these options to the customer and ask which interests them.`;
            } catch (e) { console.error("[Grace] showProductPresentation:", e); return "Product presentation failed."; }
        },

        prefillForm: (params: { formType: string; fields: Record<string, string> }) => {
            window.dispatchEvent(new CustomEvent("grace:prefillForm", { detail: { formType: params.formType, fields: params.fields } }));
            return "Form pre-filled. The customer can review and submit.";
        },

        updateFormField: (params: { formType: string; fieldName: string; value: string }) => {
            const { formType, fieldName, value } = params;
            if (!activeFormRef.current) activeFormRef.current = { formType, fields: {} };
            activeFormRef.current.fields[fieldName] = value;
            return `Field "${fieldName}" set to "${value}".`;
        },

        submitForm: async () => {
            const form = activeFormRef.current;
            if (!form) return "No form data collected. Use updateFormField first.";
            if (!form.fields.email) return "Email address is required. Please ask for it.";
            try {
                await submitFormRef.current({
                    formType: form.formType as "sample" | "quote" | "contact" | "newsletter",
                    name: form.fields.name || undefined,
                    email: form.fields.email,
                    company: form.fields.company || undefined,
                    phone: form.fields.phone || undefined,
                    message: form.fields.message || undefined,
                    products: form.fields.products || undefined,
                    quantities: form.fields.quantities || undefined,
                    source: "grace",
                });
                analytics.formSubmitted({ formType: form.formType as "quote" | "sample" | "contact" | "newsletter", source: "grace" });
                sessionMetricsRef.current.toolsCalled++;
                sessionMetricsRef.current.toolsUsed.add("submitForm");
                activeFormRef.current = null;
                return "Form submitted successfully. Thank the customer.";
            } catch (err) {
                return `Submission failed: ${err instanceof Error ? err.message : "Unknown error"}.`;
            }
        },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);

    // ── ElevenLabs callbacks ─────────────────────────────────────────────────

    const handleConnect = useCallback(() => {
        connectingRef.current = false;
        setGraceStatus("listening");
        setConversationActive(true);
        sessionMetricsRef.current = { toolsCalled: 0, toolsUsed: new Set(), cartItemsAdded: 0, navigations: 0 };
        const ctx = pageContextRef.current;
        analytics.graceConversationStarted({
            pageType: ctx?.pageType ?? "unknown",
            pathname: ctx?.pathname ?? "/",
            productName: ctx?.currentProduct?.name,
            productFamily: ctx?.currentProduct?.family,
            cartItemCount: ctx?.cartItems.length ?? 0,
        });

        // Send page context as a contextual update (does not require dashboard override permissions)
        const contextBlock = formatPageContextForGrace(pageContextRef.current, browsingHistoryRef.current);
        if (contextBlock && conversationRef.current?.getId?.()) {
            conversationRef.current.sendContextualUpdate(contextBlock);
        }

        if (pendingMessageRef.current) {
            const pending = pendingMessageRef.current;
            pendingMessageRef.current = null;
            setTimeout(() => {
                if (conversationRef.current?.getId?.()) {
                    conversationRef.current.sendUserMessage(pending);
                }
            }, 500);
        }
    }, []);

    const handleDisconnect = useCallback((details: { reason: string; message?: string; closeCode?: number; closeReason?: string }) => {
        if (details.reason === "error") {
            console.warn("[Grace] Disconnected due to error:", details.message, details.closeCode, details.closeReason);
        } else if (details.reason === "agent") {
            console.log("[Grace] Agent ended the session.", details.closeReason ?? "");
        }
        connectingRef.current = false;
        const m = sessionMetricsRef.current;
        const ctx = pageContextRef.current;
        analytics.graceConversationEnded({
            pageType: ctx?.pageType ?? "unknown",
            pathname: ctx?.pathname ?? "/",
            toolsCalledCount: m.toolsCalled,
            toolsUsed: [...m.toolsUsed].join(", "),
            cartItemsAdded: m.cartItemsAdded,
            navigationsTriggered: m.navigations,
        });
        setConversationActive(false);
        setGraceStatus("idle");
        setStreamingText("");
    }, []);

    const handleModeChange = useCallback((mode: { mode: string }) => {
        if (mode.mode === "speaking") setGraceStatus("speaking");
        else if (mode.mode === "listening") setGraceStatus("listening");
    }, []);

    const handleError = useCallback((error: unknown) => {
        console.error("[Grace] Error:", error);
        connectingRef.current = false;
        setGraceStatus("error");
        setErrorMessage(typeof error === "string" ? error : "Connection error");
        setVoiceFailed(true);
        setTimeout(() => {
            setGraceStatus((prev) => prev === "error" ? "idle" : prev);
        }, 5000);
    }, []);

    // Track whether onMessage fires after streaming completes
    const streamingFinalizedRef = useRef(false);

    const handleMessage = useCallback((payload: { message: string; source?: string; role?: string }) => {
        const role = payload.role === "user" ? "user" as const : "grace" as const;
        // Skip user echoes — send() already adds user messages to state
        if (role === "user") return;
        // Mark that onMessage handled finalization (prevents duplicate from stop-event fallback)
        streamingFinalizedRef.current = true;
        setStreamingText("");
        const text = payload.message;
        const norm = normalizeGraceMessageText(text);
        setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (
                last?.role === "grace"
                && normalizeGraceMessageText(last.content) === norm
            ) {
                return prev;
            }
            return [
                ...prev,
                { role, content: text, id: nextMsgId() },
            ];
        });
    }, []);

    const handleAgentChatResponsePart = useCallback((payload: { text: string; type?: string }) => {
        if (payload.type === "stop") {
            // Do not clear streamingFinalizedRef here — onMessage may have already set it to true.
            // Clearing it caused the 600ms fallback to duplicate the same assistant bubble.
            const stopText = payload.text ?? "";
            setTimeout(() => {
                if (!streamingFinalizedRef.current) {
                    // onMessage didn't fire — finalize from streaming text
                    setStreamingText((prev) => {
                        const final = (prev + stopText).trim();
                        if (final) {
                            const n = normalizeGraceMessageText(final);
                            setMessages((msgs) => {
                                const last = msgs[msgs.length - 1];
                                if (last?.role === "grace" && normalizeGraceMessageText(last.content) === n) {
                                    return msgs;
                                }
                                return [
                                    ...msgs,
                                    { role: "grace" as const, content: final, id: nextMsgId() },
                                ];
                            });
                        }
                        return "";
                    });
                }
                streamingFinalizedRef.current = false;
            }, 600);
            return;
        }
        setStreamingText((prev) => {
            if (prev === "") {
                streamingFinalizedRef.current = false;
            }
            return prev + payload.text;
        });
    }, []);

    const conversation = useConversation({
        clientTools,
        onConnect: handleConnect,
        onDisconnect: handleDisconnect,
        onModeChange: handleModeChange,
        onError: handleError,
        onMessage: handleMessage,
        onAgentChatResponsePart: handleAgentChatResponsePart,
    });

    useEffect(() => { conversationRef.current = conversation; });

    // ── Start / stop ─────────────────────────────────────────────────────────

    const voiceEnabledRef = useRef(voiceEnabled);
    useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

    const startConversation = useCallback(async (forceTextOnly?: boolean): Promise<boolean> => {
        const useTextOnly = forceTextOnly ?? !voiceEnabledRef.current;
        if (connectingRef.current || conversationRef.current?.getId?.()) return false;
        connectingRef.current = true;
        setGraceStatus("connecting");

        try {
            const res = await fetch("/api/elevenlabs/signed-url");
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? "Failed to get ElevenLabs connection.");
            }
            const { signedUrl } = (await res.json()) as { signedUrl?: string };
            if (!signedUrl) throw new Error("ElevenLabs did not return a valid signed URL.");

            const page = pageContextRef.current;
            const productName = page?.currentProduct?.name ?? "our collection";

            console.log(`[Grace] Starting ${useTextOnly ? "text" : "voice"} session...`);
            await conversation.startSession({
                signedUrl,
                textOnly: useTextOnly,
                ...(!useTextOnly ? { preferHeadphonesForIosDevices: true } : {}),
                dynamicVariables: {
                    _product_name_: productName,
                },
            });
            console.log("[Grace] Session started successfully.");
            setConversationActive(true);
            return true;
        } catch (err) {
            console.error("[Grace] Connection failed:", err);
            connectingRef.current = false;
            setGraceStatus("error");
            setVoiceFailed(true);
            setErrorMessage(err instanceof Error ? err.message : "Connection failed");
            return false;
        } finally {
            connectingRef.current = false;
        }
    }, [conversation]);

    const endConversation = useCallback(async () => {
        try { await conversationRef.current?.endSession(); } catch { /* ignore */ }
        setConversationActive(false);
        setGraceStatus("idle");
        setStreamingText("");
    }, []);

    useEffect(() => {
        return () => {
            try { conversationRef.current?.endSession(); } catch { /* ignore */ }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Toggle voice: must be called from a click handler (user gesture) ───
    // Browsers require a user gesture to grant microphone access.
    const toggleVoice = useCallback(async () => {
        const nextVoice = !voiceEnabled;
        setVoiceEnabled(nextVoice);
        voiceEnabledRef.current = nextVoice;

        // Tear down existing session so we can restart with different mode
        try { await conversationRef.current?.endSession(); } catch { /* ignore */ }
        setConversationActive(false);
        setGraceStatus("idle");
        setErrorMessage("");
        setVoiceFailed(false);
        connectingRef.current = false;

        // Do not call getUserMedia here — @elevenlabs/client VoiceConversation already acquires
        // the mic (twice: preliminary + Input). Priming + stopping tracks can break the second capture on Safari/Chrome.

        await new Promise((r) => setTimeout(r, 400));

        const success = await startConversation(!nextVoice);

        // If voice failed (mic denied, timeout), fall back to text mode
        if (!success && nextVoice) {
            console.warn("[Grace] Voice failed, falling back to text mode.");
            setVoiceEnabled(false);
            setVoiceFailed(true);
            setErrorMessage("Voice unavailable — using text mode instead.");
            setGraceStatus("idle");
            connectingRef.current = false;
            // Clear duplicate greeting from the failed voice attempt
            setMessages([]);
            setStreamingText("");
            await new Promise((r) => setTimeout(r, 300));
            await startConversation(true);
        }
    }, [voiceEnabled, startConversation]);

    toggleVoiceRef.current = toggleVoice;

    // ── Send text message ────────────────────────────────────────────────────

    const pendingMessageRef = useRef<string | null>(null);

    const send = useCallback(async (text?: string) => {
        const msg = (text ?? input).trim();
        if (!msg) return;
        setInput("");

        setMessages((prev) => [
            ...prev,
            { role: "user", content: msg, id: nextMsgId() },
        ]);

        if (conversationRef.current?.getId?.()) {
            conversationRef.current.sendUserMessage(msg);
        } else {
            // Clear stale error state so the retry can proceed
            setErrorMessage("");
            setGraceStatus("idle");
            setVoiceFailed(false);
            pendingMessageRef.current = msg;
            await startConversation(true);
        }
    }, [input, startConversation]);

    // ── Navigation handling ──────────────────────────────────────────────────
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
    const onNavigate = useCallback((path: string) => {
        router.push(path);
        setPendingNavigation(null);
    }, [router]);
    const clearPendingNavigation = useCallback(() => setPendingNavigation(null), []);

    // ── Compose context value ────────────────────────────────────────────────

    const contextValue = useMemo((): GraceContextValue => ({
        panelMode,
        openPanel,
        closePanel,
        minimizeToStrip,
        isOpen,
        open: openPanel,
        close: closePanel,
        status: graceStatus,
        messages,
        streamingText,
        input,
        setInput,
        voiceEnabled,
        toggleVoice: toggleVoiceRef.current ?? (async () => {}),
        send,
        startDictation: async () => {},
        stopDictation: () => {},
        stopSpeaking: () => {},
        errorMessage,
        conversationActive,
        startConversation,
        endConversation,
        confirmAction: () => {},
        dismissAction: () => {},
        onNavigate,
        pendingNavigation,
        clearPendingNavigation,
        activeForm,
        updateFormField,
        submitActiveForm,
        dismissActiveForm,
        voiceFailed,
        graceQuery,
        pageContext,
        browsingHistory,
    }), [
        panelMode, openPanel, closePanel, minimizeToStrip, isOpen,
        graceStatus, messages, streamingText, input, voiceEnabled,
        send, errorMessage, conversationActive, startConversation, endConversation,
        onNavigate, pendingNavigation, clearPendingNavigation,
        activeForm, updateFormField, submitActiveForm, dismissActiveForm,
        voiceFailed, graceQuery, pageContext, browsingHistory,
    ]);

    return (
        <GraceContext.Provider value={contextValue}>
            {children}
        </GraceContext.Provider>
    );
}
