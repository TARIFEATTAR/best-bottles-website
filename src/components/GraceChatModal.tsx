"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Send,
    Mic,
    Volume2,
    VolumeX,
    StopCircle,
} from "lucide-react";
import { useGrace, type GraceStatus } from "./GraceProvider";

// ─── Status label map ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<GraceStatus, string> = {
    idle: "",
    connecting: "Connecting to Grace…",
    listening: "Listening — speak now…",
    transcribing: "Transcribing…",
    thinking: "Grace is thinking…",
    speaking: "Grace is speaking…",
    error: "Something went wrong",
};

// ─── Floating trigger button (always visible when modal is closed) ────────────

export function GraceFloatingTrigger() {
    const { open, isOpen, status } = useGrace();
    if (isOpen) return null;

    return (
        <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            onClick={open}
            className="fixed bottom-6 right-6 z-40 flex items-center space-x-2.5 bg-obsidian text-bone rounded-full px-5 py-3 shadow-xl hover:bg-muted-gold transition-all duration-200 cursor-pointer group"
            aria-label="Talk to Grace"
        >
            <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true">
                <span /><span /><span /><span />
            </span>
            <span className="text-sm font-medium tracking-wide">Talk to Grace</span>
        </motion.button>
    );
}

// ─── Main Chat Modal ──────────────────────────────────────────────────────────

export default function GraceChatModal() {
    const {
        isOpen,
        close,
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
    } = useGrace();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();

    const isProductPage = pathname?.startsWith("/products/");
    const chips = isProductPage
        ? ["Pair a cap", "View compatibility", "See bulk pricing", "Add to order"]
        : ["Find a bottle", "Check compatibility", "Volume pricing", "Track my order"];

    // Auto-scroll to newest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, status]);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            const id = setTimeout(() => inputRef.current?.focus(), 200);
            return () => clearTimeout(id);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) close();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, close]);

    const isProcessing = status === "thinking" || status === "transcribing" || status === "connecting";
    const isListening = status === "listening";
    const isSpeaking = status === "speaking";
    const isConnecting = status === "connecting";

    const statusLabel = conversationActive
        ? ""
        : STATUS_LABELS[status];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="grace-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50"
                        style={{
                            background: "rgba(29, 29, 31, 0.5)",
                            backdropFilter: "blur(6px)",
                        }}
                        onClick={close}
                        aria-hidden="true"
                    />

                    {/* Centered Modal */}
                    <motion.div
                        key="grace-modal"
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 20 }}
                        transition={{ type: "spring", damping: 28, stiffness: 340 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="relative w-full max-w-[640px] h-[min(85vh,720px)] flex flex-col rounded-2xl overflow-hidden shadow-2xl pointer-events-auto"
                            style={{
                                background: "rgba(250, 248, 245, 0.98)",
                                backdropFilter: "blur(28px) saturate(180%)",
                                WebkitBackdropFilter: "blur(28px) saturate(180%)",
                            }}
                            role="dialog"
                            aria-label="Grace — Your Packaging Atelier"
                            aria-modal="true"
                        >
                            {/* ── Header ─────────────────────────────────── */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-champagne/50 shrink-0">
                                <div className="flex items-center space-x-3">
                                    <div className="w-9 h-9 rounded-full bg-obsidian flex items-center justify-center shrink-0">
                                        <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true">
                                            <span /><span /><span /><span />
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-obsidian leading-tight">Grace</p>
                                        <p className="text-[10px] uppercase tracking-widest text-muted-gold font-semibold">
                                            Your Packaging Atelier
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={toggleVoice}
                                        aria-label={voiceEnabled ? "Mute Grace's voice" : "Enable Grace's voice"}
                                        title={voiceEnabled ? "Grace will speak replies aloud — click to mute" : "Grace is muted — click to hear her replies"}
                                        className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                                    >
                                        {voiceEnabled ? (
                                            <Volume2 className="w-4 h-4 text-muted-gold" />
                                        ) : (
                                            <VolumeX className="w-4 h-4 text-slate/40" />
                                        )}
                                    </button>
                                    <button
                                        onClick={close}
                                        className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                                        aria-label="Close Grace"
                                    >
                                        <X className="w-4 h-4 text-slate" />
                                    </button>
                                </div>
                            </div>

                            {/* ── Status Chip ────────────────────────────── */}
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
                                            status === "error"
                                                ? "bg-red-50 text-red-600"
                                                : status === "listening"
                                                ? "bg-muted-gold/10 text-muted-gold"
                                                : status === "connecting"
                                                ? "bg-muted-gold/5 text-muted-gold/80"
                                                : "bg-champagne/20 text-slate"
                                        }`}>
                                            {isListening && (
                                                <span className="w-2 h-2 rounded-full bg-muted-gold animate-grace-pulse" />
                                            )}
                                            {isProcessing && (
                                                <span className="flex items-center space-x-1">
                                                    {[0, 150, 300].map((delay) => (
                                                        <span
                                                            key={delay}
                                                            className="w-1 h-1 rounded-full bg-slate/60 animate-bounce"
                                                            style={{ animationDelay: `${delay}ms` }}
                                                        />
                                                    ))}
                                                </span>
                                            )}
                                            {isSpeaking && (
                                                <span className="grace-voice-bars" aria-hidden="true">
                                                    <span /><span /><span /><span />
                                                </span>
                                            )}
                                            <span>{statusLabel}</span>
                                            {status === "error" && errorMessage && (
                                                <span className="ml-1 text-[11px] opacity-80">— {errorMessage}</span>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Messages ────────────────────────────────── */}
                            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                        <div className="w-14 h-14 rounded-full bg-obsidian flex items-center justify-center mb-5">
                                            <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true" style={{ transform: "scale(1.3)" }}>
                                                <span /><span /><span /><span />
                                            </span>
                                        </div>
                                        <p className="font-serif text-obsidian text-xl font-medium mb-2">
                                            Talk to Grace
                                        </p>
                                        <p className="text-slate text-sm leading-relaxed max-w-sm mb-8">
                                            Ask anything about bottles, closures, compatibility, pricing, or your order. Type below or tap the microphone to speak.
                                        </p>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {chips.map((chip) => (
                                                <button
                                                    key={chip}
                                                    onClick={() => send(chip)}
                                                    className="text-xs font-medium text-obsidian/80 border border-champagne rounded-full px-4 py-2 hover:border-muted-gold hover:bg-muted-gold/5 transition-all cursor-pointer"
                                                >
                                                    {chip}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        {msg.role === "grace" && (
                                            <div className="w-7 h-7 rounded-full bg-obsidian flex items-center justify-center shrink-0 mr-2 mt-0.5">
                                                <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true" style={{ transform: "scale(0.7)" }}>
                                                    <span /><span /><span /><span />
                                                </span>
                                            </div>
                                        )}
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                                msg.role === "user"
                                                    ? "bg-obsidian text-bone rounded-br-sm"
                                                    : "bg-white border border-champagne/60 text-obsidian rounded-bl-sm"
                                            }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {status === "thinking" && (
                                    <div className="flex justify-start">
                                        <div className="w-7 h-7 rounded-full bg-obsidian flex items-center justify-center shrink-0 mr-2 mt-0.5">
                                            <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true" style={{ transform: "scale(0.7)" }}>
                                                <span /><span /><span /><span />
                                            </span>
                                        </div>
                                        <div className="bg-white border border-champagne/60 rounded-2xl rounded-bl-sm px-4 py-3 liquid-shimmer flex items-center gap-2">
                                            <div className="flex items-center space-x-1.5">
                                                {[0, 150, 300].map((delay) => (
                                                    <span
                                                        key={delay}
                                                        className="w-1.5 h-1.5 rounded-full bg-muted-gold/60 animate-bounce"
                                                        style={{ animationDelay: `${delay}ms` }}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-slate/70">Grace is thinking…</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* ── Composer ────────────────────────────────── */}
                            <div className="px-6 py-4 border-t border-champagne/50 shrink-0 bg-bone/60">
                                {/* Active conversation bar — shown when voice is live */}
                                {conversationActive && (
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-obsidian/5 border border-champagne/60">
                                            {isListening && (
                                                <span className="w-2.5 h-2.5 rounded-full bg-muted-gold animate-grace-pulse shrink-0" />
                                            )}
                                            {isSpeaking && (
                                                <span className="grace-voice-bars shrink-0" aria-hidden="true">
                                                    <span /><span /><span /><span />
                                                </span>
                                            )}
                                            {isProcessing && (
                                                <span className="flex items-center space-x-1 shrink-0">
                                                    {[0, 150, 300].map((delay) => (
                                                        <span
                                                            key={delay}
                                                            className="w-1.5 h-1.5 rounded-full bg-muted-gold/60 animate-bounce"
                                                            style={{ animationDelay: `${delay}ms` }}
                                                        />
                                                    ))}
                                                </span>
                                            )}
                                            {!isListening && !isSpeaking && !isProcessing && (
                                                <Mic className="w-3.5 h-3.5 text-muted-gold shrink-0" />
                                            )}
                                            <span className="text-xs text-slate font-medium">
                                                {isConnecting
                                                    ? "Connecting to Grace…"
                                                    : isListening
                                                        ? "Listening — speak now…"
                                                        : isSpeaking
                                                            ? "Grace is speaking…"
                                                            : isProcessing
                                                                ? "Grace is thinking…"
                                                                : "Conversation active — waiting…"
                                                }
                                            </span>
                                        </div>

                                        {/* Interrupt button — only when Grace is speaking */}
                                        {isSpeaking && (
                                            <button
                                                onClick={() => { stopSpeaking(); startDictation(); }}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-obsidian text-bone text-xs font-semibold hover:bg-muted-gold transition-colors shrink-0"
                                                aria-label="Interrupt Grace and speak"
                                            >
                                                <Mic className="w-3.5 h-3.5" />
                                                <span>Cut in</span>
                                            </button>
                                        )}

                                        {/* End conversation button — always visible when active */}
                                        <button
                                            onClick={endConversation}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shrink-0 shadow-sm"
                                            aria-label="End voice conversation"
                                        >
                                            <StopCircle className="w-3.5 h-3.5" />
                                            <span>End</span>
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center gap-3">
                                    {/* Mic button — starts conversation when not active */}
                                    {!conversationActive && (
                                        <div className="flex flex-col items-center shrink-0">
                                            <button
                                                onClick={startConversation}
                                                disabled={isProcessing}
                                                aria-label="Start voice conversation"
                                                className="w-11 h-11 rounded-full flex items-center justify-center bg-obsidian text-bone hover:bg-muted-gold shadow-md transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Mic className="w-5 h-5" />
                                            </button>
                                            <span className="text-[9px] font-semibold mt-1 uppercase tracking-wider text-slate/50">
                                                Talk
                                            </span>
                                        </div>
                                    )}

                                    {/* Text input */}
                                    <div className="flex-1 flex items-center gap-2 bg-white border border-champagne/80 rounded-xl px-4 py-2.5 focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/15 transition-all">
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
                                            placeholder={
                                                isListening ? "Listening…" :
                                                status === "transcribing" ? "Transcribing…" :
                                                "Type your question and press Enter…"
                                            }
                                            disabled={isListening}
                                            className="flex-1 bg-transparent text-sm text-obsidian placeholder-slate/50 focus:outline-none disabled:opacity-50"
                                            aria-label="Type your message to Grace"
                                        />
                                        <button
                                            onClick={() => send()}
                                            disabled={!input.trim() || isProcessing}
                                            aria-label="Send message"
                                            className="p-1.5 bg-obsidian disabled:bg-champagne/50 text-bone rounded-lg transition-colors hover:bg-muted-gold disabled:cursor-not-allowed"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
