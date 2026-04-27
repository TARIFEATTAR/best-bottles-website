"use client";

import { X, FileText, ImageSquare } from "@phosphor-icons/react";
import type { GraceAttachment } from "@/components/GraceContext";

/**
 * File-attached state (PRD state 17). Renders a row of file chips above the
 * composer for any pending attachments — e.g. the user uploaded a reference
 * image (Pattern H) or brand logo (Pattern I) before pressing send.
 *
 * Each chip shows: type icon (image vs document) + truncated filename + ×
 * to remove. Persists until the message is sent or the user removes them.
 */
export interface GraceFileChipsProps {
    attachments: GraceAttachment[];
    onRemove: (id: string) => void;
}

function isImage(mime: string) {
    return mime.startsWith("image/");
}

function truncate(s: string, max = 22): string {
    if (s.length <= max) return s;
    const ext = s.includes(".") ? s.slice(s.lastIndexOf(".")) : "";
    return `${s.slice(0, max - ext.length - 1)}…${ext}`;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function GraceFileChips({ attachments, onRemove }: GraceFileChipsProps) {
    if (attachments.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1.5 px-4 pb-1.5">
            {attachments.map((a) => {
                const Icon = isImage(a.mime) ? ImageSquare : FileText;
                return (
                    <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-[2px] pl-2 pr-1 py-1"
                        style={{
                            background: "rgba(238, 230, 212, 0.4)",
                            border: "1px solid rgba(212, 197, 169, 0.5)",
                        }}
                    >
                        <Icon size={12} className="text-slate shrink-0" weight="regular" />
                        <span className="text-[11px] text-obsidian font-medium">{truncate(a.name)}</span>
                        <span className="text-[9.5px] text-slate uppercase tracking-wider">{formatSize(a.size)}</span>
                        <button
                            type="button"
                            onClick={() => onRemove(a.id)}
                            aria-label={`Remove ${a.name}`}
                            className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-obsidian/[0.06] cursor-pointer text-slate hover:text-obsidian transition-colors"
                        >
                            <X size={10} weight="bold" />
                        </button>
                    </span>
                );
            })}
        </div>
    );
}
