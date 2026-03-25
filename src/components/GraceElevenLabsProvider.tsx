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

function formatPageContextForGrace(ctx: PageContext | null): string {
    if (!ctx) return "";
    const lines: string[] = ["=== CURRENT SESSION CONTEXT ==="];
    if (ctx.pageType === "pdp" && ctx.currentProduct) {
        lines.push(`Page: Product Detail — ${ctx.currentProduct.name}`);
        lines.push(`Family: ${ctx.currentProduct.family} | Size: ${ctx.currentProduct.capacity} | Colour: ${ctx.currentProduct.color}`);
        if (ctx.currentProduct.neckThreadSize) lines.push(`Thread: ${ctx.currentProduct.neckThreadSize}`);
        if (ctx.currentProduct.webPrice1pc) lines.push(`From: $${ctx.currentProduct.webPrice1pc.toFixed(2)}/pc`);
        lines.push(`GRACE INSTRUCTION: Customer is on this product's page. Open by acknowledging what they're looking at. Ask if they need compatible closures or have questions before surfacing alternatives.`);
    } else if (ctx.pageType === "catalog") {
        lines.push(`Page: Product Catalogue`);
        if (ctx.currentCollection) lines.push(`Active Filter: ${ctx.currentCollection}`);
        if (ctx.catalogSearch) lines.push(`Search: "${ctx.catalogSearch}"`);
        lines.push(`GRACE INSTRUCTION: Customer is browsing. Ask what they're building to help narrow their search.`);
    } else if (ctx.pageType === "home") {
        lines.push(`Page: Homepage`);
        lines.push(`GRACE INSTRUCTION: Use standard welcome pattern.`);
    } else {
        lines.push(`Page: ${ctx.pathname}`);
    }
    if (ctx.cartItems.length > 0) {
        lines.push(`Cart: ${ctx.cartItems.map((i) => `${i.name} ×${i.quantity}`).join(", ")}`);
        lines.push(`GRACE INSTRUCTION: Customer has items in cart — suggest compatible components if relevant.`);
    } else {
        lines.push(`Cart: Empty`);
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
        const families = [...new Set(products.map((p) => p.family).filter(Boolean))];
        if (families.length >= 1 && families[0]) {
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
        }));
        if (pageType === "pdp" && productGroupResult?.group) {
            const g = productGroupResult.group;
            return {
                pageType,
                pathname,
                cartItems: cartSummary,
                currentProduct: {
                    name: g.displayName,
                    family: g.family ?? "",
                    capacity: g.capacity ?? "",
                    color: g.color ?? "",
                    neckThreadSize: g.neckThreadSize ?? null,
                    graceSku: g.primaryGraceSku ?? "",
                    webPrice1pc: g.priceRangeMin ?? null,
                    webPrice12pc: null,
                },
            };
        }
        if (pageType === "catalog") {
            const familiesParam = searchParams.get("families") ?? searchParams.get("family");
            return {
                pageType,
                pathname,
                cartItems: cartSummary,
                currentCollection: familiesParam ?? searchParams.get("collection") ?? undefined,
                catalogSearch: searchParams.get("search") ?? undefined,
            };
        }
        return { pageType, pathname, cartItems: cartSummary };
    }, [pageType, pathname, productGroupResult, searchParams, cartItems]);

    const pageContextRef = useRef<PageContext | null>(null);
    useEffect(() => { pageContextRef.current = pageContext; }, [pageContext]);

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

    const handleConnect = useCallback(() => {
        console.log("[Grace EL] Connected — session live");
        connectingRef.current = false;
        lastConnectTimeRef.current = Date.now();
        setStatus("listening");
    }, []);

    const handleDisconnect = useCallback((details?: { reason?: string; message?: string; closeCode?: number; closeReason?: string }) => {
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

    const handleError = useCallback((error: unknown) => {
        console.error("[Grace EL] Error:", error);
        connectingRef.current = false;
        closingRef.current = false;
        const raw = typeof error === "string" ? error : String(error ?? "Connection error");
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
                            const pMl = p.capacityMl ?? parseFloat(p.capacity || "0");
                            return pMl > 0 && Math.abs(pMl - requestedMl) <= tolerance;
                        });
                        if (!hasExactSize) {
                            exactSizeFound = false;
                            // Deduplicate and sort available sizes for a clean message
                            const sizeSet = new Map<number, string>();
                            for (const p of products) {
                                const ml = p.capacityMl ?? parseFloat(p.capacity || "0");
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
        if (conv?.status === "connected") {
            closingRef.current = true;
            lastEndSessionRef.current = Date.now();
            try {
                conv.endSession();
            } catch (e) {
                // SDK throws when socket is already closing/closed — ignore
                if (!String(e).includes("CLOSING") && !String(e).includes("CLOSED")) {
                    console.warn("[Grace EL] endSession error:", e);
                }
            } finally {
                closingRef.current = false;
            }
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

            const contextBlock = formatPageContextForGrace(pageContextRef.current);

            const buildSessionOverrides = () => (
                contextBlock
                    ? {
                        overrides: {
                            agent: { prompt: { prompt: contextBlock } },
                        },
                    }
                    : {}
            );

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
                const contextBlock = formatPageContextForGrace(pageContextRef.current);
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
            }}
        >
            {children}
        </GraceContext.Provider>
    );
}
