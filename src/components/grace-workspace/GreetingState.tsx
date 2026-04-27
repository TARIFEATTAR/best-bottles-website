"use client";

import { useRef } from "react";
import { useGraceImageUpload } from "@/lib/useGraceImageUpload";
import VoiceWaveGlyph from "./VoiceWaveGlyph";
import {
    ArrowsLeftRight,
    PaperPlaneTilt,
    Paperclip,
    Plus,
    Ruler,
    Star,
} from "./icons";

interface SkillChip {
    label: string;
    icon: React.ComponentType<{ size?: number; weight?: "regular" | "bold"; className?: string }>;
    query: string;
}

const SKILLS: SkillChip[] = [
    {
        label: "Browse families",
        icon: Plus,
        query: "Show me your bottle families. I'd like to browse what's available.",
    },
    {
        label: "Find by fitment",
        icon: Ruler,
        query: "Help me find a bottle by fitment — I know the neck thread size I need.",
    },
    {
        label: "Match a reference",
        icon: Paperclip,
        query: "I have a reference image — help me find a bottle that matches.",
    },
    {
        label: "Compare",
        icon: ArrowsLeftRight,
        query: "I want to compare a few bottles side by side.",
    },
];

interface GreetingStateProps {
    name: string;
    input: string;
    onInputChange: (v: string) => void;
    onSubmit: (text?: string) => void;
    onSkillClick: (query: string) => void;
    onToggleVoice: () => void;
    voiceEnabled: boolean;
}

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 5) return "Late night";
    if (h < 12) return "Morning";
    if (h < 17) return "Afternoon";
    if (h < 21) return "Evening";
    return "Evening";
}

export default function GreetingState({
    name,
    input,
    onInputChange,
    onSubmit,
    onSkillClick,
    onToggleVoice,
    voiceEnabled,
}: GreetingStateProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const { uploadAndAnalyze, status } = useGraceImageUpload();

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (input.trim()) onSubmit();
        }
    };

    const handleAttachClick = () => {
        fileRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset the input so re-selecting the same file fires onChange again.
        e.target.value = "";
        await uploadAndAnalyze(file, { userText: input.trim() || undefined });
        onInputChange("");
    };

    const isUploading = status === "uploading" || status === "analyzing" || status === "searching";

    return (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
            <div className="w-full max-w-[720px]">
                {/* Greeting */}
                <div className="mb-[30px] flex items-center justify-center gap-4">
                    <Star size={34} weight="fill" className="text-muted-gold" />
                    <h1 className="font-serif text-[42px] font-medium tracking-[0.02em] text-obsidian">
                        {getGreeting()}, {name}.
                    </h1>
                </div>

                {/* Composer */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (input.trim()) onSubmit();
                    }}
                    className="rounded-[3px]"
                    style={{
                        background: "rgba(255, 255, 255, 0.7)",
                        border: "1px solid rgba(212, 197, 169, 0.7)",
                        boxShadow: "0 12px 32px rgba(29, 29, 31, 0.06)",
                        padding: "18px 20px 14px",
                    }}
                >
                    <textarea
                        value={input}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Tell me what you're packaging — or pick a thread to pull"
                        rows={1}
                        autoFocus
                        className="w-full resize-none border-none bg-transparent text-[14.5px] text-obsidian outline-none placeholder:text-slate/70"
                        style={{ minHeight: 26, fontFamily: "var(--font-sans)" }}
                    />
                    <div
                        className="mt-3.5 flex items-center gap-2.5 pt-3"
                        style={{ borderTop: "1px solid rgba(212, 197, 169, 0.4)" }}
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
                        <span className="text-[11px] tracking-[0.04em] text-slate">
                            {isUploading
                                ? status === "uploading" ? "Uploading…"
                                : status === "analyzing" ? "Looking at your reference…"
                                : status === "searching" ? "Finding matches…"
                                : "Working…"
                                : "Attach an image, paste a SKU, or describe what you’re packaging"}
                        </span>
                        <span className="flex-1" />
                        <button
                            type="button"
                            onClick={onToggleVoice}
                            aria-pressed={voiceEnabled}
                            aria-label={voiceEnabled ? "End voice conversation with Grace" : "Talk with Grace"}
                            title={voiceEnabled ? "End voice conversation" : "Talk with Grace"}
                            className="flex cursor-pointer items-center justify-center rounded-[2px] px-2 py-1.5 transition-colors"
                            style={{
                                border: voiceEnabled
                                    ? "1px solid var(--color-muted-gold)"
                                    : "1px solid rgba(99, 117, 136, 0.32)",
                                background: voiceEnabled ? "rgba(197, 160, 101, 0.10)" : "transparent",
                                color: voiceEnabled ? "var(--color-gold-dim)" : "var(--color-obsidian)",
                            }}
                        >
                            <VoiceWaveGlyph size={18} active={voiceEnabled} />
                        </button>
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            aria-label="Send"
                            className="flex cursor-pointer items-center justify-center rounded-[2px] border-none bg-obsidian p-1.5 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black transition-colors"
                        >
                            <PaperPlaneTilt size={15} />
                        </button>
                    </div>
                </form>

                {/* Skill chips */}
                <div className="mt-[18px] flex flex-wrap justify-center gap-2.5">
                    {SKILLS.map((s) => (
                        <button
                            key={s.label}
                            type="button"
                            onClick={() => onSkillClick(s.query)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[2px] bg-transparent px-3 py-[7px] text-[11.5px] font-medium tracking-[0.04em] text-obsidian hover:bg-obsidian/[0.03] transition-colors"
                            style={{ border: "1px solid rgba(99, 117, 136, 0.28)" }}
                        >
                            <span className="flex text-gold-dim">
                                <s.icon size={11} weight="bold" />
                            </span>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Footer note */}
                <div className="mt-3.5 text-center text-[11px] tracking-[0.04em] text-slate">
                    A division of Nemat International · 2,300 SKUs · 37 families · Made in USA
                </div>
            </div>
        </div>
    );
}
