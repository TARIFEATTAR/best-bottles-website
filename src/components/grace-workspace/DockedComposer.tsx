"use client";

import { useEffect, useRef } from "react";
import { useGraceImageUpload } from "@/lib/useGraceImageUpload";
import VoiceWaveGlyph from "./VoiceWaveGlyph";
import { PaperPlaneTilt, Paperclip } from "./icons";

interface DockedComposerProps {
    input: string;
    onInputChange: (v: string) => void;
    onSubmit: (text?: string) => void;
    onToggleVoice: () => void;
    voiceEnabled: boolean;
    placeholder?: string;
    autoFocus?: boolean;
}

export default function DockedComposer({
    input,
    onInputChange,
    onSubmit,
    onToggleVoice,
    voiceEnabled,
    placeholder,
    autoFocus,
}: DockedComposerProps) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const { uploadAndAnalyze, status } = useGraceImageUpload();
    const isUploading = status === "uploading" || status === "analyzing" || status === "searching";

    useEffect(() => {
        if (autoFocus) {
            const t = setTimeout(() => ref.current?.focus(), 50);
            return () => clearTimeout(t);
        }
    }, [autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (input.trim()) onSubmit();
        }
    };

    const handleAttachClick = () => fileRef.current?.click();
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        await uploadAndAnalyze(file, { userText: input.trim() || undefined });
        onInputChange("");
    };

    const placeholderText = placeholder ?? (
        isUploading
            ? status === "uploading" ? "Uploading reference…"
            : status === "analyzing" ? "Looking at your reference…"
            : "Finding matches…"
        : voiceEnabled ? "Listening…" : "Reply to Grace"
    );

    return (
        <div
            className="shrink-0 bg-bone px-6 py-3.5 pb-5"
            style={{ borderTop: "1px solid rgba(212, 197, 169, 0.5)" }}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim()) onSubmit();
                }}
                className="mx-auto flex max-w-[880px] items-center gap-3 rounded-[3px] px-4 py-3"
                style={{
                    background: "rgba(255, 255, 255, 0.7)",
                    border: voiceEnabled
                        ? "1px solid var(--color-muted-gold)"
                        : "1px solid rgba(212, 197, 169, 0.7)",
                }}
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                />
                <button
                    type="button"
                    aria-label="Attach reference image"
                    onClick={handleAttachClick}
                    disabled={isUploading}
                    className="flex cursor-pointer border-none bg-transparent p-0 text-slate hover:text-obsidian transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                    <Paperclip size={15} />
                </button>
                <textarea
                    ref={ref}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholderText}
                    rows={1}
                    className="w-full min-w-0 flex-1 resize-none border-none bg-transparent text-[14px] text-obsidian outline-none placeholder:text-slate/70"
                    style={{ minHeight: 22, fontFamily: "var(--font-sans)" }}
                />
                <button
                    type="button"
                    onClick={onToggleVoice}
                    aria-pressed={voiceEnabled}
                    aria-label={voiceEnabled ? "End voice conversation with Grace" : "Talk with Grace"}
                    title={voiceEnabled ? "End voice conversation" : "Talk with Grace"}
                    className="flex cursor-pointer items-center justify-center rounded-[2px] px-2 py-1.5 transition-colors"
                    style={{
                        border: voiceEnabled ? "none" : "1px solid rgba(99, 117, 136, 0.32)",
                        background: voiceEnabled ? "var(--color-muted-gold)" : "transparent",
                        color: voiceEnabled ? "var(--color-obsidian)" : "var(--color-obsidian)",
                    }}
                >
                    <VoiceWaveGlyph size={18} active={voiceEnabled} />
                </button>
                <button
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Send"
                    className="flex cursor-pointer items-center justify-center rounded-[2px] border-none bg-obsidian p-1.5 text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-black transition-colors"
                >
                    <PaperPlaneTilt size={15} />
                </button>
            </form>
        </div>
    );
}
