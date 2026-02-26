"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    ChevronUp,
    Maximize2,
    Minimize2,
    Send,
    Mic,
    Volume2,
    VolumeX,
    StopCircle,
    ShoppingBag,
    Eye,
    Layers,
    Package,
} from "lucide-react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelState = "closed" | "open" | "full";

interface Message {
    role: "user" | "grace";
    content: string;
    id: string;
}

// ─── Custom event type declarations ──────────────────────────────────────────

declare global {
    interface DocumentEventMap {
        "grace:open": CustomEvent<void>;
        "grace:statechange": CustomEvent<{ isOpen: boolean }>;
    }
}

// ─── Strip markdown artifacts from Grace's text responses ────────────────────

function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, "$1")    // **bold**
        .replace(/__(.*?)__/g, "$1")          // __bold__
        .replace(/\*(.*?)\*/g, "$1")          // *italic*
        .replace(/_(.*?)_/g, "$1")            // _italic_
        .replace(/^#{1,6}\s+/gm, "")          // ## Heading
        .replace(/^[-*+]\s+/gm, "")           // - bullet
        .replace(/`([^`]*)`/g, "$1")          // `code`
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// ─── Recently-viewed stub (replaced by localStorage in a later phase) ────────

const DEMO_RECENTLY_VIEWED = [
    { name: "Elegant 30ml Clear", sku: "ELG-30-CLR" },
    { name: "Boston Round 50ml Amber", sku: "BRD-50-AMB" },
    { name: "Cylinder 15ml Frosted", sku: "CYL-15-FRS" },
];

// ─── Spring config ────────────────────────────────────────────────────────────

const DRAWER_SPRING = { type: "spring" as const, damping: 32, stiffness: 320 };

// ─── Component ────────────────────────────────────────────────────────────────

export default function GraceAtelier() {
    const [panelState, setPanelState] = useState<PanelState>("closed");
    const [isPinned, setIsPinned] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const [isDictating, setIsDictating] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [micErrorMsg, setMicErrorMsg] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [orderQuery, setOrderQuery] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Always-current ref so recorder.onstop closure calls the latest handleSend
    const handleSendRef = useRef<(text?: string, fromVoice?: boolean) => Promise<void>>(async () => {});

    const askGrace = useAction(api.grace.askGrace);
    const pathname = usePathname();

    const isProductPage = pathname?.startsWith("/products/");
    const chips = isProductPage
        ? ["Pair a cap", "View compatibility", "See bulk pricing", "Add to order"]
        : ["Find a bottle", "Check compatibility", "Volume pricing", "Track my order"];

    // ── Listen for external open trigger (Navbar button, hero CTA, etc.) ──────
    useEffect(() => {
        const handleExternalOpen = () => {
            setPanelState("open");
            setIsPinned(false);
        };
        document.addEventListener("grace:open", handleExternalOpen);
        return () => document.removeEventListener("grace:open", handleExternalOpen);
    }, []);

    // ── Broadcast open/close state so Navbar can reflect it ──────────────────
    useEffect(() => {
        document.dispatchEvent(
            new CustomEvent("grace:statechange", {
                detail: { isOpen: panelState !== "closed" },
            })
        );
    }, [panelState]);

    // ── Scroll-minimise with hysteresis: pin at >120px, unpin at <30px ────────
    useEffect(() => {
        if (panelState === "closed") {
            setIsPinned(false);
            return;
        }
        // FIX: use hysteresis thresholds to prevent rapid pin/unpin toggling.
        // FIX: pass { passive: true } to BOTH add and remove to match signatures.
        const handleScroll = () => {
            const y = window.scrollY;
            setIsPinned((prev) => (prev ? y > 30 : y > 120));
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll, { passive: true } as EventListenerOptions);
    }, [panelState]);

    // ── Auto-scroll to newest message ─────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isThinking]);

    // ── Focus input when panel opens — with cleanup to prevent queued calls ───
    useEffect(() => {
        if (panelState === "open" || panelState === "full") {
            // FIX: store timeout id and clear it on cleanup to prevent
            // multiple queued focus calls if the panel flickers open/close rapidly.
            const id = setTimeout(() => inputRef.current?.focus(), 350);
            return () => clearTimeout(id);
        }
    }, [panelState]);

    // ── Stop any active recording on unmount ──────────────────────────────────
    useEffect(() => {
        return () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
            if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    // ── Actions ───────────────────────────────────────────────────────────────

    const handleClose = () => {
        setPanelState("closed");
        setIsPinned(false);
        stopSpeaking();
    };

    // FIX: "Resume" scrolls back to the top so the panel won't immediately
    // re-pin (since scrollY will be ~0 after the scroll, below both thresholds).
    const handleResume = () => {
        setIsPinned(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ── Voice synthesis via /api/voice proxy ──────────────────────────────────
    const playGraceVoice = async (text: string) => {
        if (!voiceEnabled) return;
        // Stop any currently-playing audio before starting a new one
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }
        try {
            const res = await fetch("/api/voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            if (!res.ok) return;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            setIsSpeaking(true);
            audio.play().catch(() => {});
            audio.onended = () => {
                URL.revokeObjectURL(url);
                audioRef.current = null;
                setIsSpeaking(false);
            };
        } catch {
            setIsSpeaking(false);
        }
    };

    const stopSpeaking = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }
        setIsSpeaking(false);
    };

    const handleSend = async (text?: string, fromVoice = false) => {
        const msg = (text ?? input).trim();
        if (!msg) return;

        const userMsg: Message = { role: "user", content: msg, id: `${Date.now()}` };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsThinking(true);

        try {
            // Build full history for Claude: map "grace" → "assistant" as required by the API
            const history: Array<{ role: "user" | "assistant"; content: string }> = [
                ...messages.map((m) => ({
                    role: (m.role === "grace" ? "assistant" : "user") as "user" | "assistant",
                    content: m.content,
                })),
                { role: "user" as const, content: msg },
            ];
            // Timeout after 45s to avoid infinite "thinking" state
            const response = await Promise.race([
                (askGrace as (args: { messages: typeof history; voiceMode?: boolean }) => Promise<string>)({
                    messages: history,
                    voiceMode: fromVoice,
                }),
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Grace took too long to respond. Please try again.")), 45000)
                ),
            ]);
            const graceText = stripMarkdown(response);
            setMessages((prev) => [
                ...prev,
                { role: "grace", content: graceText, id: `${Date.now() + 1}` },
            ]);
            // Only speak the response when the customer used their voice to ask
            if (fromVoice) playGraceVoice(graceText);
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "I had trouble connecting just now. Please try again in a moment.";
            console.error("[Grace] askGrace failed:", err);
            setMessages((prev) => [
                ...prev,
                {
                    role: "grace",
                    content: errorMessage,
                    id: `${Date.now() + 1}`,
                },
            ]);
        } finally {
            setIsThinking(false);
        }
    };

    // ── Keep handleSendRef current so the recorder closure always calls
    //    the latest version (avoids stale-closure over messages state) ─────────
    handleSendRef.current = handleSend;

    // ── Voice recording (STT via ElevenLabs) ─────────────────────────────────

    const startDictation = async () => {
        // Stop any playing TTS to avoid feedback loop
        stopSpeaking();
        try {
            console.log("[Grace STT] Requesting mic…");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("[Grace STT] Mic granted, starting recorder");
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/mp4")
                ? "audio/mp4"
                : "";
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(audioChunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });
                console.log("[Grace STT] Recording stopped, blob size:", blob.size, "type:", blob.type);
                if (blob.size < 500) {
                    console.warn("[Grace STT] Blob too small, skipping transcription");
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "grace",
                            content: "I didn't catch that — the recording was too short. Try speaking a bit longer, or type your question instead.",
                            id: `${Date.now()}`,
                        },
                    ]);
                    return;
                }
                setIsTranscribing(true);
                try {
                    const fd = new FormData();
                    fd.append("audio", blob, "recording.webm");
                    const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
                    if (!res.ok) {
                        console.error("[Grace STT] Transcription failed:", res.status, await res.text());
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: "grace",
                                content: "I couldn't transcribe that. Please type your question in the box below.",
                                id: `${Date.now()}`,
                            },
                        ]);
                        return;
                    }
                    const { text } = (await res.json()) as { text: string };
                    console.log("[Grace STT] Transcript:", JSON.stringify(text));
                    if (text?.trim()) {
                        handleSendRef.current(text.trim(), true);
                    } else {
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: "grace",
                                content: "I didn't catch what you said. Try speaking clearly or type your question instead.",
                                id: `${Date.now()}`,
                            },
                        ]);
                    }
                } catch {
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "grace",
                            content: "Voice input isn't available right now. Please type your question below.",
                            id: `${Date.now()}`,
                        },
                    ]);
                } finally {
                    setIsTranscribing(false);
                }
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsDictating(true);

            // ── Silence detection: auto-stop 1.5s after the user stops speaking ──
            try {
                const audioCtx = new AudioContext();
                audioContextRef.current = audioCtx;
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                audioCtx.createMediaStreamSource(stream).connect(analyser);
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                const SILENCE_THRESHOLD = 8;   // RMS below this = silence
                const SILENCE_DELAY_MS = 1500; // wait 1.5s of silence before stopping

                const checkSilence = () => {
                    if (mediaRecorderRef.current?.state !== "recording") return;
                    analyser.getByteFrequencyData(dataArray);
                    const rms = Math.sqrt(
                        dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length
                    );
                    if (rms < SILENCE_THRESHOLD) {
                        if (!silenceTimerRef.current) {
                            silenceTimerRef.current = setTimeout(() => {
                                silenceTimerRef.current = null;
                                stopDictation();
                            }, SILENCE_DELAY_MS);
                        }
                    } else {
                        if (silenceTimerRef.current) {
                            clearTimeout(silenceTimerRef.current);
                            silenceTimerRef.current = null;
                        }
                    }
                    requestAnimationFrame(checkSilence);
                };
                requestAnimationFrame(checkSilence);
            } catch {
                // AudioContext not available — user must tap mic to stop manually
            }
        } catch (err) {
            console.error("[Grace STT] Failed to start recording:", err);
            const msg =
                err instanceof Error && err.name === "NotAllowedError"
                    ? "Mic access denied — check browser settings"
                    : "Could not start microphone";
            setMicErrorMsg(msg);
            setTimeout(() => setMicErrorMsg(""), 3500);
        }
    };

    const stopDictation = () => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        setIsDictating(false);
    };

    const handleMicClick = () => {
        if (isDictating) {
            stopDictation();
        } else {
            startDictation();
        }
    };

    // ── Conversation column JSX (called as function, NOT as <Component />) ────
    // FIX: defining these as inner arrow-function components and rendering them
    // as <ConversationColumn /> would cause React to remount the subtree on every
    // parent re-render (new function reference = new component type). Instead we
    // call them as plain functions so their JSX is inlined into the parent fiber.

    const conversationColumn = () => (
        <div className="flex flex-col flex-1 min-w-0 h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-champagne/50 shrink-0">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-obsidian flex items-center justify-center shrink-0">
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
                    {/* Stop speaking button — only visible while Grace is talking */}
                    {isSpeaking && (
                        <button
                            onClick={stopSpeaking}
                            aria-label="Stop Grace speaking"
                            className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                        >
                            <StopCircle className="w-4 h-4 text-muted-gold animate-grace-pulse" />
                        </button>
                    )}
                    {/* Voice mute toggle */}
                    <button
                        onClick={() => {
                            setVoiceEnabled((v) => {
                                if (v) stopSpeaking();
                                return !v;
                            });
                        }}
                        aria-label={voiceEnabled ? "Mute Grace" : "Unmute Grace"}
                        className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                    >
                        {voiceEnabled ? (
                            <Volume2 className="w-4 h-4 text-muted-gold" />
                        ) : (
                            <VolumeX className="w-4 h-4 text-slate/40" />
                        )}
                    </button>
                    <button
                        onClick={() => setPanelState(panelState === "full" ? "open" : "full")}
                        className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                        aria-label={panelState === "full" ? "Collapse" : "Expand"}
                    >
                        {panelState === "full" ? (
                            <Minimize2 className="w-4 h-4 text-slate" />
                        ) : (
                            <Maximize2 className="w-4 h-4 text-slate" />
                        )}
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                        aria-label="Close Grace"
                    >
                        <X className="w-4 h-4 text-slate" />
                    </button>
                </div>
            </div>

            {/* Context chips */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-champagne/30 overflow-x-auto shrink-0 hide-scroll">
                {chips.map((chip) => (
                    <button
                        key={chip}
                        onClick={() => handleSend(chip)}
                        className="shrink-0 text-[11px] font-medium text-obsidian border border-champagne/80 rounded-xl px-3 py-1.5 hover:border-muted-gold hover:bg-muted-gold/5 transition-all duration-150 whitespace-nowrap cursor-pointer"
                    >
                        {chip}
                    </button>
                ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                        <p className="font-serif text-obsidian text-base font-medium mb-2">
                            Start a conversation with Grace
                        </p>
                        <p className="text-slate text-sm leading-relaxed max-w-[280px] mb-6">
                            Ask me anything about bottles, closures, compatibility, or your order. Type below or tap the microphone to speak.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {chips.map((chip) => (
                                <button
                                    key={chip}
                                    onClick={() => handleSend(chip)}
                                    className="text-[11px] font-medium text-obsidian/80 border border-champagne rounded-xl px-3 py-1.5 hover:border-muted-gold hover:bg-muted-gold/5 transition-all cursor-pointer"
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
                        <div
                            className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                                msg.role === "user"
                                    ? "bg-obsidian text-bone rounded-br-sm"
                                    : "bg-white border border-champagne/60 text-obsidian rounded-bl-sm"
                            }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-champagne/60 rounded-xl rounded-bl-sm px-4 py-3 liquid-shimmer flex items-center gap-2">
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

            {/* Input bar */}
            <div className="px-5 py-4 border-t border-champagne/50 shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-slate/60 mb-2 font-medium">
                    Chat with Grace — type or use the mic
                </p>
                <div className="flex items-center gap-2 bg-white border border-champagne/80 rounded-xl px-4 py-2.5 focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/15 transition-all">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={
                            micErrorMsg ? micErrorMsg :
                            isDictating ? "Listening…" :
                            isTranscribing ? "Transcribing…" :
                            "Type your question and press Enter..."
                        }
                        className="flex-1 bg-transparent text-sm text-obsidian placeholder-slate/50 focus:outline-none"
                        aria-label="Type your message to Grace"
                    />
                    <button
                        onClick={handleMicClick}
                        disabled={isTranscribing || isThinking}
                        aria-label={isDictating ? "Stop recording" : "Voice input"}
                        className={`p-1 rounded-lg transition-colors disabled:cursor-not-allowed ${
                            isDictating
                                ? "text-muted-gold animate-grace-pulse"
                                : isTranscribing
                                ? "text-muted-gold/60 animate-bounce"
                                : "text-slate/40 hover:text-slate"
                        }`}
                    >
                        <Mic className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim()}
                        aria-label="Send message"
                        className="p-1.5 bg-obsidian disabled:bg-champagne/50 text-bone rounded-lg transition-colors hover:bg-muted-gold disabled:cursor-not-allowed"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Workspace sidebar JSX (also called as a function) ─────────────────────

    const workspaceSidebar = () => (
        <div className="hidden md:flex flex-col w-[320px] shrink-0 border-l border-champagne/30 bg-[#F2EDE4]/50 h-full overflow-y-auto">

            {/* Quick Cart */}
            <div className="p-5 border-b border-champagne/40">
                <div className="flex items-center space-x-2 mb-3">
                    <ShoppingBag className="w-4 h-4 text-muted-gold" strokeWidth={1.5} />
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-obsidian">Cart</p>
                </div>
                <p className="text-xs text-slate/70 italic">Your cart is empty. Ask Grace to help find the perfect bottle.</p>
            </div>

            {/* Recently Viewed */}
            <div className="p-5 border-b border-champagne/40">
                <div className="flex items-center space-x-2 mb-3">
                    <Eye className="w-4 h-4 text-muted-gold" strokeWidth={1.5} />
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-obsidian">Recently Viewed</p>
                </div>
                <div className="space-y-3">
                    {DEMO_RECENTLY_VIEWED.map((item) => (
                        <div key={item.sku} className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-obsidian leading-snug">{item.name}</p>
                                <p className="text-[10px] text-slate font-mono mt-0.5">{item.sku}</p>
                            </div>
                            <button className="text-[10px] font-semibold text-muted-gold hover:text-obsidian transition-colors whitespace-nowrap ml-2">
                                View →
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Build My System */}
            <div className="p-5 border-b border-champagne/40">
                <div className="flex items-center space-x-2 mb-3">
                    <Layers className="w-4 h-4 text-muted-gold" strokeWidth={1.5} />
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-obsidian">Build My System</p>
                </div>
                <p className="text-xs text-slate/80 mb-4 leading-relaxed">
                    Find a bottle, match a closure, and calculate volume pricing — all in one guided flow.
                </p>
                <a
                    href="/catalog"
                    className="block text-center text-[11px] font-semibold uppercase tracking-widest text-obsidian border border-champagne py-2 rounded-xl hover:border-muted-gold hover:bg-muted-gold/5 transition-all"
                >
                    Start Building
                </a>
            </div>

            {/* Order Status */}
            <div className="p-5">
                <div className="flex items-center space-x-2 mb-3">
                    <Package className="w-4 h-4 text-muted-gold" strokeWidth={1.5} />
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-obsidian">Order Status</p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={orderQuery}
                        onChange={(e) => setOrderQuery(e.target.value)}
                        placeholder="Order #"
                        className="flex-1 text-xs bg-white border border-champagne rounded-xl px-3 py-2 focus:outline-none focus:border-muted-gold text-obsidian placeholder-slate/50"
                    />
                    <button className="px-3 py-2 bg-obsidian text-bone text-xs rounded-xl hover:bg-muted-gold transition-colors font-medium whitespace-nowrap cursor-pointer">
                        Look up
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            {/* ── CLOSED TRIGGER STRIP ───────────────────────────────────────── */}
            <AnimatePresence>
                {panelState === "closed" && (
                    <motion.button
                        key="trigger"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.22 }}
                        onClick={() => { setPanelState("open"); setIsPinned(false); }}
                        className="fixed bottom-4 right-6 z-40 flex items-center space-x-2.5 bg-bone border border-champagne rounded-xl px-4 py-2.5 shadow-lg hover:border-muted-gold hover:shadow-xl transition-all duration-200 cursor-pointer"
                    >
                        <span className="w-2 h-2 rounded-full bg-muted-gold animate-grace-pulse shrink-0" />
                        <span className="text-sm font-medium text-obsidian tracking-wide">Grace</span>
                        <ChevronUp className="w-3.5 h-3.5 text-slate" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── PINNED HEADER STRIP (scroll-minimised) ─────────────────────── */}
            <AnimatePresence>
                {isPinned && panelState !== "closed" && (
                    <motion.div
                        key="pinned"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="fixed top-[104px] left-0 right-0 z-40 bg-bone/95 backdrop-blur-md border-b border-champagne"
                    >
                        <div className="max-w-[1440px] mx-auto px-6 h-10 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <span className="grace-voice-bars" aria-hidden="true">
                                    <span /><span /><span /><span />
                                </span>
                                <span className="text-xs font-medium text-obsidian tracking-wide">Grace · Active</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={handleResume}
                                    className="text-xs font-semibold text-muted-gold hover:text-obsidian transition-colors px-3 py-1 rounded-lg hover:bg-champagne/30 cursor-pointer"
                                >
                                    Resume ↑
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors cursor-pointer"
                                    aria-label="Close Grace"
                                >
                                    <X className="w-3.5 h-3.5 text-slate" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── OPEN DRAWER (standard + full-screen) ───────────────────────── */}
            <AnimatePresence>
                {(panelState === "open" || panelState === "full") && !isPinned && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40"
                            style={{
                                background: "rgba(29, 29, 31, 0.45)",
                                backdropFilter: "blur(4px)",
                            }}
                            onClick={handleClose}
                            aria-hidden="true"
                        />

                        {/* Drawer panel */}
                        <motion.div
                            key="drawer"
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={DRAWER_SPRING}
                            className={`fixed top-0 right-0 h-full z-50 flex shadow-2xl border-l border-champagne/40 ${
                                panelState === "full"
                                    ? "w-full"
                                    : "w-full max-w-[420px] md:max-w-[760px]"
                            }`}
                            style={{
                                background: "rgba(250, 248, 245, 0.97)",
                                backdropFilter: "blur(28px) saturate(180%)",
                                WebkitBackdropFilter: "blur(28px) saturate(180%)",
                                boxShadow: "-24px 0 80px rgba(29, 29, 31, 0.18), -2px 0 0 rgba(255,255,255,0.6) inset",
                            }}
                            role="dialog"
                            aria-label="Grace — Your Packaging Atelier"
                        >
                            {conversationColumn()}
                            {workspaceSidebar()}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
