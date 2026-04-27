"use client";

import Image from "next/image";
import { Check } from "@phosphor-icons/react";
import type { CompatibilityPayload, ProductCard } from "@/components/GraceContext";
import GraceCtaRow from "@/components/grace/cards/GraceCtaRow";

/**
 * Pattern C — components compatibility tray.
 *
 * Below a bottle reference, surfaces fitment-verified caps / sprayers /
 * droppers / atomizers in a horizontally scrolling row. Each card carries
 * a gold ✓ "Fits {bottleName}" badge — only when the component truly shares
 * the bottle's neck thread.
 */
export interface PatternCComponentsTrayProps {
    payload: CompatibilityPayload;
    onAddToShortlist?: (p: ProductCard) => void;
}

export default function PatternC_ComponentsTray({ payload, onAddToShortlist }: PatternCComponentsTrayProps) {
    const { bottle, threadSize, components } = payload;
    if (!components.length) return null;

    return (
        <div className="mt-2">
            <div className="flex items-baseline justify-between mb-1.5">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate">
                    Pairs with · {bottle.itemName}
                </div>
                <div className="text-[9.5px] text-slate tracking-wider">
                    {threadSize} thread
                </div>
            </div>

            <div className="overflow-x-auto -mx-1 px-1 py-1" style={{ scrollbarWidth: "thin" }}>
                <div className="flex gap-2" style={{ minWidth: "min-content" }}>
                    {components.map((c) => {
                        const hero = c.heroImageUrl;
                        return (
                            <div
                                key={c.graceSku}
                                className="rounded-[2px] overflow-hidden flex flex-col shrink-0"
                                style={{
                                    width: 165,
                                    background: "var(--color-linen)",
                                    border: "1px solid rgba(212, 197, 169, 0.55)",
                                }}
                            >
                                <div className="relative w-full aspect-square bg-travertine">
                                    {hero ? (
                                        <Image
                                            src={hero}
                                            alt={c.itemName}
                                            fill
                                            className="object-contain p-2"
                                            sizes="165px"
                                            unoptimized
                                        />
                                    ) : (
                                        <div
                                            className="w-full h-full flex items-center justify-center font-cormorant"
                                            style={{ color: "rgba(29, 29, 31, 0.3)", fontSize: 26 }}
                                        >
                                            {c.componentType?.[0] ?? "C"}
                                        </div>
                                    )}
                                </div>
                                <div className="px-2 py-1.5 flex flex-col gap-0.5">
                                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate">
                                        {c.componentType ?? c.applicator ?? "Component"}
                                    </div>
                                    <div className="font-serif text-[12px] font-medium text-obsidian leading-tight truncate">
                                        {c.itemName}
                                    </div>
                                    {c.fitmentVerified !== false && (
                                        <div
                                            className="flex items-center gap-1 mt-0.5 text-[9px] font-semibold tracking-wider"
                                            style={{ color: "var(--color-gold-dim)" }}
                                        >
                                            <Check size={10} weight="bold" className="text-muted-gold" />
                                            Fits {bottle.itemName.split(" ")[0]}
                                        </div>
                                    )}
                                    <div className="mt-1.5">
                                        <GraceCtaRow
                                            product={c}
                                            onAddToShortlist={onAddToShortlist}
                                            compact
                                            showPrice={true}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
