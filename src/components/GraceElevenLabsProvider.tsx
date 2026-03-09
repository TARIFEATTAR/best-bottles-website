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

type GraceStructuredResponse = {
    assistantText: string;
    actions: Array<
        | { type: "showProducts"; products: ProductCard[] }
        | { type: "compareProducts"; products: ProductCard[] }
        | { type: "proposeCartAdd"; products: Array<ProductCard & { quantity: number }>; awaitingConfirmation: boolean }
        | { type: "navigateToPage"; path: string; title: string; description?: string; autoNavigate?: boolean; prefillFields?: Record<string, string> }
        | { type: "prefillForm"; formType: "sample" | "quote" | "contact" | "newsletter"; fields: Record<string, string> }
        | { type: "updateFormField"; formType: "sample" | "quote" | "contact" | "newsletter"; fieldName: string; value: string }
        | { type: "submitForm" }
    >;
    retrievalTrace: Array<{ query: string }>;
    toolCallsUsed: string[];
    classification: {
        intent?: string | null;
        productFamily?: string | null;
        capacityMl?: number | null;
        color?: string | null;
        applicator?: string | null;
        resolvedGroupSlug?: string | null;
        resolutionConfidence?: number | null;
        provider: string;
        voiceOrText: string;
    };
    latencyMs: number;
};

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
        qs.set("family", family);
    } else {
        const families = [...new Set(products.map((p) => p.family).filter(Boolean))];
        if (families.length === 1 && families[0]) {
            qs.set("family", families[0]);
        } else if (sanitizedQuery) {
            qs.set("search", sanitizedQuery);
        }
    }

    return `/catalog${qs.toString() ? `?${qs.toString()}` : ""}`;
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
    if (tokens.length < 3) {
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
    if (secondBest && secondBest.coverage >= best.coverage - 0.1 && secondBest.matches >= best.matches - 1) {
        return null;
    }

    return best.product;
}

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
            return {
                pageType,
                pathname,
                cartItems: cartSummary,
                currentCollection: searchParams.get("family") ?? searchParams.get("collection") ?? undefined,
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

    const respondGrace = useAction(api.grace.respond);
    const saveGraceTurn = useMutation(api.grace.saveConversationTurn);
    const submitFormMutation = useMutation(api.forms.submit);

    // Keep submitFormMutation in a ref so clientTools (empty deps) can call latest version
    const submitFormMutationRef = useRef(submitFormMutation);
    useEffect(() => { submitFormMutationRef.current = submitFormMutation; }, [submitFormMutation]);

    // ── Active conversational form ────────────────────────────────────────────
    const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);

    // Mirror so clientTools (empty deps) can always access latest form state
    const activeFormRef = useRef<ActiveForm | null>(null);
    useEffect(() => { activeFormRef.current = activeForm; }, [activeForm]);

    const sessionIdRef = useRef(`storefront:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shouldTranscribeRef = useRef(true);
    const audioUrlRef = useRef<string | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const startDictationRef = useRef<() => Promise<void>>(async () => undefined);
    const sendRef = useRef<(text?: string, fromVoice?: boolean) => Promise<void>>(async () => undefined);

    const cleanupAudioPlayback = useCallback(() => {
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.src = "";
            audioElementRef.current = null;
        }
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
        }
    }, []);

    const cleanupRecording = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (audioContextRef.current) {
            void audioContextRef.current.close().catch(() => undefined);
            audioContextRef.current = null;
        }
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
    }, []);

    const persistGraceTurn = useCallback(async (
        userMessage: string,
        response: GraceStructuredResponse
    ) => {
        try {
            await saveGraceTurn({
                sessionId: sessionIdRef.current,
                channel: "storefront",
                entrypoint: "grace-panel",
                pageType: pageContextRef.current?.pageType ?? "other",
                userMessage,
                assistantMessage: response.assistantText,
                toolCallsUsed: response.toolCallsUsed,
                intent: response.classification.intent ?? undefined,
                productFamily: response.classification.productFamily ?? undefined,
                capacityMl: response.classification.capacityMl ?? undefined,
                color: response.classification.color ?? undefined,
                applicator: response.classification.applicator ?? undefined,
                resolvedGroupSlug: response.classification.resolvedGroupSlug ?? undefined,
                resolutionConfidence: response.classification.resolutionConfidence ?? undefined,
                latencyMs: response.latencyMs,
                provider: response.classification.provider,
                voiceOrText: response.classification.voiceOrText,
            });
        } catch (error) {
            console.warn("[Grace] Failed to persist turn:", error);
        }
    }, [saveGraceTurn]);

    // ── Stable event handlers ────────────────────────────────────────────────
    // All of these are useCallback with [] deps so they're the SAME object
    // reference on every render. This prevents useConversation from seeing
    // "changed" options and tearing down a live WebSocket.

    // Queued page context to send after connection opens (avoids SDK overrides bug)
    const pendingContextRef = useRef<string | null>(null);

    const handleConnect = useCallback(() => {
        console.log("[Grace EL] Connected — WS live");
        connectingRef.current = false;
        lastConnectTimeRef.current = Date.now();
        setStatus("listening");

        // Inject page context as a silent first message now that the socket is live.
        // We avoid startSession overrides because @elevenlabs/react <=0.14.1 drops
        // the WebSocket immediately when overrides are present.
        const ctx = pendingContextRef.current;
        if (ctx) {
            pendingContextRef.current = null;
            setTimeout(() => {
                const conv = conversationRef.current;
                if (conv?.status === "connected") {
                    try {
                        conv.sendUserMessage(ctx);
                        console.log("[Grace EL] Page context injected via sendUserMessage");
                    } catch (e) {
                        console.warn("[Grace EL] Failed to inject page context:", e);
                    }
                }
            }, 300);
        }
    }, []);

    const handleDisconnect = useCallback(() => {
        const sinceConnect = Date.now() - lastConnectTimeRef.current;
        const wasImmediateDrop = lastConnectTimeRef.current > 0 && sinceConnect < 3000;
        console.log(`[Grace EL] Disconnected — cleaning up state (${sinceConnect}ms after connect, immediate=${wasImmediateDrop})`);
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
            // Suppress the silent page-context injection from appearing in chat
            if (message.message.startsWith("=== CURRENT SESSION CONTEXT ===")) return;
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
        else if (mode.mode === "listening") setStatus("listening");
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
                    const directProduct = selectDirectProductMatch(products, parameters.query);
                    const displayProducts = directProduct ? [directProduct] : products;
                    const redirectUrl = buildBrowsePath(displayProducts, parameters.query, parameters.family);

                    // Auto-navigate: take the user straight there, minimize Grace to voice strip
                    setGraceQuery(parameters.query || parameters.family || "");
                    setPendingNavigation(redirectUrl);
                    setPanelMode("strip");

                    const summary = displayProducts.slice(0, 3)
                        .map((p) => [p.itemName, p.capacity, p.color].filter(Boolean).join(" "))
                        .join(", ");
                    return `Taking you there now. Found ${products.length} options — top matches: ${summary}.`;
                }
                return "No products found matching that description. Try a broader search term.";
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

            // Validate product paths — Grace sometimes fabricates slugs from product names.
            // If the slug doesn't exist in the database, search the catalog and redirect
            // to the real slug (or catalog filtered results) instead.
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
                        // Slug doesn't exist — search catalog to find the real slug
                        console.warn(`[Grace nav] Slug "${rawSlug}" not found — searching catalog instead`);
                        const searchTerm = slugToSearchTerm(rawSlug);
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
                            navPath = buildBrowsePath(hits, searchTerm);
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
                setPendingNavigation(navPath);
                setPanelMode(conversationActiveRef.current ? "strip" : "closed");
            }
            return shouldAutoNav
                ? "Navigating the customer to the page now."
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
        shouldTranscribeRef.current = false;
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        } else {
            cleanupRecording();
        }
        cleanupAudioPlayback();
        setStatus("idle");
    }, [cleanupRecording, cleanupAudioPlayback, safeEndSession]);

    const minimizeToStrip = useCallback(() => setPanelMode("strip"), []);
    const open = openPanel;

    const close = useCallback(() => {
        setPanelMode("closed");
        setConversationActive(false);
        safeEndSession();
        shouldTranscribeRef.current = false;
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        } else {
            cleanupRecording();
        }
        cleanupAudioPlayback();
        setStatus("idle");
        setMessages([]);
    }, [cleanupRecording, cleanupAudioPlayback, safeEndSession]);

    const onNavigate = useCallback(() => {
        setPanelMode(conversationActiveRef.current ? "strip" : "closed");
    }, []);

    const clearPendingNavigation = useCallback(() => setPendingNavigation(null), []);

    // ── Unified voice + text backend flow ────────────────────────────────────

    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const applyBackendActions = useCallback(async (actions: GraceStructuredResponse["actions"]) => {
        const renderable: GraceMessage[] = [];

        for (const action of actions) {
            if (action.type === "updateFormField") {
                setActiveForm((prev) => {
                    if (!prev) {
                        return {
                            formType: action.formType,
                            fields: { [action.fieldName]: action.value },
                            filledOrder: [action.fieldName],
                            submitting: false,
                            submitted: false,
                            error: "",
                        };
                    }
                    const alreadyFilled = prev.filledOrder.includes(action.fieldName);
                    return {
                        ...prev,
                        formType: action.formType,
                        fields: { ...prev.fields, [action.fieldName]: action.value },
                        filledOrder: alreadyFilled
                            ? prev.filledOrder
                            : [...prev.filledOrder, action.fieldName],
                    };
                });
                setPanelMode("open");
                continue;
            }

            if (action.type === "submitForm") {
                const form = activeFormRef.current;
                if (form && !form.submitted && !form.submitting) {
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
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : "Submission failed";
                        setActiveForm((prev) =>
                            prev ? { ...prev, submitting: false, error: errorMessage } : null
                        );
                    }
                }
                continue;
            }

            if (action.type === "navigateToPage" && action.autoNavigate !== false) {
                setPendingNavigation(action.path);
                setPanelMode(conversationActiveRef.current ? "strip" : "closed");
            }

            if (action.type === "prefillForm") {
                window.dispatchEvent(
                    new CustomEvent("grace:prefillForm", {
                        detail: { formType: action.formType, fields: action.fields },
                    })
                );
            }

            renderable.push({
                role: "grace",
                content: "",
                id: `a-${Date.now()}-${renderable.length}`,
                action,
            });
        }

        return renderable;
    }, []);

    const playAssistantAudio = useCallback(async (text: string) => {
        cleanupAudioPlayback();

        if (!conversationActiveRef.current) {
            setStatus("idle");
            return;
        }

        if (!voiceEnabledRef.current || !text.trim()) {
            setStatus("listening");
            setTimeout(() => {
                void startDictationRef.current();
            }, 150);
            return;
        }

        try {
            setStatus("speaking");
            const response = await fetch("/api/voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                throw new Error("Voice synthesis failed");
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            audioUrlRef.current = url;

            const audio = new Audio(url);
            audio.volume = voiceEnabledRef.current ? 1 : 0;
            audioElementRef.current = audio;

            audio.onended = () => {
                cleanupAudioPlayback();
                if (conversationActiveRef.current) {
                    setStatus("listening");
                    void startDictationRef.current();
                } else {
                    setStatus("idle");
                }
            };
            audio.onerror = () => {
                cleanupAudioPlayback();
                if (conversationActiveRef.current) {
                    setStatus("listening");
                    void startDictationRef.current();
                } else {
                    setStatus("idle");
                }
            };

            await audio.play();
        } catch (error) {
            console.error("[Grace voice] Playback failed:", error);
            cleanupAudioPlayback();
            if (conversationActiveRef.current) {
                setStatus("listening");
                setTimeout(() => {
                    void startDictationRef.current();
                }, 150);
            } else {
                setStatus("idle");
            }
        }
    }, [cleanupAudioPlayback]);

    const send = useCallback(
        async (text?: string, fromVoice = false) => {
            const msg = (text ?? input).trim();
            if (!msg) return;

            setInput("");
            setMessages((prev) => [...prev, { role: "user", content: msg, id: `u-${Date.now()}` }]);
            setStatus("thinking");
            setErrorMessage("");

            try {
                const history: Array<{ role: "user" | "assistant"; content: string }> = [
                    ...messagesRef.current
                        .filter((message) => message.content.trim().length > 0)
                        .map((message) => ({
                            role: (message.role === "grace" ? "assistant" : "user") as "user" | "assistant",
                            content: message.content,
                        })),
                    { role: "user" as const, content: msg },
                ];

                const contextBlock = formatPageContextForGrace(pageContextRef.current);
                const response = await Promise.race([
                    respondGrace({
                        messages: history,
                        voiceMode: fromVoice || conversationActiveRef.current,
                        ...(contextBlock ? { pageContextBlock: contextBlock } : {}),
                        channel: "storefront",
                        sessionMetadata: {
                            sessionId: sessionIdRef.current,
                            entrypoint: "grace-panel",
                            pageType: pageContextRef.current?.pageType ?? "other",
                        },
                    }) as Promise<GraceStructuredResponse>,
                    new Promise<GraceStructuredResponse>((_, reject) =>
                        setTimeout(() => reject(new Error("Grace took too long to respond. Please try again.")), 45000)
                    ),
                ]);

                const actionMessages = await applyBackendActions(response.actions);
                const assistantText = stripMarkdown(response.assistantText);

                setGraceQuery(response.retrievalTrace[0]?.query ?? "");
                setMessages((prev) => {
                    const next = [...prev];
                    if (assistantText || actionMessages.length === 0) {
                        const [firstAction, ...restActions] = actionMessages;
                        next.push({
                            role: "grace",
                            content: assistantText,
                            id: `g-${Date.now()}`,
                            action: firstAction?.action,
                        });
                        for (const actionMessage of restActions) {
                            next.push(actionMessage);
                        }
                    } else {
                        for (const actionMessage of actionMessages) {
                            next.push(actionMessage);
                        }
                    }
                    return next;
                });

                void persistGraceTurn(msg, response);

                if (conversationActiveRef.current) {
                    await playAssistantAudio(assistantText);
                } else {
                    setStatus("idle");
                }
            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : "I had trouble connecting just now. Please try again in a moment.";
                console.error("[Grace] respond failed:", error);
                setErrorMessage(message);
                setMessages((prev) => [
                    ...prev,
                    { role: "grace", content: message, id: `g-${Date.now()}` },
                ]);
                setStatus("error");
                setTimeout(() => {
                    setStatus(conversationActiveRef.current ? "listening" : "idle");
                    setErrorMessage("");
                }, 4000);
            }
        },
        [input, respondGrace, applyBackendActions, persistGraceTurn, playAssistantAudio]
    );

    useEffect(() => {
        sendRef.current = send;
    }, [send]);

    const startDictation = useCallback(async () => {
        if (forceTextOnly) return;
        if (mediaRecorderRef.current?.state === "recording") return;

        try {
            setStatus("listening");
            setErrorMessage("");

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/mp4")
                    ? "audio/mp4"
                    : "";
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

            shouldTranscribeRef.current = true;
            audioChunksRef.current = [];
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            recorder.onstop = async () => {
                const shouldTranscribe = shouldTranscribeRef.current;
                cleanupRecording();

                if (!shouldTranscribe) {
                    setStatus(conversationActiveRef.current ? "idle" : "idle");
                    return;
                }

                const blob = new Blob(audioChunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });

                if (blob.size < 500) {
                    if (conversationActiveRef.current) {
                        setStatus("listening");
                        setTimeout(() => {
                            void startDictationRef.current();
                        }, 150);
                    } else {
                        setStatus("idle");
                    }
                    return;
                }

                setStatus("transcribing");
                try {
                    const formData = new FormData();
                    formData.append("audio", blob, "grace-recording.webm");
                    const response = await fetch("/api/voice/transcribe", {
                        method: "POST",
                        body: formData,
                    });
                    if (!response.ok) {
                        const payload = await response.json().catch(() => ({ error: "Voice transcription failed." }));
                        throw new Error((payload as { error?: string }).error ?? "Voice transcription failed.");
                    }
                    const { text: transcript } = (await response.json()) as { text?: string };
                    if (transcript?.trim()) {
                        await sendRef.current(transcript.trim(), true);
                    } else if (conversationActiveRef.current) {
                        setStatus("listening");
                        setTimeout(() => {
                            void startDictationRef.current();
                        }, 150);
                    } else {
                        setStatus("idle");
                    }
                } catch (error) {
                    console.error("[Grace voice] Transcription failed:", error);
                    setVoiceFailed(true);
                    setStatus("error");
                    setErrorMessage(
                        error instanceof Error ? error.message : "Voice transcription failed."
                    );
                    setTimeout(() => {
                        setStatus(conversationActiveRef.current ? "listening" : "idle");
                        setErrorMessage("");
                    }, 4000);
                }
            };

            recorder.start();

            try {
                const audioContext = new AudioContext();
                audioContextRef.current = audioContext;
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                audioContext.createMediaStreamSource(stream).connect(analyser);
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                const SILENCE_THRESHOLD = 8;
                const SILENCE_DELAY_MS = 1500;

                const checkSilence = () => {
                    if (mediaRecorderRef.current?.state !== "recording") return;
                    analyser.getByteFrequencyData(dataArray);
                    const rms = Math.sqrt(
                        dataArray.reduce((sum, value) => sum + value * value, 0) / dataArray.length
                    );
                    if (rms < SILENCE_THRESHOLD) {
                        if (!silenceTimerRef.current) {
                            silenceTimerRef.current = setTimeout(() => {
                                silenceTimerRef.current = null;
                                if (mediaRecorderRef.current?.state === "recording") {
                                    mediaRecorderRef.current.stop();
                                }
                            }, SILENCE_DELAY_MS);
                        }
                    } else if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }

                    requestAnimationFrame(checkSilence);
                };

                requestAnimationFrame(checkSilence);
            } catch {
                // AudioContext unavailable; recording still works without auto-stop.
            }
        } catch (error) {
            console.error("[Grace voice] Failed to start recording:", error);
            const message =
                error instanceof Error && error.name === "NotAllowedError"
                    ? "Microphone permission is blocked. Please allow mic access and try again."
                    : "I couldn't access your microphone right now.";
            setVoiceFailed(true);
            setErrorMessage(message);
            setConversationActive(false);
            setStatus("error");
            setPanelMode("open");
        }
    }, [forceTextOnly, cleanupRecording]);

    useEffect(() => {
        startDictationRef.current = startDictation;
    }, [startDictation]);

    const stopDictation = useCallback(() => {
        shouldTranscribeRef.current = false;
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        } else {
            cleanupRecording();
        }
    }, [cleanupRecording]);

    const startConversation = useCallback(async () => {
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

        setConversationActive(true);
        setVoiceFailed(false);
        setPanelMode("open");
        cleanupAudioPlayback();
        shouldTranscribeRef.current = true;
        await startDictation();
    }, [forceTextOnly, startDictation, cleanupAudioPlayback]);

    const endConversation = useCallback(() => {
        setConversationActive(false);
        shouldTranscribeRef.current = false;
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        } else {
            cleanupRecording();
        }
        cleanupAudioPlayback();
        setStatus("idle");
    }, [cleanupRecording, cleanupAudioPlayback]);

    // ── Toggle / interrupt ───────────────────────────────────────────────────

    const stopSpeaking = useCallback(() => {
        cleanupAudioPlayback();
        setStatus(conversationActiveRef.current ? "listening" : "idle");
    }, [cleanupAudioPlayback]);

    const toggleVoice = useCallback(() => {
        setVoiceEnabled((value) => {
            const next = !value;
            safeSetVolume(next ? 1 : 0);
            if (audioElementRef.current) {
                audioElementRef.current.volume = next ? 1 : 0;
            }
            return next;
        });
    }, [safeSetVolume]);

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
            shouldTranscribeRef.current = false;
            cleanupRecording();
            cleanupAudioPlayback();
        };
    }, [cleanupRecording, cleanupAudioPlayback]);

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
