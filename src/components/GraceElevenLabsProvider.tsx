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
import { useConversation } from "@elevenlabs/react";
import { useAction, useMutation } from "convex/react";
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function GraceElevenLabsProvider({ children }: { children: ReactNode }) {
    const { addItems: addToCart } = useCart();
    const [panelMode, setPanelMode] = useState<PanelMode>("closed");
    const [status, setStatus] = useState<GraceStatus>("idle");
    const [messages, setMessages] = useState<GraceMessage[]>([]);
    const [input, setInput] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [conversationActive, setConversationActive] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

    // ── Ref mirrors — break stale-closure bugs without recreating callbacks ──
    const voiceEnabledRef = useRef(voiceEnabled);
    useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

    const conversationActiveRef = useRef(conversationActive);
    useEffect(() => { conversationActiveRef.current = conversationActive; }, [conversationActive]);

    // Prevents a second startSession while one is already in-flight
    const connectingRef = useRef(false);

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
        // NOTE: do NOT call setVolume here — onConnect fires at the WebSocket `open`
        // event, which is BEFORE the ElevenLabs handshake (overrides + conversation_
        // initiation_metadata exchange) is complete. Sending setVolume mid-handshake
        // causes the server to receive out-of-order messages and close the socket.
        // Volume is applied after startSession() resolves instead.
        connectingRef.current = false;
        setStatus("listening");
    }, []);

    const handleDisconnect = useCallback(() => {
        console.log("[Grace EL] Disconnected");
        connectingRef.current = false;
        setConversationActive(false);
        setStatus("idle");
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
        setErrorMessage(typeof error === "string" ? error : "Connection error");
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
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "grace",
                            content: "",
                            id: `a-${Date.now()}`,
                            action: { type: "showProducts", products: products.slice(0, 6) },
                        },
                    ]);
                    const summary = products.slice(0, 6)
                        .map((p) => [p.itemName, p.capacity, p.color].filter(Boolean).join(" "))
                        .join("; ");
                    return `Found ${products.length} matching products. Showing: ${summary}. Product cards are now displayed to the customer.`;
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

        navigateToPage: (parameters: {
            path: string;
            title: string;
            description?: string;
            autoNavigate?: boolean;
        }) => {
            const navPath = parameters.path ?? "/";
            const shouldAutoNav = parameters.autoNavigate === true;
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

    // ── Safe endSession helper ───────────────────────────────────────────────

    const safeEndSession = useCallback(() => {
        if (conversationRef.current?.status === "connected") {
            conversationRef.current.endSession();
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
        if (connectingRef.current || conversationRef.current?.status === "connected") {
            console.log("[Grace EL] startConversation skipped — already connecting/connected");
            return;
        }
        connectingRef.current = true;

        try {
            setConversationActive(true);
            setStatus("connecting");
            setErrorMessage("");

            // Preflight mic check — navigator.mediaDevices is undefined in non-secure
            // contexts (HTTP on a network IP). Guard against that rather than crashing.
            // ElevenLabs SDK will also request mic access internally when needed.
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
                if (!isLocalhost) {
                    throw new Error(
                        "Microphone access requires a secure connection (HTTPS). " +
                        "Please use https:// or access via localhost instead of a network IP."
                    );
                }
            } else {
                try {
                    await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (micErr) {
                    // Permission denied or no mic — log but continue; ElevenLabs will
                    // surface a cleaner error if mic is truly unavailable.
                    console.warn("[Grace EL] Mic preflight failed, proceeding anyway:", micErr);
                }
            }

            const t0 = performance.now();
            const res = await fetch("/api/elevenlabs/signed-url");
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(
                    (err as { error?: string }).error ??
                    "Failed to get ElevenLabs connection. Check ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in .env.local."
                );
            }
            const { conversationToken } = (await res.json()) as { conversationToken?: string };
            if (!conversationToken) throw new Error("ElevenLabs did not return a valid conversation token.");

            console.log(`[Grace EL] Starting WebRTC session (token fetch took ${Math.round(performance.now() - t0)}ms)`);

            // WebRTC is ElevenLabs' recommended connection type: lower latency,
            // more resilient, and no handshake payload size limits (which was
            // causing the WebSocket CLOSING/CLOSED errors).
            await conversationRef.current!.startSession({
                conversationToken,
                connectionType: "webrtc",
            });

            // Session fully established via WebRTC — now safe to set volume.
            conversationRef.current?.setVolume({ volume: voiceEnabledRef.current ? 1 : 0 });
            console.log("[Grace EL] WebRTC session established");
        } catch (err) {
            console.error("[Grace EL] Connection failed:", err);
            connectingRef.current = false;
            setConversationActive(false);
            const msg = err instanceof Error ? err.message : "Failed to start voice conversation";
            setErrorMessage(msg);
            setStatus("error");
            setTimeout(() => { setErrorMessage(""); setStatus("idle"); }, 8000);
        }
    }, []); // stable — no captured state; all accessed via refs

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
            if (conversationRef.current?.status === "connected") {
                conversationRef.current.setVolume({ volume: next ? 1 : 0 });
            }
            return next;
        });
    }, []);

    // ── Send text message (text-only falls back to Convex LLM) ──────────────

    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const send = useCallback(
        async (text?: string, fromVoice = false) => {
            const msg = (text ?? input).trim();
            if (!msg) return;
            setInput("");

            if (conversationActiveRef.current && conversationRef.current?.status === "connected") {
                setMessages((prev) => [
                    ...prev,
                    { role: "user", content: msg, id: `u-${Date.now()}` },
                ]);
                conversationRef.current.sendUserMessage(msg);
                setStatus("thinking");
                return;
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
                const response = await Promise.race([
                    (askGrace as (args: { messages: typeof history; voiceMode?: boolean }) => Promise<string>)({
                        messages: history,
                        voiceMode: fromVoice,
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
        [input, askGrace]
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

            if (conversationActiveRef.current && conversationRef.current?.status === "connected") {
                conversationRef.current.sendUserMessage(
                    "The customer confirmed. The items have been added to their cart."
                );
            }
        },
        [addToCart]
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
        if (conversationActiveRef.current && conversationRef.current?.status === "connected") {
            conversationRef.current.sendUserMessage("The customer declined. Do not add those items.");
        }
    }, []);

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
            if (conversationRef.current?.status === "connected") {
                conversationRef.current.endSession();
            }
        };
    }, []);

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
            }}
        >
            {children}
        </GraceContext.Provider>
    );
}
