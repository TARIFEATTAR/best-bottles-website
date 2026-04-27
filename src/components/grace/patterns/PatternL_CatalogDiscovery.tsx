"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { CatalogStripPayload } from "@/components/GraceContext";

/**
 * Pattern L — catalog discovery strip.
 *
 * Triggered when the customer asks broadly ("what do you carry") or in the
 * empty state of an authenticated returning user. Renders a horizontally
 * scrollable strip of family tiles with category-chip filtering on top.
 *
 * Click a tile to open its PDP (PRD says "expand into a Pattern B family
 * card in the next message" — that's a v2 concern; for now PDP nav is the
 * fastest path).
 */
export interface PatternLCatalogDiscoveryProps {
    payload: CatalogStripPayload;
}

export default function PatternL_CatalogDiscovery({ payload }: PatternLCatalogDiscoveryProps) {
    const [active, setActive] = useState<string | null>(payload.activeCategory ?? null);
    const filtered = active
        ? payload.families.filter((f) => f.family.toLowerCase().includes(active.toLowerCase()))
        : payload.families;

    return (
        <div className="mt-2">
            {/* Category chips — small contextual filter row */}
            {payload.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {payload.categories.map((cat) => {
                        const sel = active === cat;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setActive(sel ? null : cat)}
                                aria-pressed={sel}
                                className="rounded-[2px] cursor-pointer transition-colors"
                                style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    letterSpacing: "0.04em",
                                    padding: "5px 9px",
                                    background: sel ? "rgba(245, 243, 239, 0.7)" : "transparent",
                                    border: sel ? "1.5px solid var(--color-muted-gold)" : "1px solid rgba(99, 117, 136, 0.28)",
                                    color: sel ? "var(--color-gold-dim)" : "var(--color-obsidian)",
                                }}
                            >
                                {cat}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Horizontal scroll strip of family tiles */}
            <div
                className="overflow-x-auto -mx-1 px-1 py-1"
                style={{ scrollbarWidth: "thin" }}
            >
                <div className="flex gap-2" style={{ minWidth: "min-content" }}>
                    {filtered.map((f) => (
                        <Link
                            key={f.family}
                            href={`/catalog?family=${encodeURIComponent(f.family)}`}
                            className="rounded-[2px] overflow-hidden flex flex-col cursor-pointer group shrink-0 transition-colors"
                            style={{
                                width: 140,
                                background: "var(--color-linen)",
                                border: "1px solid rgba(212, 197, 169, 0.55)",
                            }}
                        >
                            <div className="relative aspect-[4/5] w-full bg-travertine">
                                {f.heroImageUrl ? (
                                    <Image
                                        src={f.heroImageUrl}
                                        alt={f.family}
                                        fill
                                        className="object-cover"
                                        sizes="140px"
                                        unoptimized
                                    />
                                ) : (
                                    <div
                                        className="flex items-center justify-center w-full h-full font-cormorant"
                                        style={{ color: "rgba(29, 29, 31, 0.32)", fontSize: 38 }}
                                    >
                                        {f.family[0]}
                                    </div>
                                )}
                            </div>
                            <div className="px-2 py-1.5">
                                <div className="font-serif text-[12.5px] font-medium tracking-[0.01em] text-obsidian leading-tight truncate group-hover:text-gold-dim transition-colors">
                                    {f.family}
                                </div>
                                <div className="text-[9px] text-slate uppercase tracking-wider mt-0.5">
                                    {f.variantCount} variant{f.variantCount === 1 ? "" : "s"}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
