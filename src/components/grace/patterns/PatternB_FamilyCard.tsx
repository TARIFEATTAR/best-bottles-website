"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { FamilyCardPayload, ProductCard } from "@/components/GraceContext";
import GraceVariantPills from "@/components/grace/cards/GraceVariantPills";
import GraceSpecBlock from "@/components/grace/cards/GraceSpecBlock";
import GraceCtaRow from "@/components/grace/cards/GraceCtaRow";

/**
 * Pattern B — family card with variant selector.
 *
 * Hero thumbnail + family name + variant pill row (capacities). Selected
 * variant updates the spec block and the CTA row's product target. Footer
 * action "+ Add all sizes" lets buyers grab a sample set in one click.
 */
export interface PatternBFamilyCardProps {
    payload: FamilyCardPayload;
    onAddToShortlist?: (p: ProductCard) => void;
    onAddAllSizes?: (variants: ProductCard[]) => void;
    tierLabel?: string | null;
}

export default function PatternB_FamilyCard({
    payload,
    onAddToShortlist,
    onAddAllSizes,
    tierLabel,
}: PatternBFamilyCardProps) {
    const variants = payload.variants;
    const initialSku =
        payload.defaultGraceSku
        ?? variants[0]?.graceSku
        ?? "";

    const [selected, setSelected] = useState<string>(initialSku);
    useEffect(() => { setSelected(initialSku); }, [initialSku]);

    const active = useMemo(
        () => variants.find((v) => v.graceSku === selected) ?? variants[0],
        [variants, selected]
    );

    if (!active) return null;

    const hero = active.heroImageUrl ?? payload.heroImageUrl ?? null;

    const variantOptions = variants
        .filter((v) => v.capacity || v.capacityMl != null)
        .map((v) => ({
            value: v.graceSku,
            label: v.capacity ?? `${v.capacityMl}ml`,
        }));

    const specRows = [
        { key: "Capacity", value: active.capacity ?? "—" },
        { key: "Color", value: active.color ?? "—" },
        { key: "Neck", value: active.neckThreadSize ?? "—" },
        { key: "Applicator", value: active.applicator ?? "—" },
    ];

    return (
        <div
            className="mt-2 rounded-[2px] overflow-hidden"
            style={{
                background: "var(--color-linen)",
                border: "1px solid rgba(212, 197, 169, 0.55)",
            }}
        >
            <div className="flex gap-3 p-3">
                <div
                    className="relative shrink-0 rounded-[2px] overflow-hidden bg-travertine"
                    style={{ width: 96, height: 120 }}
                >
                    {hero ? (
                        <Image
                            src={hero}
                            alt={payload.family}
                            fill
                            className="object-cover"
                            sizes="96px"
                            unoptimized
                        />
                    ) : (
                        <div
                            className="w-full h-full flex items-center justify-center font-cormorant"
                            style={{ color: "rgba(29, 29, 31, 0.3)", fontSize: 32 }}
                        >
                            {payload.family[0]}
                        </div>
                    )}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate">
                        Family · {payload.threadSizes?.[0] ?? ""}
                    </div>
                    <div className="font-serif text-[18px] font-medium text-obsidian tracking-[0.01em] leading-tight mt-0.5">
                        {payload.family}
                    </div>
                    {payload.tagline && (
                        <div className="text-[11px] text-slate mt-1 leading-snug">
                            {payload.tagline}
                        </div>
                    )}
                </div>
            </div>

            <div className="px-3 pb-2.5">
                <GraceVariantPills
                    options={variantOptions}
                    value={selected}
                    onChange={setSelected}
                    size="sm"
                    label="Capacity"
                />
            </div>

            <div className="px-3 pb-3">
                <GraceSpecBlock rows={specRows} columns={2} />
            </div>

            <div
                className="px-3 py-2.5 flex items-center"
                style={{
                    borderTop: "1px solid rgba(212, 197, 169, 0.4)",
                    background: "rgba(238, 230, 212, 0.2)",
                }}
            >
                <GraceCtaRow
                    product={active}
                    onAddToShortlist={onAddToShortlist}
                    tierLabel={tierLabel ?? null}
                    compact
                />
            </div>

            {onAddAllSizes && variants.length > 1 && (
                <button
                    type="button"
                    onClick={() => onAddAllSizes(variants)}
                    className="block w-full text-center py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate hover:text-obsidian cursor-pointer transition-colors"
                    style={{ borderTop: "1px solid rgba(212, 197, 169, 0.3)" }}
                >
                    + Add all {variants.length} sizes
                </button>
            )}
        </div>
    );
}
