"use client";

import { useRef, useEffect, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Waveform,
    Package,
    Truck,
    Compass,
    Leaf,
} from "@phosphor-icons/react";
import { useGrace } from "@/components/useGrace";
import GraceChatMessage, { StreamingMessage, ThinkingIndicator } from "./GraceChatMessage";

/** Desktop drawer width; keep in sync with layout push in `GraceLayoutShell`. */
const DRAWER_WIDTH = 560;

function useIsMobile() {
    const [mobile, setMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
        setMobile(mq.matches); // eslint-disable-line react-hooks/set-state-in-effect -- sync initial media query state
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return mobile;
}

const QUICK_CHIPS = [
    { label: "Shipping & Delivery", icon: Truck, query: "What are your shipping rates and estimated delivery times?" },
    { label: "Request Samples", icon: Package, query: "How do I request physical samples for my brand?" },
    { label: "Style Discovery", icon: Compass, query: "Help me find a unique bottling style for a high-end fragrance." },
    { label: "Eco-Friendly", icon: Leaf, query: "What are your most sustainable or eco-friendly packaging solutions?" },
];

/** Five-bar voice waveform — matches reference: tall center, tapering sides, rounded bar caps */
function VoiceWaveformGlyph({ className }: { className?: string }) {
    const bars = [
        { h: "h-[7px]" },
        { h: "h-[11px]" },
        { h: "h-[14px]" },
        { h: "h-[11px]" },
        { h: "h-[7px]" },
    ];
    return (
        <span
            className={`inline-flex items-center justify-center gap-[3px] ${className ?? ""}`}
            aria-hidden
        >
            {bars.map((b, i) => (
                <span
                    key={i}
                    className={`w-[3px] ${b.h} rounded-full bg-white shrink-0`}
                />
            ))}
        </span>
    );
}

export default function GraceChatDrawer() {
    const {
        panelMode,
        closePanel,
        messages,
        streamingText,
        isAwaitingReply,
        input,
        setInput,
        send,
        conversationActive,
        endConversation,
        errorMessage,
        toggleVoice,
        voiceEnabled,
        status: graceStatus,
    } = useGrace();

    const isOpen = panelMode === "open";
    const isMobile = useIsMobile();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingText, isAwaitingReply]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 350);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) closePanel();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, closePanel]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (input.trim()) send();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (input.trim()) send();
        }
    };

    const handleClose = () => {
        if (conversationActive) endConversation();
        closePanel();
    };

    const [chipsUsed, setChipsUsed] = useState(false);

    const handleChipClick = (query: string) => {
        setChipsUsed(true);
        send(query);
    };

    // Only the initial Grace greeting(s) — user hasn't typed or tapped a chip yet
    const userHasInteracted = chipsUsed || messages.some((m) => m.role === "user");
    const showChips = !userHasInteracted;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {isMobile && (
                        <motion.div
                            key="grace-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            onClick={handleClose}
                            className="fixed inset-0 z-[60]"
                            style={{ background: "rgba(29, 29, 31, 0.35)", backdropFilter: "blur(2px)" }}
                            aria-hidden="true"
                        />
                    )}

                    <motion.aside
                        key="grace-drawer"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 320, damping: 38 }}
                        className={`fixed top-0 right-0 z-[61] flex flex-col ${
                            isMobile ? "w-full" : ""
                        }`}
                        style={{
                            width: isMobile ? "100%" : DRAWER_WIDTH,
                            height: "100dvh",
                            background: "#faf8f5",
                            borderLeft: "1px solid rgba(212, 197, 169, 0.35)",
                            boxShadow: "-8px 0 40px rgba(29, 29, 31, 0.08)",
                        }}
                        role="complementary"
                        aria-label="Grace AI chat"
                    >
                        {/* ── Header ─────────────────────────────────────── */}
                        <div
                            className="flex items-center justify-between px-5 py-3.5 shrink-0 relative"
                            style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.25)" }}
                        >
                            {isMobile && (
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 cursor-pointer pb-4 pr-4 pl-4" onClick={handleClose}>
                                    <div className="w-10 h-1.5 rounded-full bg-white/30 backdrop-blur-md grace-sheet-handle" />
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-obsidian flex items-center justify-center shadow-sm">
                                    <Waveform className="text-white" size={18} weight="fill" />
                                </div>
                                <span className="text-[14px] font-semibold text-obsidian tracking-tight font-sans">
                                    Ask Grace AI
                                </span>
                            </div>

                            <button
                                onClick={handleClose}
                                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150 cursor-pointer hover:bg-black/5"
                                aria-label="Close Grace"
                            >
                                <X className="text-obsidian/50" size={15} />
                            </button>
                        </div>

                        {/* ── Messages ─────────────────────────────────── */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {messages.map((msg) => (
                                <GraceChatMessage key={msg.id} message={msg} />
                            ))}

                            <StreamingMessage text={streamingText} />

                            {isAwaitingReply && !streamingText && (
                                <ThinkingIndicator />
                            )}

                            {errorMessage && (
                                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100/50">
                                    <p className="text-[12px] text-red-600 font-sans leading-relaxed text-center">
                                        {errorMessage}
                                    </p>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* ── Chips (above composer, visible until first interaction) ── */}
                        {showChips && (
                            <div className="shrink-0 px-4 pb-1.5 pt-2" style={{ borderTop: "1px solid rgba(212, 197, 169, 0.15)" }}>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {QUICK_CHIPS.map((chip) => (
                                        <button
                                            key={chip.label}
                                            onClick={() => handleChipClick(chip.query)}
                                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors duration-150 cursor-pointer hover:bg-obsidian/[0.04] group"
                                            style={{ border: "1px solid rgba(29, 29, 31, 0.08)" }}
                                        >
                                            <chip.icon
                                                size={14}
                                                className="text-obsidian/40 shrink-0 group-hover:text-obsidian/60 transition-colors"
                                                weight="regular"
                                            />
                                            <span className="text-[12px] text-obsidian/60 leading-snug font-sans">
                                                {chip.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Input area ──────────────────────────────────── */}
                        <div className="shrink-0 px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
                            <form
                                onSubmit={handleSubmit}
                                className="relative rounded-xl bg-white"
                                style={{ border: "1px solid rgba(29, 29, 31, 0.12)" }}
                            >
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask anything..."
                                    rows={2}
                                    className="w-full bg-transparent text-[14px] text-obsidian placeholder:text-obsidian/30 outline-none font-sans resize-none px-3.5 pt-3 pb-12 leading-relaxed"
                                    autoComplete="off"
                                />

                                <div className="absolute bottom-2.5 right-2.5">
                                    <button
                                        type="button"
                                        onClick={toggleVoice}
                                        title={
                                            voiceEnabled
                                                ? "Voice on — tap to use text only"
                                                : "Use voice"
                                        }
                                        aria-pressed={voiceEnabled}
                                        className={`w-10 h-10 flex items-center justify-center transition-all duration-300 ease-out cursor-pointer bg-obsidian text-white shadow-md hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obsidian/40 ${
                                            voiceEnabled
                                                ? "rounded-lg scale-100"
                                                : "rounded-full hover:scale-105 active:scale-95"
                                        }`}
                                    >
                                        {graceStatus === "connecting" ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : voiceEnabled ? (
                                            <span
                                                className="w-[11px] h-[11px] rounded-[2.5px] bg-white"
                                                aria-hidden
                                            />
                                        ) : (
                                            <VoiceWaveformGlyph />
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}

export { DRAWER_WIDTH };
