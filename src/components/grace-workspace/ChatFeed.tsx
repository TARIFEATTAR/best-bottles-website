"use client";

import { useEffect, useRef } from "react";
import GraceChatMessage, {
    StreamingMessage,
    ThinkingIndicator,
} from "@/components/grace/GraceChatMessage";
import type { GraceMessage } from "@/components/GraceContext";

interface ChatFeedProps {
    messages: GraceMessage[];
    streamingText: string;
    isAwaitingReply: boolean;
    errorMessage: string;
}

export default function ChatFeed({
    messages,
    streamingText,
    isAwaitingReply,
    errorMessage,
}: ChatFeedProps) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingText, isAwaitingReply]);

    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-[760px]">
                {messages.map((m) => (
                    <GraceChatMessage key={m.id} message={m} />
                ))}

                <StreamingMessage text={streamingText} />

                {isAwaitingReply && !streamingText && <ThinkingIndicator />}

                {errorMessage && (
                    <div className="mt-4 rounded-lg border border-red-100/50 bg-red-50 p-3">
                        <p className="text-center text-[12px] leading-relaxed text-red-600 font-sans">
                            {errorMessage}
                        </p>
                    </div>
                )}

                <div ref={endRef} />
            </div>
        </div>
    );
}
