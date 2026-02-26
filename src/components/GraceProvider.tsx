"use client";

import {
    createContext,
    useContext,
    useState,
    useRef,
    useCallback,
    useEffect,
    type ReactNode,
} from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    executeRealtimeTool,
    fetchGraceInstructions,
    fetchEphemeralToken,
} from "@/lib/graceRealtime";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GraceStatus =
    | "idle"
    | "connecting"
    | "listening"
    | "transcribing"
    | "thinking"
    | "speaking"
    | "error";

export interface GraceMessage {
    role: "user" | "grace";
    content: string;
    id: string;
}

interface GraceContextValue {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    status: GraceStatus;
    messages: GraceMessage[];
    input: string;
    setInput: (v: string) => void;
    voiceEnabled: boolean;
    toggleVoice: () => void;
    send: (text?: string, fromVoice?: boolean) => Promise<void>;
    startDictation: () => Promise<void>;
    stopDictation: () => void;
    stopSpeaking: () => void;
    errorMessage: string;
    conversationActive: boolean;
    startConversation: () => void;
    endConversation: () => void;
}

const GraceContext = createContext<GraceContextValue | null>(null);

export function useGrace() {
    const ctx = useContext(GraceContext);
    if (!ctx) throw new Error("useGrace must be used within <GraceProvider>");
    return ctx;
}

// ─── Strip markdown artifacts from Grace's text responses ────────────────────

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

export default function GraceProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<GraceStatus>("idle");
    const [messages, setMessages] = useState<GraceMessage[]>([]);
    const [input, setInput] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [conversationActive, setConversationActive] = useState(false);

    // ── Refs: Legacy ElevenLabs pipeline (text-mode fallback) ────────────────
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // ── Refs: OpenAI Realtime WebRTC session ─────────────────────────────────
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const graceTranscriptRef = useRef("");

    const askGrace = useAction(api.grace.askGrace);

    const open = useCallback(() => setIsOpen(true), []);

    // ── Realtime session teardown ────────────────────────────────────────────

    const destroyRealtimeSession = useCallback(() => {
        if (dcRef.current) {
            dcRef.current.close();
            dcRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
            remoteAudioRef.current = null;
        }
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setConversationActive(false);
        destroyRealtimeSession();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }
        setStatus("idle");
    }, [destroyRealtimeSession]);

    // ── Send data channel event to OpenAI Realtime ───────────────────────────

    const sendRTEvent = useCallback(
        (event: Record<string, unknown>) => {
            const dc = dcRef.current;
            if (dc && dc.readyState === "open") {
                dc.send(JSON.stringify(event));
            }
        },
        []
    );

    // ── Handle incoming Realtime events ──────────────────────────────────────

    const handleRealtimeEvent = useCallback(
        (event: Record<string, unknown>) => {
            const type = event.type as string;

            switch (type) {
                case "session.created":
                case "session.updated":
                    console.log("[Grace RT] Session ready");
                    setStatus("listening");
                    break;

                case "input_audio_buffer.speech_started":
                    setStatus("listening");
                    break;

                case "input_audio_buffer.speech_stopped":
                    setStatus("thinking");
                    break;

                case "conversation.item.input_audio_transcription.completed": {
                    const transcript = (event as { transcript?: string }).transcript ?? "";
                    if (transcript.trim()) {
                        setMessages((prev) => [
                            ...prev,
                            { role: "user", content: transcript.trim(), id: `u-${Date.now()}` },
                        ]);
                    }
                    break;
                }

                case "response.audio_transcript.delta": {
                    const delta = (event as { delta?: string }).delta ?? "";
                    graceTranscriptRef.current += delta;
                    setStatus("speaking");
                    break;
                }

                case "response.audio_transcript.done": {
                    const fullText = graceTranscriptRef.current.trim();
                    if (fullText) {
                        setMessages((prev) => [
                            ...prev,
                            { role: "grace", content: stripMarkdown(fullText), id: `g-${Date.now()}` },
                        ]);
                    }
                    graceTranscriptRef.current = "";
                    break;
                }

                case "response.function_call_arguments.done": {
                    const e = event as {
                        call_id?: string;
                        name?: string;
                        arguments?: string;
                    };
                    if (e.call_id && e.name) {
                        const args = JSON.parse(e.arguments ?? "{}");
                        setStatus("thinking");
                        executeRealtimeTool(e.name, args).then((result) => {
                            sendRTEvent({
                                type: "conversation.item.create",
                                item: {
                                    type: "function_call_output",
                                    call_id: e.call_id,
                                    output: result,
                                },
                            });
                            sendRTEvent({ type: "response.create" });
                        });
                    }
                    break;
                }

                case "response.done": {
                    const resp = event as {
                        response?: { status?: string };
                    };
                    if (resp.response?.status === "failed") {
                        console.error("[Grace RT] Response failed:", event);
                    }
                    setStatus("listening");
                    break;
                }

                case "error": {
                    const errEvent = event as { error?: { message?: string } };
                    console.error("[Grace RT] Error:", errEvent.error?.message);
                    setErrorMessage(errEvent.error?.message ?? "Connection error");
                    setStatus("error");
                    setTimeout(() => {
                        setErrorMessage("");
                        setStatus("listening");
                    }, 3000);
                    break;
                }

                default:
                    break;
            }
        },
        [sendRTEvent]
    );

    // ── Start Realtime voice conversation ────────────────────────────────────

    const startConversation = useCallback(async () => {
        try {
            setConversationActive(true);
            setStatus("connecting");
            setErrorMessage("");

            const t0 = performance.now();

            // 1. Fetch Grace's system prompt from Convex
            let instructions: string;
            try {
                instructions = await fetchGraceInstructions();
            } catch (e) {
                console.warn("[Grace RT] Could not load instructions from Convex, using fallback:", e);
                instructions = "";
            }
            console.log(`[Grace RT] Instructions fetched: ${Math.round(performance.now() - t0)}ms (${instructions.length} chars)`);

            // 2. Get ephemeral token (session pre-configured with tools + instructions)
            const { token } = await fetchEphemeralToken(instructions);
            console.log(`[Grace RT] Token acquired: ${Math.round(performance.now() - t0)}ms`);

            // 3. Create WebRTC peer connection
            const pc = new RTCPeerConnection();
            pcRef.current = pc;

            // 4. Set up remote audio (Grace's voice)
            const audioEl = document.createElement("audio");
            audioEl.autoplay = true;
            remoteAudioRef.current = audioEl;

            pc.ontrack = (ev) => {
                audioEl.srcObject = ev.streams[0];
            };

            // 5. Get mic and add local audio track
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            pc.addTrack(stream.getTracks()[0]);

            // 6. Create data channel for events
            const dc = pc.createDataChannel("oai-events");
            dcRef.current = dc;

            dc.onopen = () => {
                console.log(`[Grace RT] Data channel open: ${Math.round(performance.now() - t0)}ms`);
                console.log(`[Grace RT] Instructions length: ${instructions.length} chars`);
            };

            dc.onmessage = (ev) => {
                try {
                    const event = JSON.parse(ev.data);
                    handleRealtimeEvent(event);
                } catch {
                    console.warn("[Grace RT] Unparseable event:", ev.data);
                }
            };

            dc.onclose = () => {
                console.log("[Grace RT] Data channel closed");
            };

            // 7. SDP offer/answer exchange with OpenAI
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const sdpRes = await fetch(
                "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/sdp",
                    },
                    body: offer.sdp,
                }
            );

            if (!sdpRes.ok) {
                throw new Error(`WebRTC SDP exchange failed: ${sdpRes.status}`);
            }

            const answerSdp = await sdpRes.text();
            await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

            console.log(`[Grace RT] Connected: ${Math.round(performance.now() - t0)}ms`);
            setStatus("listening");
        } catch (err) {
            console.error("[Grace RT] Connection failed:", err);
            setConversationActive(false);
            destroyRealtimeSession();
            setErrorMessage(
                err instanceof Error ? err.message : "Failed to start voice conversation"
            );
            setStatus("error");
            setTimeout(() => {
                setErrorMessage("");
                setStatus("idle");
            }, 4000);
        }
    }, [handleRealtimeEvent, destroyRealtimeSession]);

    const endConversation = useCallback(() => {
        setConversationActive(false);
        destroyRealtimeSession();
        setStatus("idle");
    }, [destroyRealtimeSession]);

    // ── Interrupt Grace (barge-in) ───────────────────────────────────────────

    const stopSpeaking = useCallback(() => {
        if (dcRef.current?.readyState === "open") {
            sendRTEvent({ type: "response.cancel" });
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current = null;
        }
        if (status === "speaking") setStatus("listening");
    }, [sendRTEvent, status]);

    const toggleVoice = useCallback(() => {
        setVoiceEnabled((v) => !v);
    }, []);

    // ── Send text message ────────────────────────────────────────────────────
    // If a Realtime session is active, inject text via the data channel.
    // Otherwise, fall back to the Claude pipeline (Convex action).

    const send = useCallback(
        async (text?: string, fromVoice = false) => {
            const msg = (text ?? input).trim();
            if (!msg) return;
            setInput("");

            // ── Route through Realtime session if active ─────────────────────
            if (conversationActive && dcRef.current?.readyState === "open") {
                setMessages((prev) => [
                    ...prev,
                    { role: "user", content: msg, id: `u-${Date.now()}` },
                ]);
                sendRTEvent({
                    type: "conversation.item.create",
                    item: {
                        type: "message",
                        role: "user",
                        content: [{ type: "input_text", text: msg }],
                    },
                });
                sendRTEvent({ type: "response.create" });
                setStatus("thinking");
                return;
            }

            // ── Fall back to Claude pipeline for text-only chat ──────────────
            const userMsg: GraceMessage = { role: "user", content: msg, id: `${Date.now()}` };
            setMessages((prev) => [...prev, userMsg]);
            setStatus("thinking");
            setErrorMessage("");

            try {
                const history: Array<{ role: "user" | "assistant"; content: string }> = [
                    ...messages.map((m) => ({
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
                        setTimeout(
                            () => reject(new Error("Grace took too long to respond. Please try again.")),
                            45000
                        )
                    ),
                ]);
                console.log(`[Grace client] LLM round-trip: ${Math.round(performance.now() - tLlm)}ms`);

                const graceText = stripMarkdown(response);
                setMessages((prev) => [
                    ...prev,
                    { role: "grace", content: graceText, id: `${Date.now() + 1}` },
                ]);
                setStatus("idle");
            } catch (err) {
                const errMsg =
                    err instanceof Error
                        ? err.message
                        : "I had trouble connecting just now. Please try again in a moment.";
                console.error("[Grace] askGrace failed:", err);
                setErrorMessage(errMsg);
                setMessages((prev) => [
                    ...prev,
                    { role: "grace", content: errMsg, id: `${Date.now() + 1}` },
                ]);
                setStatus("error");
                setTimeout(() => {
                    setStatus("idle");
                    setErrorMessage("");
                }, 4000);
            }
        },
        [input, messages, askGrace, conversationActive, sendRTEvent]
    );

    // ── Legacy dictation stubs (kept for interface compatibility) ─────────────
    const startDictation = useCallback(async () => {
        if (!conversationActive) startConversation();
    }, [conversationActive, startConversation]);

    const stopDictation = useCallback(() => {
        // No-op for Realtime sessions — VAD handles turn detection
    }, []);

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            destroyRealtimeSession();
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, [destroyRealtimeSession]);

    return (
        <GraceContext.Provider
            value={{
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
            }}
        >
            {children}
        </GraceContext.Provider>
    );
}
