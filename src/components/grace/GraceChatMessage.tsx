"use client";

import type { GraceMessage } from "@/components/GraceContext";

interface GraceChatMessageProps {
    message: GraceMessage;
}

export default function GraceChatMessage({ message }: GraceChatMessageProps) {
    const isUser = message.role === "user";

    if (isUser) {
        return (
            <div className="flex justify-end mb-3">
                <div className="max-w-[80%] px-3.5 py-2.5 text-[14px] leading-relaxed text-obsidian bg-obsidian/[0.05] rounded-2xl rounded-br-sm">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mb-4">
            <p className="text-[14.5px] leading-[1.65] text-obsidian/85 whitespace-pre-wrap font-sans">
                {message.content}
            </p>
        </div>
    );
}

interface StreamingMessageProps {
    text: string;
}

export function StreamingMessage({ text }: StreamingMessageProps) {
    if (!text) return null;

    return (
        <div className="mb-4">
            <p className="text-[14.5px] leading-[1.65] text-obsidian/85 whitespace-pre-wrap font-sans">
                {text}
                <span className="inline-block w-[3px] h-[16px] bg-obsidian/30 ml-0.5 animate-pulse rounded-[1px] align-text-bottom" />
            </p>
        </div>
    );
}
