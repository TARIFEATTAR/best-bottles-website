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
        console.log("[Grace EL] Connected — WS live");
        connectingRef.current = false;
        setStatus("listening");
    }, []);

    const handleDisconnect = useCallback(() => {
        console.log("[Grace EL] Disconnected — cleaning up state");
        connectingRef.current = false;
        closingRef.current = false;
        setConversationActive(false);
        setStatus((prev) => {
            if (prev === "connecting" || prev === "listening" || prev === "speaking") {
                return "idle";
            }
            return prev;
        });
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
                    let redirectUrl = "";

                    if (products.length === 1 && products[0].slug) {
                        // Single exact match — go straight to the product detail page
                        redirectUrl = `/products/${products[0].slug}`;
                    } else {
                        // Multiple results — go to catalog filtered by family or search
                        const qs = new URLSearchParams();
                        // Prefer explicit family param over search term (more reliable)
                        const families = [...new Set(
                            products
                                .map((p) => (p as unknown as Record<string, string>).family)
                                .filter(Boolean)
                        )];
                        if (parameters.family) {
                            // Grace explicitly named a family — use it directly
                            qs.set("family", parameters.family);
                        } else if (families.length === 1 && families[0]) {
                            qs.set("family", families[0]);
                        }
                        if (parameters.query && !qs.has("family")) {
                            qs.set("search", parameters.query);
                        }
                        redirectUrl = `/catalog${qs.toString() ? `?${qs.toString()}` : ""}`;
                    }

                    // Auto-navigate: take the user straight there, minimize Grace to voice strip
                    setGraceQuery(parameters.query || parameters.family || "");
                    setPendingNavigation(redirectUrl);
                    setPanelMode("strip");

                    const summary = products.slice(0, 3)
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
                        const searchTerm = rawSlug.replace(/-/g, " ").replace(/\b(bottle|ml|rollon|finemist|lotionpump|spray|clear|amber|frosted)\b/gi, "").trim();
                        const searchRes = await fetch("/api/elevenlabs/server-tools", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                tool_name: "searchCatalog",
                                parameters: { searchTerm: searchTerm || rawSlug.replace(/-/g, " ") },
                            }),
                        });
                        const searchData = await searchRes.json() as { result?: ProductCard[] };
                        const hits: ProductCard[] = Array.isArray(searchData.result) ? searchData.result : [];

                        if (hits.length === 1 && hits[0].slug) {
                            navPath = `/products/${hits[0].slug}`;
                        } else if (hits.length > 1) {
                            const families = [...new Set(hits.map((p) => (p as unknown as Record<string, string>).family).filter(Boolean))];
                            const qs = new URLSearchParams();
                            if (families.length === 1 && families[0]) qs.set("family", families[0]);
                            else qs.set("search", searchTerm || rawSlug.replace(/-/g, " "));
                            navPath = `/catalog${qs.toString() ? `?${qs.toString()}` : ""}`;
                        } else {
                            // No matches — fall back to catalog search
                            navPath = `/catalog?search=${encodeURIComponent(rawSlug.replace(/-/g, " "))}`;
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

            const connectOnce = async () => {
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

                const contextBlock = formatPageContextForGrace(pageContextRef.current);
                await Promise.race([
                    conversationRef.current!.startSession({
                        signedUrl,
                        connectionType: "websocket",
                        ...(contextBlock ? {
                            overrides: {
                                agent: { prompt: { prompt: contextBlock } },
                            },
                        } : {}),
                    }),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("Voice connection timed out after 15 seconds.")), 15000)
                    ),
                ]);
            };

            // One automatic retry with a fresh signed URL handles stale/half-closed sockets.
            let lastError: unknown;
            for (let attempt = 1; attempt <= 2; attempt += 1) {
                try {
                    await connectOnce();
                    connectingRef.current = false;
                    safeSetVolume(voiceEnabledRef.current ? 1 : 0);
                    console.log(`[Grace EL] WebSocket session established (attempt ${attempt})`);
                    return;
                } catch (e) {
                    lastError = e;
                    console.warn(`[Grace EL] startSession attempt ${attempt} failed:`, e);
                    safeEndSession();
                    if (attempt < 2) {
                        await new Promise((r) => setTimeout(r, 500));
                    }
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
        [input, askGrace, safeSendUserMessage, safeEndSession]
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
