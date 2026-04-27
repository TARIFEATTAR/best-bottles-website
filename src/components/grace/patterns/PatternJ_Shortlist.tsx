"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import type { ShortlistPayload } from "@/components/GraceContext";
import GraceProductCard from "@/components/grace/cards/GraceProductCard";

/**
 * Pattern J — shortlist build + share artifact.
 *
 * Renders up to 4 mini product tiles + the share URL in monospace + copy
 * affordance. Items with shareUrl get an "expires in N days" caption.
 */
export interface PatternJShortlistProps {
    payload: ShortlistPayload;
    onOpenShortlistPage?: () => void;
}

export default function PatternJ_Shortlist({ payload, onOpenShortlistPage }: PatternJShortlistProps) {
    const [copied, setCopied] = useState(false);
    const items = payload.items.slice(0, 4);

    const handleCopy = async () => {
        if (!payload.shareUrl) return;
        try {
            await navigator.clipboard.writeText(payload.shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };

    const expiryText = payload.expiresAt
        ? (() => {
            const days = Math.max(0, Math.round((payload.expiresAt - Date.now()) / 86400000));
            return `expires in ${days} day${days === 1 ? "" : "s"}`;
        })()
        : null;

    return (
        <div
            className="mt-2 rounded-[2px] overflow-hidden"
            style={{
                background: "var(--color-linen)",
                border: "1px solid rgba(212, 197, 169, 0.55)",
            }}
        >
            <div
                className="px-3 py-2"
                style={{
                    background: "rgba(238, 230, 212, 0.4)",
                    borderBottom: "1px solid rgba(212, 197, 169, 0.4)",
                }}
            >
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate">
                    Shortlist · {payload.items.length} bottle{payload.items.length === 1 ? "" : "s"}
                </div>
            </div>

            {/* Tile preview */}
            <div className="px-3 pt-3 pb-2">
                <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
                >
                    {items.map((p) => (
                        <GraceProductCard
                            key={p.graceSku}
                            product={p}
                            mode="shortlist-tile"
                        />
                    ))}
                </div>
            </div>

            {/* Share URL */}
            {payload.shareUrl && (
                <div
                    className="mx-3 my-2 px-2.5 py-2 rounded-[2px] flex items-center gap-2"
                    style={{
                        background: "rgba(238, 230, 212, 0.3)",
                        border: "1px solid rgba(212, 197, 169, 0.4)",
                    }}
                >
                    <code
                        className="flex-1 text-[10.5px] truncate"
                        style={{
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            color: "var(--color-obsidian)",
                        }}
                    >
                        {payload.shareUrl}
                    </code>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate hover:text-obsidian cursor-pointer"
                    >
                        {copied ? (
                            <>
                                <Check size={10} weight="bold" className="text-muted-gold" /> Copied
                            </>
                        ) : (
                            <>
                                <Copy size={10} weight="regular" /> Copy
                            </>
                        )}
                    </button>
                </div>
            )}

            <div className="px-3 pb-3 flex items-center justify-between">
                <div className="text-[10px] text-slate italic">
                    {expiryText ? `Shortlist · view-only · ${expiryText}` : "Shortlist · view-only"}
                </div>
                {onOpenShortlistPage && (
                    <button
                        type="button"
                        onClick={onOpenShortlistPage}
                        className="text-[10.5px] font-medium tracking-[0.04em] text-slate hover:text-obsidian cursor-pointer pb-0.5"
                        style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.6)" }}
                    >
                        Open page →
                    </button>
                )}
            </div>
        </div>
    );
}
