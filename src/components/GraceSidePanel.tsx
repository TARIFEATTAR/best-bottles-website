"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Send,
    Mic,
    Volume2,
    VolumeX,
    StopCircle,
    ShoppingCart,
    ArrowRight,
    Check,
    XCircle,
    Package,
    GitCompare,
    FileText,
    ExternalLink,
    ChevronDown,
    Maximize2,
    PanelRightClose,
} from "lucide-react";
import { useGrace, type GraceStatus, type GraceAction, type ProductCard, type KitItem } from "./GraceProvider";
import { useCart } from "./CartProvider";

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useIsMobile() {
    const [mobile, setMobile] = useState(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia("(max-width: 768px)").matches;
    });
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return mobile;
}

// ─── Status Labels ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<GraceStatus, string> = {
    idle: "",
    connecting: "Connecting to Grace…",
    listening: "Listening — speak now…",
    transcribing: "Transcribing…",
    thinking: "Grace is thinking…",
    speaking: "Grace is speaking…",
    error: "Something went wrong",
};

// ─── Action Card Renderers (unchanged from modal) ────────────────────────────

function ProductCardView({ product }: { product: ProductCard }) {
    const router = useRouter();
    return (
        <div className="bg-white border border-champagne/60 rounded-xl overflow-hidden hover:border-muted-gold/60 transition-colors p-2.5">
            <p className="font-semibold text-obsidian leading-tight text-[11px]">{product.itemName}</p>
            {product.family && (
                <p className="text-[10px] text-muted-gold font-medium mt-0.5">{product.family}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-slate">
                {product.capacity && <span>{product.capacity}</span>}
                {product.color && <span>{product.color}</span>}
                {product.neckThreadSize && <span>Thread: {product.neckThreadSize}</span>}
            </div>
            {product.webPrice1pc != null && (
                <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-sm font-bold text-obsidian">${product.webPrice1pc.toFixed(2)}</span>
                    {product.webPrice12pc != null && (
                        <span className="text-[10px] text-slate">12+: ${product.webPrice12pc.toFixed(2)}</span>
                    )}
                </div>
            )}
            {product.slug && (
                <button
                    onClick={() => router.push(`/products/${product.slug}`)}
                    className="mt-2 flex items-center gap-1 text-[10px] text-muted-gold font-semibold hover:text-obsidian transition-colors"
                >
                    View details <ArrowRight className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

function ActionCardRenderer({
    action,
    messageId,
    confirmAction,
    dismissAction,
    onNavigate,
}: {
    action: GraceAction;
    messageId: string;
    confirmAction: (id: string) => void;
    dismissAction: (id: string) => void;
    onNavigate: (path: string) => void;
}) {
    const router = useRouter();

    switch (action.type) {
        case "showProducts":
            return (
                <div className="mt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Package className="w-3.5 h-3.5 text-muted-gold" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">Products</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {action.products.map((p, i) => (
                            <ProductCardView key={p.graceSku || i} product={p} />
                        ))}
                    </div>
                </div>
            );

        case "compareProducts":
            return (
                <div className="mt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                        <GitCompare className="w-3.5 h-3.5 text-muted-gold" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">Comparison</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b border-champagne/60">
                                    <th className="text-left py-1.5 pr-2 text-slate font-medium">Spec</th>
                                    {action.products.map((p, i) => (
                                        <th key={i} className="text-left py-1.5 px-2 font-semibold text-obsidian min-w-[90px]">
                                            {p.itemName}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-slate">
                                {["family", "capacity", "color", "neckThreadSize", "webPrice1pc"].map((field) => (
                                    <tr key={field} className="border-b border-champagne/30">
                                        <td className="py-1.5 pr-2 font-medium capitalize">
                                            {field === "webPrice1pc" ? "Price" : field === "neckThreadSize" ? "Thread" : field}
                                        </td>
                                        {action.products.map((p, i) => (
                                            <td key={i} className="py-1.5 px-2">
                                                {field === "webPrice1pc" && p.webPrice1pc != null
                                                    ? `$${p.webPrice1pc.toFixed(2)}`
                                                    : (p as unknown as Record<string, unknown>)[field] as string ?? "—"}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );

        case "proposeCartAdd":
            return (
                <div className="mt-2 bg-obsidian/[0.03] border border-muted-gold/30 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <ShoppingCart className="w-3.5 h-3.5 text-muted-gold" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">
                            {action.awaitingConfirmation ? "Add to Cart?" : "Added to Cart"}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {action.products.map((p, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-obsidian">{p.itemName}</p>
                                    <p className="text-[10px] text-slate">Qty: {p.quantity}</p>
                                </div>
                                {p.webPrice1pc != null && (
                                    <p className="text-sm font-bold text-obsidian">${(p.webPrice1pc * p.quantity).toFixed(2)}</p>
                                )}
                            </div>
                        ))}
                    </div>
                    {action.awaitingConfirmation ? (
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => confirmAction(messageId)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-obsidian text-bone text-xs font-bold hover:bg-muted-gold transition-colors"
                            >
                                <Check className="w-3.5 h-3.5" /> Confirm
                            </button>
                            <button
                                onClick={() => dismissAction(messageId)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-champagne/80 text-slate text-xs font-medium hover:bg-champagne/20 transition-colors"
                            >
                                <XCircle className="w-3.5 h-3.5" /> Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-gold font-semibold">
                            <Check className="w-3 h-3" /> Added successfully
                        </div>
                    )}
                </div>
            );

        case "navigateToPage": {
            const wasAutoNavigated = action.autoNavigate === true;
            return (
                <div className="mt-2 bg-obsidian/[0.03] border border-champagne/60 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted-gold/10 flex items-center justify-center shrink-0">
                            <ExternalLink className="w-4 h-4 text-muted-gold" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-obsidian">{action.title}</p>
                            {action.description && (
                                <p className="text-[10px] text-slate mt-0.5 truncate">{action.description}</p>
                            )}
                        </div>
                    </div>
                    {wasAutoNavigated ? (
                        <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-muted-gold font-semibold">
                            <Check className="w-3 h-3" /> Navigated
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                onNavigate(action.path);
                                router.push(action.path);
                            }}
                            className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-obsidian text-bone text-xs font-bold hover:bg-muted-gold transition-colors"
                        >
                            Take me there <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            );
        }

        case "prefillForm":
            return (
                <div className="mt-2 bg-obsidian/[0.03] border border-champagne/60 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                        <FileText className="w-3.5 h-3.5 text-muted-gold" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">
                            {action.formType === "sample" ? "Sample Request" :
                             action.formType === "quote" ? "Quote Request" :
                             action.formType === "newsletter" ? "Newsletter Signup" : "Contact Form"}
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        {Object.entries(action.fields).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                                <span className="text-[10px] text-slate capitalize w-20 shrink-0">{key.replace(/_/g, " ")}:</span>
                                <span className="text-[11px] text-obsidian font-medium">{value}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => {
                            const params = new URLSearchParams(action.fields);
                            const path = action.formType === "sample" ? "/request-sample"
                                : action.formType === "quote" ? "/request-quote"
                                : action.formType === "newsletter" ? "/newsletter"
                                : "/contact";
                            onNavigate(path);
                            router.push(`${path}?${params.toString()}`);
                        }}
                        className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-obsidian text-bone text-xs font-bold hover:bg-muted-gold transition-colors"
                    >
                        Review & Submit <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            );

        case "buildKit":
            return (
                <div className="mt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Package className="w-3.5 h-3.5 text-muted-gold" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">Kit Builder</span>
                    </div>
                    <div className="space-y-2">
                        {action.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate bg-champagne/40 rounded px-1.5 py-0.5 w-16 text-center shrink-0">
                                    {item.role}
                                </span>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-obsidian">{item.product.itemName}</p>
                                    {item.product.webPrice1pc != null && (
                                        <p className="text-[10px] text-slate">${item.product.webPrice1pc.toFixed(2)}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {action.totalPrice != null && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-champagne/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate">Total</span>
                            <span className="text-sm font-bold text-obsidian">${action.totalPrice.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            );

        default:
            return null;
    }
}

// ─── Floating Trigger Bubble ─────────────────────────────────────────────────

export function GraceFloatingTrigger() {
    const { panelMode, openPanel } = useGrace();
    const isMobile = useIsMobile();
    const pathname = usePathname();
    const isProductPage = pathname?.startsWith("/products/");
    if (panelMode !== "closed") return null;

    return (
        <button
            onClick={openPanel}
            className={`fixed z-40 bg-obsidian text-bone rounded-full shadow-xl hover:bg-muted-gold transition-all duration-200 cursor-pointer group ${
                isMobile
                    ? `${isProductPage ? "bottom-[104px]" : "bottom-4"} right-4 w-12 h-12 flex items-center justify-center`
                    : "bottom-6 right-6 flex items-center space-x-2.5 px-5 py-3"
            }`}
            aria-label="Talk to Grace"
        >
            <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true">
                <span /><span /><span /><span />
            </span>
            {!isMobile && <span className="text-sm font-medium tracking-wide">Talk to Grace</span>}
        </button>
    );
}

// ─── Voice Strip (60px desktop / 48px mobile bottom bar) ─────────────────────

function VoiceStrip({ isMobile }: { isMobile: boolean }) {
    const { openPanel, closePanel, endConversation, status, conversationActive, stopSpeaking, startDictation } = useGrace();

    const isSpeaking = status === "speaking";
    const isListening = status === "listening";

    if (isMobile) {
        return (
            <motion.div
                initial={{ y: 48 }}
                animate={{ y: 0 }}
                exit={{ y: 48 }}
                transition={{ type: "spring", damping: 28, stiffness: 340 }}
                className="fixed bottom-0 left-0 right-0 z-[55] h-12 bg-obsidian flex items-center justify-between px-4 shadow-2xl"
            >
                <button onClick={openPanel} className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-muted-gold/20 flex items-center justify-center shrink-0">
                        <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true" style={{ transform: "scale(0.7)" }}>
                            <span /><span /><span /><span />
                        </span>
                    </div>
                    <span className="text-xs text-bone/80 font-medium truncate">
                        {isListening ? "Listening…" : isSpeaking ? "Grace is speaking…" : "Voice active"}
                    </span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                    {isSpeaking && (
                        <button
                            onClick={() => { stopSpeaking(); startDictation(); }}
                            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                            aria-label="Interrupt"
                        >
                            <Mic className="w-3.5 h-3.5 text-bone" />
                        </button>
                    )}
                    <button
                        onClick={() => { endConversation(); closePanel(); }}
                        className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors"
                        aria-label="End conversation"
                    >
                        <StopCircle className="w-3.5 h-3.5 text-white" />
                    </button>
                </div>
            </motion.div>
        );
    }

    // Desktop: vertical strip on right edge
    return (
        <motion.div
            initial={{ x: 60 }}
            animate={{ x: 0 }}
            exit={{ x: 60 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className="fixed top-0 right-0 bottom-0 z-[55] w-[60px] bg-obsidian flex flex-col items-center py-6 shadow-2xl cursor-pointer"
            onClick={openPanel}
            role="button"
            aria-label="Expand Grace panel"
        >
            <div className="w-9 h-9 rounded-full bg-muted-gold/20 flex items-center justify-center mb-4">
                <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true" style={{ transform: "scale(0.8)" }}>
                    <span /><span /><span /><span />
                </span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-1">
                {isListening && (
                    <span className="w-3 h-3 rounded-full bg-muted-gold animate-grace-pulse" />
                )}
                {isSpeaking && (
                    <span className="grace-voice-bars" aria-hidden="true" style={{ transform: "rotate(90deg) scale(1.2)" }}>
                        <span /><span /><span /><span />
                    </span>
                )}
                {!isListening && !isSpeaking && (
                    <Mic className="w-4 h-4 text-bone/60" />
                )}
            </div>

            <div className="flex flex-col items-center gap-3 mt-auto">
                <button
                    onClick={(e) => { e.stopPropagation(); openPanel(); }}
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                    aria-label="Expand panel"
                >
                    <Maximize2 className="w-4 h-4 text-bone/70" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); endConversation(); closePanel(); }}
                    className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors"
                    aria-label="Close Grace"
                >
                    <X className="w-4 h-4 text-white" />
                </button>
            </div>
        </motion.div>
    );
}

// ─── Chat Panel (420px — same width as cart) ────────────────────────────────

function ChatPanel({ isMobile }: { isMobile: boolean }) {
    const {
        closePanel,
        minimizeToStrip,
        status,
        messages,
        input,
        setInput,
        voiceEnabled,
        toggleVoice,
        send,
        startDictation,
        stopSpeaking,
        errorMessage,
        conversationActive,
        startConversation,
        endConversation,
        confirmAction,
        dismissAction,
        onNavigate,
    } = useGrace();

    const { items: cartItems, itemCount: cartCount, removeItem, checkout, isCheckingOut, checkoutError } = useCart();
    const [showCart, setShowCart] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();
    const [dragY, setDragY] = useState(0);

    const isProductPage = pathname?.startsWith("/products/");
    const chips = isProductPage
        ? ["Pair a cap", "View compatibility", "See bulk pricing", "Add to order"]
        : ["Find a bottle", "Check compatibility", "Volume pricing", "Track my order"];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, status]);

    useEffect(() => {
        const id = setTimeout(() => inputRef.current?.focus(), 200);
        return () => clearTimeout(id);
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closePanel();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [closePanel]);

    const isProcessing = status === "thinking" || status === "transcribing" || status === "connecting";
    const isListening = status === "listening";
    const isSpeaking = status === "speaking";
    const isConnecting = status === "connecting";
    const statusLabel = conversationActive ? "" : STATUS_LABELS[status];

    const panelContent = (
        <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-champagne/50 shrink-0">
                <div className="flex items-center space-x-2.5">
                    {!isMobile && (
                        <button
                            onClick={minimizeToStrip}
                            className="group p-1 rounded-lg hover:bg-champagne/40 transition-all"
                            aria-label="Minimize to sidebar"
                            title="Minimize to voice strip"
                        >
                            <PanelRightClose className="w-4 h-4 text-slate transition-all duration-200 group-hover:text-muted-gold group-hover:translate-x-0.5" />
                        </button>
                    )}
                    <div className="w-8 h-8 rounded-full bg-obsidian flex items-center justify-center shrink-0">
                        <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true" style={{ transform: "scale(0.75)" }}>
                            <span /><span /><span /><span />
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-obsidian leading-tight">Grace</p>
                        <p className="text-[9px] uppercase tracking-widest text-muted-gold font-semibold">
                            Your Packaging Atelier
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-0.5">
                    {isMobile && (
                        <button
                            onClick={minimizeToStrip}
                            aria-label="Minimize to voice strip"
                            title="Minimize to voice strip"
                            className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                        >
                            <ChevronDown className="w-4 h-4 text-slate" />
                        </button>
                    )}
                    <button
                        onClick={toggleVoice}
                        aria-label={voiceEnabled ? "Mute" : "Unmute"}
                        className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                    >
                        {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-muted-gold" /> : <VolumeX className="w-3.5 h-3.5 text-slate/40" />}
                    </button>
                    {cartCount > 0 && (
                        <button
                            onClick={() => setShowCart((v) => !v)}
                            className="relative p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                            aria-label={`Cart — ${cartCount} items`}
                        >
                            <ShoppingCart className="w-3.5 h-3.5 text-muted-gold" />
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-obsidian text-bone text-[8px] font-bold flex items-center justify-center">
                                {cartCount}
                            </span>
                        </button>
                    )}
                    <button
                        onClick={closePanel}
                        className="p-1.5 rounded-lg bg-champagne/30 hover:bg-red-100 hover:text-red-600 transition-colors"
                        aria-label="Close Grace"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Mini Cart */}
            <AnimatePresence>
                {showCart && cartCount > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-b border-champagne/50 shrink-0"
                    >
                        <div className="px-4 py-3 bg-obsidian/[0.02] max-h-44 overflow-y-auto">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-gold">Cart ({cartCount})</span>
                                <button onClick={() => setShowCart(false)} className="text-[10px] text-slate hover:text-obsidian">Hide</button>
                            </div>
                            <div className="space-y-2">
                                {cartItems.map((item) => (
                                    <div key={item.graceSku} className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-obsidian truncate">{item.itemName}</p>
                                            <p className="text-[10px] text-slate">
                                                Qty: {item.quantity}{item.unitPrice != null && ` · $${(item.unitPrice * item.quantity).toFixed(2)}`}
                                            </p>
                                        </div>
                                        <button onClick={() => removeItem(item.graceSku)} className="p-1 rounded hover:bg-red-50 shrink-0" aria-label="Remove">
                                            <XCircle className="w-3.5 h-3.5 text-slate/40 hover:text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {checkoutError && (
                                <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 leading-snug">
                                    {checkoutError}
                                </div>
                            )}
                            <button
                                onClick={checkout}
                                disabled={isCheckingOut}
                                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-obsidian text-bone text-xs font-bold hover:bg-muted-gold transition-colors disabled:opacity-50"
                            >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                {isCheckingOut ? "Preparing…" : "Checkout"}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Status Chip */}
            <AnimatePresence>
                {statusLabel && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden shrink-0"
                    >
                        <div className={`flex items-center justify-center gap-2 py-2 text-xs font-medium ${
                            status === "error" ? "bg-red-50 text-red-600"
                            : status === "listening" ? "bg-muted-gold/10 text-muted-gold"
                            : status === "connecting" ? "bg-muted-gold/5 text-muted-gold/80"
                            : "bg-champagne/20 text-slate"
                        }`}>
                            {isListening && <span className="w-2 h-2 rounded-full bg-muted-gold animate-grace-pulse" />}
                            {isProcessing && (
                                <span className="flex items-center space-x-1">
                                    {[0, 150, 300].map((d) => (
                                        <span key={d} className="w-1 h-1 rounded-full bg-slate/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                    ))}
                                </span>
                            )}
                            {isSpeaking && (
                                <span className="grace-voice-bars" aria-hidden="true"><span /><span /><span /><span /></span>
                            )}
                            <span>{statusLabel}</span>
                            {status === "error" && errorMessage && <span className="ml-1 text-[11px] opacity-80">— {errorMessage}</span>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-2">
                        <div className="w-12 h-12 rounded-full bg-obsidian flex items-center justify-center mb-4">
                            <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true" style={{ transform: "scale(1.2)" }}>
                                <span /><span /><span /><span />
                            </span>
                        </div>
                        <p className="font-serif text-obsidian text-lg font-medium mb-1.5">Talk to Grace</p>
                        <p className="text-slate text-xs leading-relaxed max-w-[260px] mb-6">
                            Ask about bottles, closures, compatibility, or pricing. Type below or tap the mic.
                        </p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {chips.map((chip) => (
                                <button
                                    key={chip}
                                    onClick={() => send(chip)}
                                    className="text-[11px] font-medium text-obsidian/80 border border-champagne rounded-full px-3 py-1.5 hover:border-muted-gold hover:bg-muted-gold/5 transition-all cursor-pointer"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role === "grace" && (
                            <div className="w-6 h-6 rounded-full bg-obsidian flex items-center justify-center shrink-0 mr-2 mt-0.5">
                                <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true" style={{ transform: "scale(0.6)" }}>
                                    <span /><span /><span /><span />
                                </span>
                            </div>
                        )}
                        <div className={`rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                            msg.action ? "max-w-[95%]" : "max-w-[85%]"
                        } ${
                            msg.role === "user"
                                ? "bg-obsidian text-bone rounded-br-sm"
                                : "bg-white border border-champagne/60 text-obsidian rounded-bl-sm"
                        }`}>
                            {msg.content && <p>{msg.content}</p>}
                            {msg.action && (
                                <ActionCardRenderer
                                    action={msg.action}
                                    messageId={msg.id}
                                    confirmAction={confirmAction}
                                    dismissAction={dismissAction}
                                    onNavigate={onNavigate}
                                />
                            )}
                        </div>
                    </div>
                ))}
                {status === "thinking" && (
                    <div className="flex justify-start">
                        <div className="w-6 h-6 rounded-full bg-obsidian flex items-center justify-center shrink-0 mr-2 mt-0.5">
                            <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true" style={{ transform: "scale(0.6)" }}>
                                <span /><span /><span /><span />
                            </span>
                        </div>
                        <div className="bg-white border border-champagne/60 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                            <div className="flex items-center space-x-1">
                                {[0, 150, 300].map((d) => (
                                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-gold/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                ))}
                            </div>
                            <span className="text-xs text-slate/70">Grace is thinking…</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="px-4 py-3 border-t border-champagne/50 shrink-0 bg-bone/60">
                {conversationActive && (
                    <div className="flex items-center gap-2 mb-2.5">
                        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-obsidian/5 border border-champagne/60">
                            {isListening && <span className="w-2 h-2 rounded-full bg-muted-gold animate-grace-pulse shrink-0" />}
                            {isSpeaking && (
                                <span className="grace-voice-bars shrink-0" aria-hidden="true"><span /><span /><span /><span /></span>
                            )}
                            {isProcessing && (
                                <span className="flex items-center space-x-1 shrink-0">
                                    {[0, 150, 300].map((d) => (
                                        <span key={d} className="w-1 h-1 rounded-full bg-muted-gold/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                    ))}
                                </span>
                            )}
                            {!isListening && !isSpeaking && !isProcessing && <Mic className="w-3 h-3 text-muted-gold shrink-0" />}
                            <span className="text-[11px] text-slate font-medium truncate">
                                {isConnecting ? "Connecting…" : isListening ? "Listening…" : isSpeaking ? "Speaking…" : isProcessing ? "Thinking…" : "Voice active"}
                            </span>
                        </div>
                        {isSpeaking && (
                            <button
                                onClick={() => { stopSpeaking(); startDictation(); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-obsidian text-bone text-[11px] font-semibold hover:bg-muted-gold transition-colors shrink-0"
                            >
                                <Mic className="w-3 h-3" /> Cut in
                            </button>
                        )}
                        <button
                            onClick={endConversation}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold hover:bg-red-700 transition-colors shrink-0"
                        >
                            <StopCircle className="w-3 h-3" /> End
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {!conversationActive && (
                        <button
                            onClick={startConversation}
                            disabled={isProcessing}
                            aria-label="Start voice conversation"
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-obsidian text-bone hover:bg-muted-gold shadow-md transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
                        >
                            <Mic className="w-4.5 h-4.5" />
                        </button>
                    )}
                    <div className="flex-1 flex items-center gap-2 bg-white border border-champagne/80 rounded-xl px-3 py-2 focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/15 transition-all">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    send();
                                }
                            }}
                            placeholder={isListening ? "Listening…" : "Ask Grace anything…"}
                            disabled={isListening}
                            className="flex-1 bg-transparent text-sm text-obsidian placeholder-slate/50 focus:outline-none disabled:opacity-50"
                            aria-label="Type your message to Grace"
                        />
                        <button
                            onClick={() => send()}
                            disabled={!input.trim() || isProcessing}
                            aria-label="Send"
                            className="p-1.5 bg-obsidian disabled:bg-champagne/50 text-bone rounded-lg transition-colors hover:bg-muted-gold disabled:cursor-not-allowed"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    if (isMobile) {
        return (
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.1}
                onDragEnd={(_, info) => {
                    if (info.offset.y > 100) {
                        if (conversationActive) minimizeToStrip();
                        else closePanel();
                    }
                }}
                className="fixed inset-x-0 bottom-0 z-[55] flex flex-col rounded-t-2xl overflow-hidden shadow-2xl"
                style={{
                    height: "70vh",
                    background: "rgba(250, 248, 245, 0.98)",
                    backdropFilter: "blur(28px) saturate(180%)",
                }}
                role="complementary"
                aria-label="Grace — Your Packaging Atelier"
            >
                <button
                    type="button"
                    onClick={minimizeToStrip}
                    className="w-full py-2 shrink-0 cursor-grab active:cursor-grabbing"
                    aria-label="Minimize to voice strip"
                    title="Swipe down or tap to minimize"
                >
                    <span className="block w-10 h-1 rounded-full bg-champagne/60 mx-auto" />
                </button>
                {panelContent}
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-[55] w-full max-w-[420px] flex flex-col overflow-hidden shadow-2xl"
            style={{
                background: "rgba(250, 248, 245, 0.98)",
                backdropFilter: "blur(28px) saturate(180%)",
                WebkitBackdropFilter: "blur(28px) saturate(180%)",
                borderLeft: "1px solid rgba(212, 197, 169, 0.4)",
            }}
            role="complementary"
            aria-label="Grace — Your Packaging Atelier"
        >
            {panelContent}
        </motion.div>
    );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function GraceSidePanel() {
    const { panelMode, pendingNavigation, clearPendingNavigation } = useGrace();
    const isMobile = useIsMobile();
    const router = useRouter();

    useEffect(() => {
        if (pendingNavigation) {
            router.push(pendingNavigation);
            clearPendingNavigation();
        }
    }, [pendingNavigation, router, clearPendingNavigation]);

    return (
        <AnimatePresence mode="wait">
            {panelMode === "open" && <ChatPanel key="panel" isMobile={isMobile} />}
            {panelMode === "strip" && <VoiceStrip key="strip" isMobile={isMobile} />}
        </AnimatePresence>
    );
}
