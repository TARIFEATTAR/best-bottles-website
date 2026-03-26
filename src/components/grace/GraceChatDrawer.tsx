"use client";

import { useRef, useEffect, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Waveform,
    PaperPlaneTilt,
    MagnifyingGlass,
    SprayBottle,
    Package,
    Eyedropper,
    Question,
} from "@phosphor-icons/react";
import { useGrace } from "@/components/useGrace";
import GraceChatMessage, { StreamingMessage } from "./GraceChatMessage";

const DRAWER_WIDTH = 380;

function useIsMobile() {
    const [mobile, setMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        setMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return mobile;
}

const QUICK_CHIPS = [
    { label: "Find a bottle", icon: MagnifyingGlass, query: "Help me find the right bottle for my product" },
    { label: "What fits this?", icon: SprayBottle, query: "What closures and applicators fit my current bottle?" },
    { label: "Compare sizes", icon: Package, query: "Compare bottle sizes available in the Cylinder family" },
    { label: "Dropper options", icon: Eyedropper, query: "Show me dropper bottles for essential oils" },
    { label: "Thread sizes", icon: Question, query: "How do I know which thread size I need?" },
];

export default function GraceChatDrawer() {
    const {
        panelMode,
        closePanel,
        messages,
        streamingText,
        input,
        setInput,
        send,
        conversationActive,
        endConversation,
    } = useGrace();

    const isOpen = panelMode === "open";
    const isMobile = useIsMobile();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingText]);

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

    const handleChipClick = (query: string) => {
        send(query);
    };

    const hasMessages = messages.length > 0 || !!streamingText;

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
                        className={`fixed top-0 right-0 bottom-0 z-[61] flex flex-col ${
                            isMobile ? "w-full" : ""
                        }`}
                        style={{
                            width: isMobile ? "100%" : DRAWER_WIDTH,
                            background: "#faf8f5",
                            borderLeft: "1px solid rgba(212, 197, 169, 0.35)",
                            boxShadow: "-8px 0 40px rgba(29, 29, 31, 0.08)",
                        }}
                        role="complementary"
                        aria-label="Grace AI chat"
                    >
                        {/* ── Header ─────────────────────────────────────── */}
                        <div
                            className="flex items-center justify-between px-5 py-3.5 shrink-0"
                            style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.25)" }}
                        >
                            <span className="text-[13px] font-medium text-obsidian/80 tracking-wide font-sans">
                                New chat
                            </span>

                            <button
                                onClick={handleClose}
                                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150 cursor-pointer hover:bg-black/5"
                                aria-label="Close Grace"
                            >
                                <X className="text-obsidian/50" size={15} />
                            </button>
                        </div>

                        {/* ── Messages / Empty state ─────────────────────── */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {!hasMessages && (
                                <div className="pt-2 pb-6">
                                    <p className="text-[15px] text-obsidian/80 leading-relaxed font-sans">
                                        Hi! How can I help you today?
                                    </p>

                                    <div className="grid grid-cols-2 gap-2 mt-6">
                                        {QUICK_CHIPS.map((chip) => (
                                            <button
                                                key={chip.label}
                                                onClick={() => handleChipClick(chip.query)}
                                                className="flex items-start gap-2.5 p-3 rounded-lg text-left transition-colors duration-150 cursor-pointer hover:bg-obsidian/[0.04] group"
                                                style={{ border: "1px solid rgba(29, 29, 31, 0.08)" }}
                                            >
                                                <chip.icon
                                                    size={16}
                                                    className="text-obsidian/40 mt-0.5 shrink-0 group-hover:text-obsidian/60 transition-colors"
                                                    weight="regular"
                                                />
                                                <span className="text-[12.5px] text-obsidian/70 leading-snug font-sans">
                                                    {chip.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((msg) => (
                                <GraceChatMessage key={msg.id} message={msg} />
                            ))}

                            <StreamingMessage text={streamingText} />

                            <div ref={messagesEndRef} />
                        </div>

                        {/* ── Input area ──────────────────────────────────── */}
                        <div className="shrink-0 px-4 py-3">
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
                                    className="w-full bg-transparent text-[14px] text-obsidian placeholder:text-obsidian/30 outline-none font-sans resize-none px-3.5 pt-3 pb-10 leading-relaxed"
                                    autoComplete="off"
                                />

                                <div className="absolute bottom-2.5 right-3 flex items-center">
                                    <button
                                        type="submit"
                                        disabled={!input.trim()}
                                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer shrink-0 bg-obsidian/90 text-bone disabled:opacity-20 disabled:cursor-default hover:bg-obsidian"
                                        aria-label="Send message"
                                    >
                                        <Waveform size={16} weight="bold" />
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
