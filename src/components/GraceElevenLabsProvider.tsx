"use client";

/**
 * GraceElevenLabsProvider — ElevenLabs Conversational AI integration.
 *
 * Drop-in replacement for GraceProvider that uses ElevenLabs for voice
 * instead of OpenAI Realtime. Exposes the same GraceContextValue so all
 * downstream UI components (GraceSidePanel, etc.) work unchanged.
 */

import {
    useState,
    useRef,
    useCallback,
    useEffect,
    useMemo,
    type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useConversation } from "@elevenlabs/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCart } from "./CartProvider";
import {
    GraceContext,
    type GraceStatus,
    type GraceMessage,
    type ProductCard,
    type PanelMode,
    type FormType,
    type ActiveForm,
    type PageContext,
    type BrowsingHistoryEntry,
} from "./GraceContext";

// ─── Strip markdown ──────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/_(.*?)_/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// ─── Page context formatter ───────────────────────────────────────────────────

function formatPageContextForGrace(ctx: PageContext | null, history?: BrowsingHistoryEntry[]): string {
    if (!ctx) return "";
    const lines: string[] = ["=== CURRENT SESSION CONTEXT ==="];

    // ── Current page ──────────────────────────────────────────────────────
    if (ctx.pageType === "pdp" && ctx.currentProduct) {
        const p = ctx.currentProduct;
        lines.push(`Page: Product Detail — ${p.name}`);
        lines.push(`Family: ${p.family} | Size: ${p.capacity} | Color: ${p.color}`);
        if (p.neckThreadSize) lines.push(`Thread Size: ${p.neckThreadSize}`);
        if (p.applicator) lines.push(`Applicator: ${p.applicator}`);
        if (p.webPrice1pc) lines.push(`Price: $${p.webPrice1pc.toFixed(2)}/pc`);
        if (p.stockStatus) lines.push(`Stock: ${p.stockStatus}`);
        lines.push(`SKU: ${p.graceSku}`);
        lines.push(`GRACE INSTRUCTION: Customer is viewing this specific product. You KNOW what they're looking at — reference it by name. Offer compatible closures/caps (use getBottleComponents with SKU ${p.graceSku}). Don't ask "which bottle?" — you already know.`);
    } else if (ctx.pageType === "catalog") {
        lines.push(`Page: Product Catalog`);
        if (ctx.currentCollection) lines.push(`Active Family Filter: ${ctx.currentCollection}`);
        if (ctx.catalogSearch) lines.push(`Active Search: "${ctx.catalogSearch}"`);
        lines.push(`GRACE INSTRUCTION: Customer is browsing the catalog. Ask what they're building (fragrance, skincare, etc.) and what size/style they need to help narrow results.`);
    } else if (ctx.pageType === "cart") {
        lines.push(`Page: Shopping Cart`);
        lines.push(`GRACE INSTRUCTION: Customer is reviewing their cart. Offer to help with compatible accessories, quantity adjustments, or proceeding to checkout. Check if they need caps/closures for the bottles in their cart.`);
    } else if (ctx.pageType === "contact") {
        lines.push(`Page: Contact / Request Form`);
        lines.push(`GRACE INSTRUCTION: Customer is on a form page. Offer to help fill it out using updateFormField. Ask for their name and email first.`);
    } else if (ctx.pageType === "about") {
        lines.push(`Page: About Best Bottles`);
        lines.push(`GRACE INSTRUCTION: Customer is learning about the company. Be ready to answer questions about Best Bottles (a division of Nemat International, based in Union City, CA).`);
    } else if (ctx.pageType === "home") {
        lines.push(`Page: Homepage`);
        lines.push(`GRACE INSTRUCTION: Customer just arrived. Welcome them and ask what they're looking for — bottles for fragrance, skincare, essential oils, etc.`);
    } else {
        lines.push(`Page: ${ctx.pathname}`);
    }

    // ── Cart state ────────────────────────────────────────────────────────
    if (ctx.cartItems.length > 0) {
        const cartLines = ctx.cartItems.map((i) => {
            const price = i.unitPrice ? ` @ $${i.unitPrice.toFixed(2)}/pc` : "";
            return `  • ${i.name} ×${i.quantity}${price}`;
        });
        lines.push(`Cart (${ctx.cartItems.length} item${ctx.cartItems.length > 1 ? "s" : ""}${ctx.cartTotal ? `, ~$${ctx.cartTotal.toFixed(2)} total` : ""}):`);
        lines.push(...cartLines);
        lines.push(`GRACE INSTRUCTION: Customer has items in cart. If they're looking at bottles, check if they need compatible closures. If they're looking at closures, verify compatibility with their cart bottles.`);
    } else {
        lines.push(`Cart: Empty`);
    }

    // ── Recent browsing history ───────────────────────────────────────────
    if (history && history.length > 1) {
        // Show the last 5 pages visited (excluding current)
        const recent = history.slice(-6, -1).reverse();
        if (recent.length > 0) {
            lines.push(`Recent browsing:`);
            for (const h of recent) {
                if (h.productName) {
                    lines.push(`  • Viewed: ${h.productName} (${h.productFamily ?? ""} ${h.productCapacity ?? ""})`);
                } else if (h.searchTerm) {
                    lines.push(`  • Searched: "${h.searchTerm}"`);
                } else {
                    lines.push(`  • Visited: ${h.pageType} page`);
                }
            }
            lines.push(`GRACE INSTRUCTION: Use browsing history to make relevant suggestions. If they viewed several products in the same family, they may be comparing — proactively offer a comparison.`);
        }
    }

    lines.push("=== END CONTEXT ===");
    return lines.join("\n");
}

function sanitizeCatalogQuery(rawQuery: string | undefined): string {
    return (rawQuery ?? "")
        .split(/,|\s+and\s+/i)[0]
        .replace(/\s+/g, " ")
        .trim();
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
        // Count products per family and only include the dominant one(s).
        // If one family has 70%+ of results, use only that family — don't
        // pollute the filter with stray results from other families.
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

    // Extract capacity from query (e.g. "3ml", "30ml", "100ml") and pass as search
    // so the catalog page shows the right size, not all products in the family
    const capMatch = query?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
    if (capMatch) {
        qs.set("search", `${capMatch[1]}ml`);
    }

    qs.set("grace", "1");
    return `/catalog?${qs.toString()}`;
}

function buildBrowsePath(products: ProductCard[], query?: string, family?: string): string {
    if (products.length === 1 && products[0].slug) {
        return `/products/${products[0].slug}`;
    }
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
    const stopWords = new Set([
        "a",
        "an",
        "and",
        "bottle",
        "bottles",
        "browse",
        "can",
        "find",
        "for",
        "me",
        "open",
        "please",
        "show",
        "take",
        "the",
        "to",
        "you",
    ]);

    return normalizeSearchText(rawValue)
        .split(" ")
        .filter((token) => token && !stopWords.has(token));
}

function selectDirectProductMatch(products: ProductCard[], query?: string): ProductCard | null {
    const tokens = tokenizeSearchText(query ?? "");
    if (tokens.length < 2) {
        return null;
    }

    const uniqueProducts = Array.from(
        new Map(
            products.map((product) => [product.slug || product.graceSku, product] as const)
        ).values()
    );

    const scored = uniqueProducts
        .map((product) => {
            const primaryItemName = product.itemName.split(/[.!?]/)[0] ?? product.itemName;
            const haystack = normalizeSearchText([
                primaryItemName,
                product.family,
                product.capacity,
                product.color,
                product.applicator,
                product.neckThreadSize,
                product.graceSku,
                product.slug,
            ]
                .filter(Boolean)
                .join(" "));
            const matches = tokens.filter((token) => haystack.includes(token)).length;
            return {
                product,
                matches,
                coverage: matches / tokens.length,
            };
        })
        .sort((a, b) => b.coverage - a.coverage || b.matches - a.matches);

    const [best, secondBest] = scored;
    if (!best?.product.slug || best.coverage < 0.75) {
        return null;
    }
    // If the second-best is nearly as good, check if they share the same slug
    // (same product group, different variants). If so, it's not ambiguous — pick the best.
    if (secondBest && secondBest.coverage >= best.coverage - 0.1 && secondBest.matches >= best.matches - 1) {
        // Same product group → not ambiguous, use the best match
        if (secondBest.product.slug === best.product.slug) {
            return best.product;
        }
        // Different product groups with similar scores → genuinely ambiguous, show catalog
        return null;
    }

    return best.product;
}

function normalizeTextIntentQuery(rawMessage: string): string {
    return rawMessage
        .replace(/^(can you\s+)?(please\s+)?/i, "")
        .replace(/^(show|find|browse|open)\s+(me\s+)?/i, "")
        .replace(/^take me to\s+/i, "")
        .replace(/^i(?:'| a)?m looking for\s+/i, "")
        .replace(/^looking for\s+/i, "")
        .replace(/^the\s+/i, "")
        .replace(/[?.!]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function isGenericPromptChip(rawMessage: string): boolean {
    const normalized = rawMessage.trim().toLowerCase();
    return [
        "find a bottle",
        "check compatibility",
        "volume pricing",
        "track my order",
        "pair a cap",
        "view compatibility",
        "see bulk pricing",
    ].includes(normalized);
}

const ELEVENLABS_TRANSPORT =
    process.env.NEXT_PUBLIC_GRACE_ELEVENLABS_TRANSPORT === "webrtc"
        ? "webrtc"
        : process.env.NEXT_PUBLIC_GRACE_ELEVENLABS_TRANSPORT === "auto"
            ? "auto"
            : "websocket";

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function GraceElevenLabsProvider({
    children,
    forceTextOnly = false,
}: {
    children: ReactNode;
    forceTextOnly?: boolean;
}) {
    const { addItems: addToCart, items: cartItems } = useCart();

    // ── Page context capture ─────────────────────────────────────────────────
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const pageType = useMemo(() => {
        if (pathname === "/") return "home" as const;
        if (pathname.startsWith("/catalog")) return "catalog" as const;
        if (pathname.startsWith("/products/")) return "pdp" as const;
        if (pathname.startsWith("/cart")) return "cart" as const;
        if (pathname.startsWith("/contact") || pathname.startsWith("/request")) return "contact" as const;
        if (pathname.startsWith("/about")) return "about" as const;
        return "other" as const;
    }, [pathname]);

    const productSlug = pageType === "pdp" ? (pathname.split("/products/")[1] ?? null) : null;

    const productGroupResult = useQuery(
        api.products.getProductGroup,
        productSlug ? { slug: productSlug } : "skip"
    );

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
                pageType,
                pathname,
                cartItems: cartSummary,
                cartTotal,
                currentProduct: {
                    name: g.displayName,
                    family: g.family ?? "",
                    capacity: g.capacity ?? "",
                    color: g.color ?? "",
                    neckThreadSize: g.neckThreadSize ?? null,
                    graceSku: g.primaryGraceSku ?? "",
                    webPrice1pc: g.priceRangeMin ?? null,
                    webPrice12pc: null,
                    applicator: (g.applicatorTypes as string[] | undefined)?.[0] ?? undefined,
                    slug: productSlug ?? undefined,
                },
            };
        }
        if (pageType === "catalog") {
            const familiesParam = searchParams.get("families") ?? searchParams.get("family");
            return {
                pageType,
                pathname,
                cartItems: cartSummary,
                cartTotal,
                currentCollection: familiesParam ?? searchParams.get("collection") ?? undefined,
                catalogSearch: searchParams.get("search") ?? undefined,
            };
        }
        return { pageType, pathname, cartItems: cartSummary, cartTotal };
    }, [pageType, pathname, productGroupResult, productSlug, searchParams, cartItems]);

    const pageContextRef = useRef<PageContext | null>(null);
    useEffect(() => { pageContextRef.current = pageContext; }, [pageContext]);

    // ── Browsing history — track pages the customer visits this session ────
    const [browsingHistory, setBrowsingHistory] = useState<BrowsingHistoryEntry[]>([]);
    const browsingHistoryRef = useRef<BrowsingHistoryEntry[]>([]);
    useEffect(() => { browsingHistoryRef.current = browsingHistory; }, [browsingHistory]);

    // Record a new history entry whenever the page context changes
    useEffect(() => {
        if (!pageContext) return;
        // Deduplicate — don't record the same pathname twice in a row
        const last = browsingHistoryRef.current[browsingHistoryRef.current.length - 1];
        if (last?.pathname === pageContext.pathname) return;

        const entry: BrowsingHistoryEntry = {
            pathname: pageContext.pathname,
            pageType: pageContext.pageType,
            visitedAt: new Date().toISOString(),
        };
        if (pageContext.pageType === "pdp" && pageContext.currentProduct) {
            entry.productName = pageContext.currentProduct.name;
            entry.productFamily = pageContext.currentProduct.family;
            entry.productCapacity = pageContext.currentProduct.capacity;
        }
        if (pageContext.pageType === "catalog" && pageContext.catalogSearch) {
            entry.searchTerm = pageContext.catalogSearch;
        }

        setBrowsingHistory((prev) => [...prev.slice(-49), entry]); // keep last 50 entries
    }, [pageContext]);

    const [panelMode, setPanelMode] = useState<PanelMode>("closed");
    const [status, setStatus] = useState<GraceStatus>("idle");
    const [messages, setMessages] = useState<GraceMessage[]>([]);
    const [input, setInput] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [conversationActive, setConversationActive] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
    const [voiceFailed, setVoiceFailed] = useState(false);
    const [graceQuery, setGraceQuery] = useState(""); // what Grace is currently surfacing

    // Stable ref for graceQuery (used inside clientTools which have [] deps)
    const graceQueryRef = useRef("");
    useEffect(() => { graceQueryRef.current = graceQuery; }, [graceQuery]);

    // ── Ref mirrors — break stale-closure bugs without recreating callbacks ──
    const voiceEnabledRef = useRef(voiceEnabled);
    useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

    const conversationActiveRef = useRef(conversationActive);
    useEffect(() => { conversationActiveRef.current = conversationActive; }, [conversationActive]);

    // Prevents a second startSession while one is already in-flight
    const connectingRef = useRef(false);

    // Prevents double endSession (SDK throws "WebSocket already CLOSING/CLOSED" if we call again)
    const closingRef = useRef(false);

    // Timestamp of last endSession — used to delay reconnection so old socket fully closes
    const lastEndSessionRef = useRef<number>(0);

    // Timestamp of last successful connection — used to detect immediate disconnects
    const lastConnectTimeRef = useRef<number>(0);

    // Stable ref to the conversation object — filled after useConversation runs
    const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

    const askGrace = useAction(api.grace.askGrace);
    const submitFormMutation = useMutation(api.forms.submit);

    // Keep submitFormMutation in a ref so clientTools (empty deps) can call latest version
    const submitFormMutationRef = useRef(submitFormMutation);
    useEffect(() => { submitFormMutationRef.current = submitFormMutation; }, [submitFormMutation]);

    // ── Active conversational form ────────────────────────────────────────────
    const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);

    // Mirror so clientTools (empty deps) can always access latest form state
    const activeFormRef = useRef<ActiveForm | null>(null);
    useEffect(() => { activeFormRef.current = activeForm; }, [activeForm]);

    // ── Stable event handlers ────────────────────────────────────────────────
    // All of these are useCallback with [] deps so they're the SAME object
    // reference on every render. This prevents useConversation from seeing
    // "changed" options and tearing down a live WebSocket.

    const handleConnect = useCallback((props: { conversationId: string }) => {
        console.log("[Grace EL] Connected — session live, conversationId:", props.conversationId);
        connectingRef.current = false;
        lastConnectTimeRef.current = Date.now();
        setStatus("listening");
    }, []);

    const handleDisconnect = useCallback((details: { reason: string; message?: string; context?: unknown; closeCode?: number; closeReason?: string }) => {
        const sinceConnect = Date.now() - lastConnectTimeRef.current;
        const wasImmediateDrop = lastConnectTimeRef.current > 0 && sinceConnect < 3000;
        console.log(`[Grace EL] Disconnected — cleaning up state (${sinceConnect}ms after connect, immediate=${wasImmediateDrop})`);
        if (details) {
            console.log("[Grace EL] Disconnect details:", JSON.stringify(details, null, 2));
        }
        connectingRef.current = false;
        closingRef.current = false;
        lastConnectTimeRef.current = 0;
        setConversationActive(false);
        setStatus("idle");

        if (wasImmediateDrop) {
            setVoiceFailed(true);
            setMessages((prev) => [
                ...prev,
                {
                    role: "grace" as const,
                    content:
                        "Voice connection dropped — no worries! " +
                        "Just type your question below and I'll help you in text mode.",
                    id: `g-${Date.now()}`,
                },
            ]);
            setPanelMode("open");
        }
    }, []);

    const handleMessage = useCallback((message: { source: string; message: string }) => {
        if (message.source === "user" && message.message) {
            setMessages((prev) => [
                ...prev,
                { role: "user", content: message.message, id: `u-${Date.now()}` },
            ]);
        } else if (message.source === "ai" && message.message) {
            setMessages((prev) => [
                ...prev,
                { role: "grace", content: stripMarkdown(message.message), id: `g-${Date.now()}` },
            ]);
        }
    }, []);

    const handleModeChange = useCallback((mode: { mode: string }) => {
        if (mode.mode === "speaking") setStatus("speaking");
        else if (mode.mode === "listening") {
            setStatus("listening");
        }
    }, []);

    const handleError = useCallback((message: string, context?: unknown) => {
        console.error("[Grace EL] Error:", message, context);
        connectingRef.current = false;
        closingRef.current = false;
        const raw = message || "Connection error";
        const msg = /microphone|mic|permission|NotAllowedError|denied/i.test(raw)
            ? "Microphone permission is blocked. Please allow mic access and try again."
            : raw;
        setErrorMessage(msg);
        setStatus("error");
        setTimeout(() => {
            setErrorMessage("");
            setStatus(conversationActiveRef.current ? "listening" : "idle");
        }, 4000);
    }, []);

    const handleDebug = useCallback((debug: unknown) => {
        console.log("[Grace EL DEBUG]", debug);
    }, []);

    const handleStatusChange = useCallback((ev: { status: string }) => {
        console.log("[Grace EL] SDK status →", ev.status);
    }, []);

    const handleInterruption = useCallback(() => {
        // No-op — ElevenLabs handles interruption natively
    }, []);

    // ── Stable clientTools ────────────────────────────────────────────────────
    // useMemo with [] ensures this object is created ONCE and never changes.
    // useConversation compares options by reference — without this, every
    // render produces a new object → SDK tears down the live WebSocket.

    const clientTools = useMemo(() => ({
        showProducts: async (parameters: { query: string; family?: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool_name: "searchCatalog",
                        parameters: {
                            searchTerm: parameters.query ?? "",
                            familyLimit: parameters.family,
                        },
                    }),
                });
                const data = await r.json() as { result?: ProductCard[] };
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];

                if (products.length > 0) {
                    // Filter out false positives: products where the query "1ml"
                    // matched the oz value (e.g. "1oz", "1.69oz") instead of actual 1ml products
                    const requestedCapMatch = parameters.query?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
                    const requestedMl = requestedCapMatch ? parseFloat(requestedCapMatch[1]) : null;

                    // Applicator-specific minimum sizes — if someone asks for a size below
                    // the minimum for that applicator type, warn immediately
                    const queryLower = (parameters.query || "").toLowerCase();
                    const isRollOnQuery = /roll.?on|roller/i.test(queryLower);
                    const ROLLON_MIN_ML = 5; // Smallest roll-on is 5ml (Tulip, Sleek, Cylinder)

                    if (isRollOnQuery && requestedMl && requestedMl < ROLLON_MIN_ML) {
                        const rollOnSizes = products
                            .filter((p) => /roller|roll/i.test(p.applicator || ""))
                            .map((p) => p.capacity)
                            .filter(Boolean);
                        const uniqueSizes = [...new Set(rollOnSizes)].slice(0, 5).join(", ");
                        return `WARNING: We do NOT stock roll-on bottles smaller than 5ml. A ${requestedMl}ml roll-on does NOT exist. Do NOT tell the customer we have it. Our smallest roll-on is 5ml (available in Tulip, Sleek, and Cylinder). Available roll-on sizes: ${uniqueSizes || "5ml, 9ml, 15ml, 28ml, 30ml"}. Suggest the 5ml roll-on as the closest alternative.`;
                    }

                    let exactSizeFound = true;
                    let sizeWarning = "";
                    if (requestedMl) {
                        // Tolerance scales with size: ±1ml for small bottles, ±10% for larger
                        // 3ml→3.3ml (ok), 5ml→5.5ml (ok), but 70ml≠78ml, 50ml≠60ml
                        const tolerance = Math.max(1, requestedMl * 0.1);
                        const hasExactSize = products.some((p) => {
                            const pMl = parseFloat(p.capacity || "0");
                            return pMl > 0 && Math.abs(pMl - requestedMl) <= tolerance;
                        });
                        if (!hasExactSize) {
                            exactSizeFound = false;
                            // Deduplicate and sort available sizes for a clean message
                            const sizeSet = new Map<number, string>();
                            for (const p of products) {
                                const ml = parseFloat(p.capacity || "0");
                                if (ml > 0 && p.capacity && !sizeSet.has(ml)) {
                                    sizeSet.set(ml, p.capacity);
                                }
                            }
                            const sortedSizes = [...sizeSet.entries()]
                                .sort(([a], [b]) => a - b)
                                .map(([, label]) => label)
                                .slice(0, 6);
                            const availableSizes = sortedSizes.join(", ");
                            // Also note which families these sizes belong to
                            const families = [...new Set(products.map((p) => p.family).filter(Boolean))].slice(0, 4).join(", ");
                            sizeWarning = `WARNING: We do NOT stock a ${requestedMl}ml in this search (families: ${families}). Do NOT tell the customer we have it. The available sizes are: ${availableSizes}. Tell the customer the exact sizes we DO carry and suggest the closest alternative.`;
                        }
                    }

                    const directProduct = selectDirectProductMatch(products, parameters.query);
                    const displayProducts = directProduct ? [directProduct] : products;
                    const redirectUrl = buildBrowsePath(displayProducts, parameters.query, parameters.family);

                    const summary = displayProducts.slice(0, 3)
                        .map((p) => [p.itemName, p.capacity, p.color].filter(Boolean).join(" "))
                        .join(", ");

                    // Build result message — include size warning if requested size doesn't exist
                    const resultMsg = sizeWarning
                        ? `${sizeWarning} Search returned ${products.length} nearby products: ${summary}.`
                        : `Found ${products.length} options — top matches: ${summary}. Navigating the customer there now.`;

                    // Only navigate if we found the right size — don't navigate to wrong products
                    if (exactSizeFound) {
                        // IMPORTANT: Schedule navigation AFTER returning the result to ElevenLabs.
                        // If we navigate before returning, the component unmounts and the
                        // WebSocket dies — the LLM never receives the tool result.
                        setTimeout(() => {
                            setGraceQuery(parameters.query || parameters.family || "");
                            setPendingNavigation(redirectUrl);
                            setPanelMode("strip");
                        }, 500);
                    }

                    return resultMsg;
                }
                return "No products found matching that description. The customer should try a different size or family.";
            } catch (e) {
                console.error("[Grace EL] showProducts error:", e);
                return "Catalog search failed. Please try again.";
            }
        },

        compareProducts: async (parameters: { query: string; family?: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool_name: "searchCatalog",
                        parameters: {
                            searchTerm: parameters.query ?? "",
                            familyLimit: parameters.family,
                        },
                    }),
                });
                const data = await r.json() as { result?: ProductCard[] };
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];
                if (products.length > 0) {
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "grace",
                            content: "",
                            id: `a-${Date.now()}`,
                            action: { type: "compareProducts", products: products.slice(0, 4) },
                        },
                    ]);
                    const summary = products.slice(0, 4)
                        .map((p) => [p.itemName, p.capacity, p.color].filter(Boolean).join(" "))
                        .join("; ");
                    return `Comparing ${Math.min(products.length, 4)} products: ${summary}. Comparison cards are now displayed to the customer.`;
                }
                return "No products found to compare for that description.";
            } catch (e) {
                console.error("[Grace EL] compareProducts error:", e);
                return "Catalog search failed. Please try again.";
            }
        },

        proposeCartAdd: (parameters: {
            products: Array<{
                itemName: string;
                graceSku: string;
                quantity?: number;
                webPrice1pc?: number;
            }>;
        }) => {
            const products = (parameters.products ?? []).map((p) => ({
                ...p,
                quantity: p.quantity ?? 1,
            }));
            setMessages((prev) => [
                ...prev,
                {
                    role: "grace",
                    content: "",
                    id: `a-${Date.now()}`,
                    action: { type: "proposeCartAdd", products, awaitingConfirmation: true },
                },
            ]);
            return "Confirmation card shown to customer. Waiting for their response.";
        },

        navigateToPage: async (parameters: {
            path: string;
            title: string;
            description?: string;
            autoNavigate?: boolean;
            prefillFields?: Record<string, string>;
        }) => {
            // If Grace collected form data during the conversation, embed it as
            // URL search params so FormPage has the values the moment it mounts
            // (avoids the race condition where grace:prefillForm fires before
            // the form page is mounted and listening).
            let navPath = parameters.path ?? "/";
            if (parameters.prefillFields && Object.keys(parameters.prefillFields).length > 0) {
                const qs = new URLSearchParams(parameters.prefillFields).toString();
                navPath = `${navPath}?${qs}`;
            }

            // Validate product paths — Grace often fabricates slugs from product names.
            // When the slug doesn't exist, search the catalog using the TITLE (which
            // contains the actual product description) to find the real product.
            if (navPath.startsWith("/products/")) {
                const rawSlug = navPath.replace(/^\/products\//, "").split("?")[0];
                try {
                    const checkRes = await fetch("/api/elevenlabs/server-tools", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tool_name: "getProductGroup", parameters: { slug: rawSlug } }),
                    });
                    const checkData = await checkRes.json() as { result?: { group?: unknown } | null };
                    const groupExists = checkData.result && (checkData.result as { group?: unknown }).group;

                    if (!groupExists) {
                        // Slug doesn't exist — use the title (e.g. "3ml spray bottle")
                        // as a search term instead of the garbled slug
                        const searchTerm = parameters.title && parameters.title.length > 3
                            ? parameters.title
                            : slugToSearchTerm(rawSlug);
                        console.warn(`[Grace nav] Slug "${rawSlug}" not found — searching for "${searchTerm}"`);
                        const searchRes = await fetch("/api/elevenlabs/server-tools", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                tool_name: "searchCatalog",
                                parameters: { searchTerm },
                            }),
                        });
                        const searchData = await searchRes.json() as { result?: ProductCard[] };
                        const hits: ProductCard[] = Array.isArray(searchData.result) ? searchData.result : [];

                        if (hits.length > 0) {
                            // Try direct match first — navigate to exact product if possible
                            const directHit = selectDirectProductMatch(hits, searchTerm);
                            navPath = directHit
                                ? `/products/${directHit.slug}`
                                : buildBrowsePath(hits, searchTerm);
                        } else {
                            // No matches — fall back to catalog search
                            navPath = buildCatalogPath([], searchTerm);
                        }
                    }
                } catch (e) {
                    console.error("[Grace nav] Slug validation failed:", e);
                    // Continue with original path on error
                }
            }

            // Append grace=1 to catalog paths so the catalog can show the "Grace found these" banner
            if (navPath.startsWith("/catalog")) {
                const sep = navPath.includes("?") ? "&" : "?";
                navPath = `${navPath}${sep}grace=1`;
            }

            // Default to auto-navigate — Grace should take users directly to pages
            const shouldAutoNav = parameters.autoNavigate !== false;
            setMessages((prev) => [
                ...prev,
                {
                    role: "grace",
                    content: "",
                    id: `a-${Date.now()}`,
                    action: {
                        type: "navigateToPage",
                        path: navPath,
                        title: parameters.title ?? "Page",
                        description: parameters.description,
                        autoNavigate: shouldAutoNav,
                    },
                },
            ]);
            if (shouldAutoNav) {
                // Schedule navigation AFTER returning result to ElevenLabs.
                // Navigating immediately unmounts the component and kills the WebSocket
                // before the LLM receives the tool result.
                setTimeout(() => {
                    setPendingNavigation(navPath);
                    setPanelMode(conversationActiveRef.current ? "strip" : "closed");
                }, 500);
            }
            return shouldAutoNav
                ? `Navigating the customer to ${parameters.title ?? "the page"} now.`
                : "Navigation card shown to customer.";
        },

        prefillForm: (parameters: {
            formType: "sample" | "quote" | "contact" | "newsletter";
            fields: Record<string, string>;
        }) => {
            const fType = parameters.formType ?? "contact";
            const fFields = parameters.fields ?? {};
            window.dispatchEvent(
                new CustomEvent("grace:prefillForm", { detail: { formType: fType, fields: fFields } })
            );
            setMessages((prev) => [
                ...prev,
                {
                    role: "grace",
                    content: "",
                    id: `a-${Date.now()}`,
                    action: { type: "prefillForm", formType: fType, fields: fFields },
                },
            ]);
            return "Form pre-filled and shown to customer for review.";
        },
        // ── updateFormField — field-by-field live form fill ──────────────────
        // Creates the form if it doesn't exist yet, then updates one field.
        // Opens the panel so customer sees the form appearing in real time.
        updateFormField: (parameters: {
            formType: "sample" | "quote" | "contact" | "newsletter";
            fieldName: string;
            value: string;
        }) => {
            const { formType, fieldName, value } = parameters;
            setActiveForm((prev) => {
                if (!prev) {
                    return {
                        formType: formType as FormType,
                        fields: { [fieldName]: value },
                        filledOrder: [fieldName],
                        submitting: false,
                        submitted: false,
                        error: "",
                    };
                }
                const alreadyFilled = prev.filledOrder.includes(fieldName);
                return {
                    ...prev,
                    formType: formType as FormType,
                    fields: { ...prev.fields, [fieldName]: value },
                    filledOrder: alreadyFilled
                        ? prev.filledOrder
                        : [...prev.filledOrder, fieldName],
                };
            });
            // Ensure panel is open so the form is visible
            setPanelMode("open");
            return `Field "${fieldName}" set to "${value}". The live form is visible to the customer.`;
        },

        // ── submitForm — Grace-initiated Convex mutation ─────────────────────
        submitForm: async () => {
            const form = activeFormRef.current;
            if (!form) return "No active form to submit. Use updateFormField to collect details first.";
            if (!form.fields.email)
                return "Cannot submit — the customer's email address is required. Please ask for it.";
            if (form.submitted) return "Form has already been submitted successfully.";
            if (form.submitting) return "Form submission is already in progress.";

            setActiveForm((prev) => (prev ? { ...prev, submitting: true, error: "" } : null));
            try {
                await submitFormMutationRef.current({
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
                setActiveForm((prev) =>
                    prev ? { ...prev, submitting: false, submitted: true } : null
                );
                return "Form submitted successfully. Confirm to the customer and thank them.";
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : "Submission failed";
                setActiveForm((prev) =>
                    prev ? { ...prev, submitting: false, error: errMsg } : null
                );
                return `Submission failed: ${errMsg}. Ask the customer to try clicking Submit themselves.`;
            }
        },

        // ── DATA-ONLY TOOLS — query Convex without navigating ─────────────
        // These let Grace LOOK UP product info to answer questions accurately
        // without triggering page navigation. Critical for voice conversations.

        searchCatalog: async (parameters: { searchTerm: string; familyLimit?: string; applicatorFilter?: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool_name: "searchCatalog",
                        parameters: {
                            searchTerm: parameters.searchTerm ?? "",
                            familyLimit: parameters.familyLimit,
                            applicatorFilter: parameters.applicatorFilter,
                        },
                    }),
                });
                const data = await r.json() as { result?: ProductCard[] };
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];

                if (products.length === 0) {
                    return "No products found matching that description. Try a different search term or ask the customer to clarify.";
                }

                // Check if requested capacity exists
                const capMatch = parameters.searchTerm?.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
                const requestedMl = capMatch ? parseFloat(capMatch[1]) : null;
                let sizeNote = "";
                if (requestedMl) {
                    const tolerance = Math.max(1, requestedMl * 0.1);
                    const hasSize = products.some((p) => {
                        const pMl = parseFloat(p.capacity || "0");
                        return pMl > 0 && Math.abs(pMl - requestedMl) <= tolerance;
                    });
                    if (!hasSize) {
                        const sizes = [...new Set(products.map((p) => p.capacity).filter(Boolean))].slice(0, 6).join(", ");
                        sizeNote = ` WARNING: ${requestedMl}ml does NOT exist. Available sizes: ${sizes}. Do NOT tell the customer we have ${requestedMl}ml.`;
                    }
                }

                // Return a structured summary the LLM can use to answer accurately
                const uniqueProducts = new Map<string, ProductCard>();
                for (const p of products) {
                    const key = `${p.family}-${p.capacity}-${p.color}`;
                    if (!uniqueProducts.has(key)) uniqueProducts.set(key, p);
                }
                const summary = [...uniqueProducts.values()].slice(0, 8).map((p) =>
                    `${p.family} ${p.capacity || ""} ${p.color || ""} (${p.applicator || "N/A"}, thread: ${p.neckThreadSize || "N/A"})`
                ).join("; ");

                return `Found ${products.length} products.${sizeNote} Top matches: ${summary}`;
            } catch (e) {
                console.error("[Grace EL] searchCatalog error:", e);
                return "Search failed. Please try again.";
            }
        },

        getFamilyOverview: async (parameters: { family: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool_name: "getFamilyOverview",
                        parameters: { family: parameters.family },
                    }),
                });
                const data = await r.json() as { result?: Record<string, unknown> };
                if (!data.result) return `No data found for the ${parameters.family} family.`;

                const v = data.result as {
                    sizes?: Array<{ label: string; ml: number; variantCount: number }>;
                    colors?: string[];
                    applicatorTypes?: string[];
                    threadSizes?: string[];
                    priceRange?: { min: number; max: number };
                };

                const sizes = (v.sizes || []).map((s) => s.label).join(", ");
                const colors = (v.colors || []).join(", ");
                const applicators = (v.applicatorTypes || []).join(", ");
                const threads = (v.threadSizes || []).join(", ");

                return `${parameters.family} family — Sizes: ${sizes}. Colors: ${colors}. Applicators: ${applicators}. Thread sizes: ${threads}.`;
            } catch (e) {
                console.error("[Grace EL] getFamilyOverview error:", e);
                return "Lookup failed. Please try again.";
            }
        },

        getBottleComponents: async (parameters: { bottleSku: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool_name: "getBottleComponents",
                        parameters: { bottleSku: parameters.bottleSku },
                    }),
                });
                const data = await r.json() as { result?: Record<string, unknown> | null };
                if (!data.result) return `No compatible components found for SKU "${parameters.bottleSku}". This SKU may not exist or may not be a bottle (only bottles have compatible closures). Verify the SKU with searchCatalog first.`;

                // Parse the structured result into a human-readable summary
                const result = data.result as {
                    bottle?: { itemName?: string; neckThreadSize?: string; family?: string; capacity?: string };
                    components?: Record<string, Array<{
                        graceSku?: string;
                        itemName?: string;
                        webPrice1pc?: number;
                        capColor?: string;
                        stockStatus?: string;
                    }>>;
                };

                const lines: string[] = [];
                if (result.bottle) {
                    lines.push(`Bottle: ${result.bottle.itemName ?? parameters.bottleSku}`);
                    lines.push(`Thread: ${result.bottle.neckThreadSize ?? "unknown"} | Family: ${result.bottle.family ?? "unknown"} | Size: ${result.bottle.capacity ?? "unknown"}`);
                }

                if (result.components) {
                    for (const [type, items] of Object.entries(result.components)) {
                        if (!Array.isArray(items) || items.length === 0) continue;
                        const typeName = type.replace(/([A-Z])/g, " $1").trim();
                        lines.push(`\n${typeName} (${items.length} options):`);
                        for (const item of items.slice(0, 6)) {
                            const price = item.webPrice1pc ? `$${item.webPrice1pc.toFixed(2)}/pc` : "price TBD";
                            const color = item.capColor ? `, ${item.capColor}` : "";
                            const stock = item.stockStatus ? ` [${item.stockStatus}]` : "";
                            lines.push(`  • ${item.itemName ?? item.graceSku}${color} — ${price}${stock}`);
                        }
                        if (items.length > 6) lines.push(`  ... and ${items.length - 6} more options`);
                    }
                }

                return lines.length > 0
                    ? lines.join("\n")
                    : `Compatible components: ${JSON.stringify(data.result).slice(0, 800)}`;
            } catch (e) {
                console.error("[Grace EL] getBottleComponents error:", e);
                return "Component lookup failed. Please try again.";
            }
        },

        // ── checkCompatibility — thread-size-based reverse lookup ─────────
        checkCompatibility: async (parameters: { threadSize: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool_name: "checkCompatibility",
                        parameters: { threadSize: parameters.threadSize },
                    }),
                });
                const data = await r.json() as { result?: Array<Record<string, unknown>> };
                const fitments = Array.isArray(data.result) ? data.result : [];

                if (fitments.length === 0) {
                    return `No bottles found with thread size "${parameters.threadSize}". Common thread sizes are: 13-415, 15-415, 18-415, 20-410, 24-410, 28-410. Try one of those.`;
                }

                const lines = [`Bottles compatible with ${parameters.threadSize} thread (${fitments.length} found):`];
                for (const f of fitments.slice(0, 10)) {
                    lines.push(`  • ${f.bottleName ?? f.bottleCode} — ${f.capacityMl ?? "?"}ml (${f.familyHint ?? "unknown family"})`);
                }
                if (fitments.length > 10) lines.push(`  ... and ${fitments.length - 10} more`);
                return lines.join("\n");
            } catch (e) {
                console.error("[Grace EL] checkCompatibility error:", e);
                return "Compatibility check failed. Please try again.";
            }
        },

        // ── getCatalogStats — high-level catalog summary ─────────────────
        getCatalogStats: async () => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tool_name: "getCatalogStats", parameters: {} }),
                });
                const data = await r.json() as { result?: Record<string, unknown> };
                if (!data.result) return "Could not retrieve catalog statistics.";

                const stats = data.result as {
                    totalVariants?: number;
                    totalGroups?: number;
                    familyCounts?: Record<string, number>;
                    categoryCounts?: Record<string, number>;
                };

                const lines = [
                    `Best Bottles Catalog: ${stats.totalVariants ?? "2,285"} individual SKUs across ${stats.totalGroups ?? "230"} product groups.`,
                ];
                if (stats.familyCounts) {
                    const families = Object.entries(stats.familyCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([name, count]) => `${name} (${count})`)
                        .join(", ");
                    lines.push(`Families: ${families}`);
                }
                if (stats.categoryCounts) {
                    const categories = Object.entries(stats.categoryCounts)
                        .map(([name, count]) => `${name} (${count})`)
                        .join(", ");
                    lines.push(`Categories: ${categories}`);
                }
                lines.push(`Note: These are product counts, not live inventory levels. Use searchCatalog with a specific product to check individual stock status.`);
                return lines.join("\n");
            } catch (e) {
                console.error("[Grace EL] getCatalogStats error:", e);
                return "Stats lookup failed.";
            }
        },

        // ══════════════════════════════════════════════════════════════════
        // NEW TOOLS — Give Grace "eyes" and situational awareness
        // ══════════════════════════════════════════════════════════════════

        // ── getCurrentPageContext — Grace can "see" what the customer sees ─
        getCurrentPageContext: () => {
            const ctx = pageContextRef.current;
            if (!ctx) return "No page context available — the customer may not have loaded a page yet.";

            const lines: string[] = [];
            lines.push(`Page type: ${ctx.pageType}`);
            lines.push(`URL: ${ctx.pathname}`);

            if (ctx.pageType === "pdp" && ctx.currentProduct) {
                const p = ctx.currentProduct;
                lines.push(`\nCustomer is viewing a product:`);
                lines.push(`  Product: ${p.name}`);
                lines.push(`  Family: ${p.family}`);
                lines.push(`  Size: ${p.capacity}`);
                lines.push(`  Color: ${p.color}`);
                if (p.neckThreadSize) lines.push(`  Thread Size: ${p.neckThreadSize}`);
                if (p.applicator) lines.push(`  Applicator: ${p.applicator}`);
                if (p.graceSku) lines.push(`  SKU: ${p.graceSku}`);
                if (p.webPrice1pc) lines.push(`  Price: $${p.webPrice1pc.toFixed(2)}/pc`);
                if (p.slug) lines.push(`  Slug: ${p.slug}`);
            } else if (ctx.pageType === "catalog") {
                lines.push(`\nCustomer is browsing the catalog.`);
                if (ctx.currentCollection) lines.push(`  Active filter: ${ctx.currentCollection}`);
                if (ctx.catalogSearch) lines.push(`  Search term: "${ctx.catalogSearch}"`);
            } else if (ctx.pageType === "cart") {
                lines.push(`\nCustomer is on the shopping cart page.`);
            } else if (ctx.pageType === "contact") {
                lines.push(`\nCustomer is on a contact/request form page.`);
            } else if (ctx.pageType === "home") {
                lines.push(`\nCustomer is on the homepage.`);
            }

            // Cart summary
            if (ctx.cartItems.length > 0) {
                lines.push(`\nCart (${ctx.cartItems.length} item${ctx.cartItems.length > 1 ? "s" : ""}):`);
                for (const item of ctx.cartItems) {
                    const price = item.unitPrice ? ` @ $${item.unitPrice.toFixed(2)}/pc` : "";
                    lines.push(`  • ${item.name} ×${item.quantity}${price}`);
                }
                if (ctx.cartTotal) lines.push(`  Total: ~$${ctx.cartTotal.toFixed(2)}`);
            } else {
                lines.push(`\nCart: Empty`);
            }

            return lines.join("\n");
        },

        // ── getCartContents — detailed cart read ──────────────────────────
        getCartContents: () => {
            const ctx = pageContextRef.current;
            if (!ctx) return "No cart data available.";

            if (ctx.cartItems.length === 0) {
                return "The customer's cart is empty. They haven't added any products yet.";
            }

            const lines = [`Cart contains ${ctx.cartItems.length} item${ctx.cartItems.length > 1 ? "s" : ""}:`];
            for (const item of ctx.cartItems) {
                const price = item.unitPrice ? `$${item.unitPrice.toFixed(2)}/pc` : "price TBD";
                const subtotal = item.unitPrice ? ` (subtotal: $${(item.unitPrice * item.quantity).toFixed(2)})` : "";
                lines.push(`  • ${item.name} — SKU: ${item.graceSku} — Qty: ${item.quantity} — ${price}${subtotal}`);
            }
            if (ctx.cartTotal) {
                lines.push(`\nCart total: $${ctx.cartTotal.toFixed(2)}`);
            }
            lines.push(`\nYou can suggest compatible accessories (closures, sprayers, etc.) for the bottles in this cart using getBottleComponents with each bottle's SKU.`);
            return lines.join("\n");
        },

        // ── getBrowsingHistory — what has the customer looked at? ─────────
        getBrowsingHistory: () => {
            const history = browsingHistoryRef.current;
            if (!history || history.length === 0) {
                return "No browsing history yet — the customer just started their session.";
            }

            const lines = [`Customer has visited ${history.length} page${history.length > 1 ? "s" : ""} this session:`];
            // Show most recent first
            const recent = [...history].reverse().slice(0, 15);
            for (const entry of recent) {
                const time = new Date(entry.visitedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                if (entry.productName) {
                    lines.push(`  • [${time}] Viewed product: ${entry.productName} (${entry.productFamily ?? ""} ${entry.productCapacity ?? ""})`);
                } else if (entry.searchTerm) {
                    lines.push(`  • [${time}] Searched catalog: "${entry.searchTerm}"`);
                } else {
                    lines.push(`  • [${time}] Visited: ${entry.pageType} page (${entry.pathname})`);
                }
            }
            if (history.length > 15) lines.push(`  ... and ${history.length - 15} earlier pages`);

            // Add insight
            const productViews = history.filter((h) => h.productName);
            if (productViews.length >= 2) {
                const families = [...new Set(productViews.map((h) => h.productFamily).filter(Boolean))];
                if (families.length === 1) {
                    lines.push(`\nInsight: Customer has viewed ${productViews.length} products all in the ${families[0]} family — they seem focused on this line.`);
                } else if (families.length > 1) {
                    lines.push(`\nInsight: Customer is comparing across families: ${families.join(", ")}. Consider offering a side-by-side comparison.`);
                }
            }

            return lines.join("\n");
        },

        // ── showProductPresentation — display a curated multi-product showcase ─
        showProductPresentation: async (parameters: { searchTerm: string; headline?: string; familyLimit?: string }) => {
            try {
                const r = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool_name: "searchCatalog",
                        parameters: {
                            searchTerm: parameters.searchTerm ?? "",
                            familyLimit: parameters.familyLimit,
                        },
                    }),
                });
                const data = await r.json() as { result?: ProductCard[] };
                const products: ProductCard[] = Array.isArray(data.result) ? data.result : [];

                if (products.length === 0) {
                    return "No products found to present. Try a different search term.";
                }

                // Show up to 6 products in a presentation card
                const presented = products.slice(0, 6);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "grace",
                        content: "",
                        id: `a-${Date.now()}`,
                        action: {
                            type: "showProductPresentation",
                            products: presented,
                            headline: parameters.headline ?? `Here's what I found for "${parameters.searchTerm}"`,
                        },
                    },
                ]);

                const summary = presented
                    .map((p) => `${p.itemName} (${p.capacity ?? ""} ${p.color ?? ""})`)
                    .join("; ");

                return `Presenting ${presented.length} products to the customer: ${summary}. The product cards are now visible. Ask which one interests them or if they'd like details on any specific option.`;
            } catch (e) {
                console.error("[Grace EL] showProductPresentation error:", e);
                return "Product presentation failed. Please try again.";
            }
        },

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []); // intentionally empty — tools use setMessages/setActiveForm (stable setters) and refs only

    // ── useConversation with stable options ──────────────────────────────────
    // All option values are stable (useMemo / useCallback), so the hook
    // never sees a "changed" option and won't tear down a live socket.

    const conversation = useConversation({
        clientTools,
        onConnect: handleConnect,
        onDisconnect: handleDisconnect,
        onMessage: handleMessage,
        onModeChange: handleModeChange,
        onError: handleError,
        onDebug: handleDebug,
        onStatusChange: handleStatusChange,
        onInterruption: handleInterruption,
    });

    // Keep conversationRef in sync so callbacks above can always access latest
    useEffect(() => { conversationRef.current = conversation; });

    // ── Safe SDK helpers (guard against "WebSocket already CLOSING/CLOSED") ───

    const safeEndSession = useCallback(() => {
        if (closingRef.current) return;
        const conv = conversationRef.current;
        if (conv?.status === "connected" || conv?.status === "connecting") {
            closingRef.current = true;
            lastEndSessionRef.current = Date.now();
            // endSession() is async in SDK v0.14+ — fire-and-forget with error handling
            conv.endSession()
                .catch((e: unknown) => {
                    if (!String(e).includes("CLOSING") && !String(e).includes("CLOSED")) {
                        console.warn("[Grace EL] endSession error:", e);
                    }
                })
                .finally(() => {
                    closingRef.current = false;
                });
        }
    }, []);

    const safeSendUserMessage = useCallback((text: string): boolean => {
        const conv = conversationRef.current;
        if (conv?.status !== "connected") return false;
        try {
            conv.sendUserMessage(text);
            return true;
        } catch (e) {
            if (!String(e).includes("CLOSING") && !String(e).includes("CLOSED")) {
                console.warn("[Grace EL] sendUserMessage error:", e);
            }
            return false;
        }
    }, []);

    const safeSetVolume = useCallback((volume: number) => {
        const conv = conversationRef.current;
        if (conv?.status !== "connected") return;
        try {
            conv.setVolume({ volume });
        } catch (e) {
            if (!String(e).includes("CLOSING") && !String(e).includes("CLOSED")) {
                console.warn("[Grace EL] setVolume error:", e);
            }
        }
    }, []);

    // ── Panel controls ───────────────────────────────────────────────────────

    const isOpen = panelMode !== "closed";
    const openPanel = useCallback(() => setPanelMode("open"), []);

    const closePanel = useCallback(() => {
        setPanelMode("closed");
        setConversationActive(false);
        setMessages([]);
        safeEndSession();
    }, [safeEndSession]);

    const minimizeToStrip = useCallback(() => setPanelMode("strip"), []);
    const open = openPanel;

    const close = useCallback(() => {
        setPanelMode("closed");
        setConversationActive(false);
        safeEndSession();
        setStatus("idle");
        setMessages([]);
    }, [safeEndSession]);

    const onNavigate = useCallback(() => {
        setPanelMode(conversationActiveRef.current ? "strip" : "closed");
    }, []);

    const clearPendingNavigation = useCallback(() => setPendingNavigation(null), []);

    // ── Start ElevenLabs voice conversation ──────────────────────────────────

    const startConversation = useCallback(async () => {
        // Text-only mode: skip voice entirely
        if (forceTextOnly) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "grace" as const,
                    content: "Voice is currently disabled. I'm here in text mode — just type your question below.",
                    id: `g-${Date.now()}`,
                },
            ]);
            setPanelMode("open");
            return;
        }

        if (conversationRef.current?.status === "connected") {
            console.log("[Grace EL] startConversation skipped — already connected");
            return;
        }
        // If connectingRef has been stuck for >20s, force-reset it (previous attempt hung)
        if (connectingRef.current) {
            console.warn("[Grace EL] connectingRef was stuck — force-resetting");
            connectingRef.current = false;
            safeEndSession();
        }
        // Allow old socket to fully close before reconnecting
        const sinceLastEnd = Date.now() - lastEndSessionRef.current;
        if (sinceLastEnd < 600) {
            await new Promise((r) => setTimeout(r, 600 - sinceLastEnd));
        }
        connectingRef.current = true;

        try {
            setConversationActive(true);
            setStatus("connecting");
            setErrorMessage("");
            setVoiceFailed(false); // clear previous failure on new attempt

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
                if (!isLocalhost) {
                    throw new Error(
                        "Microphone access requires a secure connection (HTTPS). " +
                        "Please use https:// or access via localhost instead of a network IP."
                    );
                }
            }

            const contextBlock = formatPageContextForGrace(pageContextRef.current, browsingHistoryRef.current);

            // Resolve dynamic variables required by the ElevenLabs agent's first message.
            // The agent greeting uses {{_product_name_}} — if not supplied, ElevenLabs
            // immediately disconnects with "Missing required dynamic variables".
            const page = pageContextRef.current;
            const productName = page?.currentProduct?.name ?? "our collection";

            const buildSessionOverrides = () => ({
                overrides: {
                    ...(contextBlock
                        ? { agent: { prompt: { prompt: contextBlock } } }
                        : {}),
                },
                dynamicVariables: {
                    _product_name_: productName,
                },
            });

            const connectViaWebSocket = async () => {
                const t0 = performance.now();
                const res = await fetch("/api/elevenlabs/signed-url");

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(
                        (err as { error?: string }).error ??
                        "Failed to get ElevenLabs connection. Check ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID."
                    );
                }
                const { signedUrl } = (await res.json()) as { signedUrl?: string };
                if (!signedUrl) throw new Error("ElevenLabs did not return a valid signed URL.");

                console.log(`[Grace EL] Starting WebSocket session (fetch took ${Math.round(performance.now() - t0)}ms)`);

                await conversationRef.current!.startSession({
                    signedUrl,
                    connectionType: "websocket",
                    ...buildSessionOverrides(),
                });
            };

            const connectViaWebRTC = async () => {
                const t0 = performance.now();
                const res = await fetch("/api/elevenlabs/conversation-token");

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(
                        (err as { error?: string }).error ??
                        "Failed to get ElevenLabs conversation token."
                    );
                }

                const { token } = (await res.json()) as { token?: string };
                if (!token) throw new Error("ElevenLabs did not return a valid conversation token.");

                console.log(`[Grace EL] Starting WebRTC session (fetch took ${Math.round(performance.now() - t0)}ms)`);

                await conversationRef.current!.startSession({
                    conversationToken: token,
                    connectionType: "webrtc",
                    ...buildSessionOverrides(),
                });
            };

            // WebSocket has been more stable in this app than WebRTC.
            // WebRTC can still be enabled explicitly for testing, or used as a fallback in auto mode.
            let lastError: unknown;
            const transports: Array<{ label: "WebSocket" | "WebRTC"; connect: () => Promise<void> }> = (
                ELEVENLABS_TRANSPORT === "webrtc"
                    ? [{ label: "WebRTC", connect: connectViaWebRTC }]
                    : ELEVENLABS_TRANSPORT === "auto"
                        ? [
                            { label: "WebSocket", connect: connectViaWebSocket },
                            { label: "WebRTC", connect: connectViaWebRTC },
                        ]
                        : [{ label: "WebSocket", connect: connectViaWebSocket }]
            );

            for (const transport of transports) {
                try {
                    await Promise.race([
                        transport.connect(),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error(`${transport.label} voice connection timed out after 15 seconds.`)), 15000)
                        ),
                    ]);

                    // Brief stability check — verify the socket didn't immediately close.
                    // We check our own ref (reset to 0 by handleDisconnect) rather than
                    // the SDK status to avoid TypeScript narrowing issues.
                    await new Promise((r) => setTimeout(r, 500));
                    if (lastConnectTimeRef.current === 0) {
                        throw new Error("Voice connection dropped immediately after establishing.");
                    }

                    connectingRef.current = false;
                    console.log(`[Grace EL] ${transport.label} session established`);
                    return;
                } catch (e) {
                    lastError = e;
                    console.warn(`[Grace EL] ${transport.label} startSession failed:`, e);
                    safeEndSession();
                    await new Promise((r) => setTimeout(r, 500));
                }
            }

            throw lastError instanceof Error ? lastError : new Error("Failed to establish voice session.");
        } catch (err) {
            console.error("[Grace EL] Connection failed:", err);
            connectingRef.current = false;
            setConversationActive(false);
            setStatus("idle");
            setVoiceFailed(true); // triggers the banner in GraceSidePanel

            // Show a friendly in-chat message instead of a broken error state.
            // Grace continues working in text mode via Convex.
            setMessages((prev) => [
                ...prev,
                {
                    role: "grace" as const,
                    content:
                        "I wasn't able to connect my voice right now — no worries! " +
                        "Just type your question below and I'll help you in text mode.",
                    id: `g-${Date.now()}`,
                },
            ]);
            setPanelMode("open");
        }
    }, [forceTextOnly, safeSetVolume]); // stable for voice path; forceTextOnly is a build-time constant

    const endConversation = useCallback(() => {
        setConversationActive(false);
        safeEndSession();
        setStatus("idle");
    }, [safeEndSession]);

    // ── Toggle / interrupt ───────────────────────────────────────────────────

    const stopSpeaking = useCallback(() => {
        if (status === "speaking") setStatus("listening");
    }, [status]);

    const toggleVoice = useCallback(() => {
        setVoiceEnabled((v) => {
            const next = !v;
            safeSetVolume(next ? 1 : 0);
            return next;
        });
    }, [safeSetVolume]);

    // ── Send text message (text-only falls back to Convex LLM) ──────────────

    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const handleLocalTextIntent = useCallback(
        async (rawMessage: string): Promise<boolean> => {
            const page = pageContextRef.current;
            const normalized = rawMessage.trim().toLowerCase();

            if (
                page?.pageType === "pdp" &&
                page.currentProduct &&
                /(add( this)? to (my )?(order|cart)|add to order)/i.test(normalized)
            ) {
                const current = page.currentProduct;
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "grace",
                        content: "I can add this bottle to your order. Confirm below and I'll place it in your cart.",
                        id: `a-${Date.now()}`,
                        action: {
                            type: "proposeCartAdd",
                            products: [{
                                graceSku: current.graceSku,
                                itemName: current.name,
                                quantity: 1,
                                webPrice1pc: current.webPrice1pc ?? undefined,
                                family: current.family,
                                capacity: current.capacity,
                                color: current.color,
                            }],
                            awaitingConfirmation: true,
                        },
                    },
                ]);
                return true;
            }

            const isBrowseIntent =
                !isGenericPromptChip(rawMessage) &&
                /^(?:can you\s+)?(?:please\s+)?(show|find|browse|open)\b/i.test(rawMessage);
            const isTakeMeThereIntent = /^(?:can you\s+)?(?:please\s+)?take me to\b/i.test(rawMessage);
            if (!isBrowseIntent && !isTakeMeThereIntent) {
                return false;
            }

            const query = normalizeTextIntentQuery(rawMessage);
            if (!query) {
                return false;
            }

            try {
                const searchRes = await fetch("/api/elevenlabs/server-tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool_name: "searchCatalog",
                        parameters: { searchTerm: query },
                    }),
                });
                const searchData = await searchRes.json() as { result?: ProductCard[] };
                const products: ProductCard[] = Array.isArray(searchData.result) ? searchData.result : [];
                if (products.length === 0) {
                    return false;
                }

                const directProduct = selectDirectProductMatch(products, query);
                const displayProducts = directProduct ? [directProduct] : products;
                const redirectUrl = buildBrowsePath(displayProducts, query);
                setGraceQuery(query);
                setPendingNavigation(redirectUrl);
                setPanelMode("strip");

                const summary = displayProducts.slice(0, 3)
                    .map((p) => [p.itemName, p.capacity, p.color].filter(Boolean).join(" "))
                    .join(", ");
                const destinationLabel = displayProducts.length === 1 ? "product page" : "catalog results";
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "grace",
                        content: `Taking you to the ${destinationLabel} now. Found ${displayProducts.length} option${displayProducts.length === 1 ? "" : "s"}${summary ? `, including ${summary}.` : "."}`,
                        id: `g-${Date.now()}`,
                    },
                ]);
                return true;
            } catch (err) {
                console.error("[Grace EL] local text intent search failed:", err);
                return false;
            }
        },
        []
    );

    const send = useCallback(
        async (text?: string, fromVoice = false) => {
            const msg = (text ?? input).trim();
            if (!msg) return;
            setInput("");

            if (conversationActiveRef.current && safeSendUserMessage(msg)) {
                setMessages((prev) => [
                    ...prev,
                    { role: "user", content: msg, id: `u-${Date.now()}` },
                ]);
                setStatus("thinking");
                return;
            }

            // WebSocket is dead or not active — fall through to Convex/Claude text mode
            if (conversationActiveRef.current) {
                console.warn("[Grace EL] Voice WebSocket dead, falling back to text mode");
                setConversationActive(false);
                safeEndSession();
            }

            const userMsg: GraceMessage = { role: "user", content: msg, id: `${Date.now()}` };
            setMessages((prev) => [...prev, userMsg]);
            setStatus("thinking");
            setErrorMessage("");

            if (await handleLocalTextIntent(msg)) {
                setStatus("idle");
                return;
            }

            try {
                const history: Array<{ role: "user" | "assistant"; content: string }> = [
                    ...messagesRef.current.map((m) => ({
                        role: (m.role === "grace" ? "assistant" : "user") as "user" | "assistant",
                        content: m.content,
                    })),
                    { role: "user" as const, content: msg },
                ];

                const tLlm = performance.now();
                const contextBlock = formatPageContextForGrace(pageContextRef.current, browsingHistoryRef.current);
                const response = await Promise.race([
                    (askGrace as (args: { messages: typeof history; voiceMode?: boolean; pageContextBlock?: string }) => Promise<string>)({
                        messages: history,
                        voiceMode: fromVoice,
                        ...(contextBlock ? { pageContextBlock: contextBlock } : {}),
                    }),
                    new Promise<string>((_, reject) =>
                        setTimeout(() => reject(new Error("Grace took too long to respond. Please try again.")), 45000)
                    ),
                ]);
                console.log(`[Grace EL] LLM round-trip: ${Math.round(performance.now() - tLlm)}ms`);

                setMessages((prev) => [
                    ...prev,
                    { role: "grace", content: stripMarkdown(response), id: `${Date.now() + 1}` },
                ]);
                setStatus("idle");
            } catch (err) {
                const errMsg = err instanceof Error
                    ? err.message
                    : "I had trouble connecting just now. Please try again in a moment.";
                console.error("[Grace EL] askGrace failed:", err);
                setErrorMessage(errMsg);
                setMessages((prev) => [
                    ...prev,
                    { role: "grace", content: errMsg, id: `${Date.now() + 1}` },
                ]);
                setStatus("error");
                setTimeout(() => { setStatus("idle"); setErrorMessage(""); }, 4000);
            }
        },
        [input, askGrace, safeSendUserMessage, safeEndSession, handleLocalTextIntent]
    );

    // ── Legacy dictation stubs ───────────────────────────────────────────────

    const startDictation = useCallback(async () => {
        if (!conversationActiveRef.current) startConversation();
    }, [startConversation]);

    const stopDictation = useCallback(() => { /* VAD handled by ElevenLabs natively */ }, []);

    // ── Action confirmation (cart adds) ──────────────────────────────────────

    const confirmAction = useCallback(
        (messageId: string) => {
            setMessages((prev) => {
                const msg = prev.find((m) => m.id === messageId);
                if (msg?.action?.type === "proposeCartAdd") {
                    addToCart(
                        msg.action.products.map((p) => ({
                            graceSku: p.graceSku,
                            itemName: p.itemName,
                            quantity: p.quantity,
                            unitPrice: p.webPrice1pc ?? null,
                            family: p.family,
                            capacity: p.capacity,
                            color: p.color,
                        }))
                    );
                }
                return prev.map((m) => {
                    if (m.id !== messageId || !m.action) return m;
                    if (m.action.type === "proposeCartAdd") {
                        return { ...m, action: { ...m.action, awaitingConfirmation: false } };
                    }
                    return m;
                });
            });

            if (conversationActiveRef.current) {
                safeSendUserMessage(
                    "The customer confirmed. The items have been added to their cart."
                );
            }
        },
        [addToCart, safeSendUserMessage]
    );

    const dismissAction = useCallback((messageId: string) => {
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== messageId || !m.action) return m;
                if (m.action.type === "proposeCartAdd") {
                    return { ...m, action: { ...m.action, awaitingConfirmation: false } };
                }
                return m;
            })
        );
        if (conversationActiveRef.current) {
            safeSendUserMessage("The customer declined. Do not add those items.");
        }
    }, [safeSendUserMessage]);

    // ── Active form helpers ──────────────────────────────────────────────────

    // updateFormField exposed on context (same logic as the clientTool version)
    const updateFormField = useCallback(
        (formType: FormType, fieldName: string, value: string) => {
            setActiveForm((prev) => {
                if (!prev) {
                    return {
                        formType,
                        fields: { [fieldName]: value },
                        filledOrder: [fieldName],
                        submitting: false,
                        submitted: false,
                        error: "",
                    };
                }
                const alreadyFilled = prev.filledOrder.includes(fieldName);
                return {
                    ...prev,
                    formType,
                    fields: { ...prev.fields, [fieldName]: value },
                    filledOrder: alreadyFilled
                        ? prev.filledOrder
                        : [...prev.filledOrder, fieldName],
                };
            });
            setPanelMode("open");
        },
        []
    );

    const submitActiveForm = useCallback(async () => {
        const form = activeFormRef.current;
        if (!form || form.submitted || form.submitting) return;
        setActiveForm((prev) => (prev ? { ...prev, submitting: true, error: "" } : null));
        try {
            await submitFormMutationRef.current({
                formType: form.formType as "sample" | "quote" | "contact" | "newsletter",
                name: form.fields.name || undefined,
                email: form.fields.email || "",
                company: form.fields.company || undefined,
                phone: form.fields.phone || undefined,
                message: form.fields.message || undefined,
                products: form.fields.products || undefined,
                quantities: form.fields.quantities || undefined,
                source: "grace",
            });
            setActiveForm((prev) =>
                prev ? { ...prev, submitting: false, submitted: true } : null
            );
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Something went wrong.";
            setActiveForm((prev) =>
                prev ? { ...prev, submitting: false, error: errMsg } : null
            );
        }
    }, []);

    const dismissActiveForm = useCallback(() => setActiveForm(null), []);

    // ── Cleanup on unmount ───────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            safeEndSession();
        };
    }, [safeEndSession]);

    return (
        <GraceContext.Provider
            value={{
                panelMode,
                openPanel,
                closePanel,
                minimizeToStrip,
                isOpen,
                open,
                close,
                status,
                messages,
                input,
                setInput,
                voiceEnabled,
                toggleVoice,
                send,
                startDictation,
                stopDictation,
                stopSpeaking,
                errorMessage,
                conversationActive,
                startConversation,
                endConversation,
                confirmAction,
                dismissAction,
                onNavigate,
                pendingNavigation,
                clearPendingNavigation,
                // ── Live form ──────────────────────────────────────────
                activeForm,
                updateFormField,
                submitActiveForm,
                dismissActiveForm,
                voiceFailed,
                graceQuery,
                pageContext,
                browsingHistory,
            }}
        >
            {children}
        </GraceContext.Provider>
    );
}
