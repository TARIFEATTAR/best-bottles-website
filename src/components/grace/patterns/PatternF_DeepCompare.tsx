"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ComparisonPayload, ProductCard } from "@/components/GraceContext";
import GraceCtaRow from "@/components/grace/cards/GraceCtaRow";

/**
 * Pattern F — deep spec comparison.
 * Pattern G — true-scale toggle (rendered inside this same card when
 * `payload.dimensions` includes `"trueScale"` or the user toggles it on).
 *
 * Side-by-side spec table. Rows where values differ get a soft Antiqued Gold
 * underline highlight on the differing cells (per PRD).
 */
export interface PatternFDeepCompareProps {
    payload: ComparisonPayload;
    onAddToShortlist?: (p: ProductCard) => void;
}

interface SpecRow {
    key: string;
    accessor: (p: ProductCard & { heightMm?: number | null }) => string;
}

// All spec rows the table can render. Missing values render as "—".
const ROWS: SpecRow[] = [
    { key: "Capacity", accessor: (p) => p.capacity ?? "—" },
    { key: "Color", accessor: (p) => p.color ?? "—" },
    { key: "Applicator", accessor: (p) => p.applicator ?? "—" },
    { key: "Neck thread", accessor: (p) => p.neckThreadSize ?? "—" },
    { key: "Family", accessor: (p) => p.family ?? "—" },
    { key: "Price (1pc)", accessor: (p) => (p.webPrice1pc != null ? `$${p.webPrice1pc.toFixed(2)}` : "—") },
    { key: "Price (12pc)", accessor: (p) => (p.webPrice12pc != null ? `$${p.webPrice12pc.toFixed(2)}` : "—") },
];

export default function PatternF_DeepCompare({ payload, onAddToShortlist }: PatternFDeepCompareProps) {
    const products = payload.products.slice(0, 4);
    const wantsTrueScale = (payload.dimensions ?? []).includes("trueScale");
    const [trueScale, setTrueScale] = useState<boolean>(wantsTrueScale);

    // Per-row diff: highlight cells whose value differs from the others.
    const rowsWithDiff = useMemo(() => {
        return ROWS.map((row) => {
            const vals = products.map((p) => row.accessor(p));
            const allSame = vals.every((v) => v === vals[0]);
            return { ...row, vals, differs: !allSame };
        });
    }, [products]);

    // True-scale: pin tallest bottle to 130px, others scale proportionally.
    const heights = products.map((p) => p.heightMm ?? 100);
    const maxH = Math.max(...heights, 1);
    const scaleFor = (mm: number | null | undefined) => {
        if (!trueScale) return 110;
        return Math.max(40, Math.round((mm ?? 50) * (130 / maxH)));
    };

    return (
        <div
            className="mt-2 rounded-[2px] overflow-hidden"
            style={{
                background: "var(--color-linen)",
                border: "1px solid rgba(212, 197, 169, 0.55)",
            }}
        >
            {/* Header — true-scale toggle */}
            <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.4)" }}
            >
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">
                    Comparing {products.length}
                </div>
                <button
                    type="button"
                    onClick={() => setTrueScale((v) => !v)}
                    aria-pressed={trueScale}
                    className="text-[10px] font-medium tracking-[0.04em] cursor-pointer rounded-[2px] px-2 py-1 transition-colors"
                    style={{
                        color: trueScale ? "var(--color-gold-dim)" : "var(--color-obsidian)",
                        background: trueScale ? "rgba(245, 243, 239, 0.7)" : "transparent",
                        border: trueScale ? "1px solid var(--color-muted-gold)" : "1px solid rgba(99, 117, 136, 0.28)",
                    }}
                >
                    {trueScale ? "True scale" : "Show at true scale"}
                </button>
            </div>

            {/* Thumbnail row */}
            <div
                className="grid items-end gap-2 px-3 py-3"
                style={{
                    gridTemplateColumns: `repeat(${products.length}, minmax(0, 1fr))`,
                    background: "rgba(238, 230, 212, 0.35)",
                    minHeight: 150,
                }}
            >
                {products.map((p, i) => {
                    const h = scaleFor(p.heightMm);
                    const hero = p.heroImageUrl ?? p.paperDollBodyUrl;
                    return (
                        <div key={`${p.graceSku}-${i}`} className="flex flex-col items-center">
                            <div className="relative" style={{ width: 56, height: h }}>
                                {hero ? (
                                    <Image
                                        src={hero}
                                        alt={p.itemName}
                                        fill
                                        className="object-contain"
                                        sizes="56px"
                                        unoptimized
                                    />
                                ) : (
                                    <div
                                        className="w-full h-full flex items-center justify-center"
                                        style={{ background: "var(--color-travertine)", borderRadius: 2 }}
                                    >
                                        <span className="font-cormorant text-[16px]" style={{ color: "rgba(29,29,31,0.3)" }}>
                                            {(p.family ?? "B")[0]}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="font-serif text-[11px] font-medium text-obsidian text-center mt-1.5 leading-tight truncate w-full">
                                {p.itemName}
                            </div>
                            {trueScale && p.heightMm && (
                                <div className="text-[9px] text-slate mt-0.5">{p.heightMm}mm</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Spec table */}
            <div className="px-3 py-2">
                {rowsWithDiff.map((row) => (
                    <div
                        key={row.key}
                        className="grid gap-2 py-1.5"
                        style={{
                            gridTemplateColumns: `90px repeat(${products.length}, minmax(0, 1fr))`,
                            borderTop: "1px solid rgba(212, 197, 169, 0.3)",
                        }}
                    >
                        <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate self-center">
                            {row.key}
                        </div>
                        {row.vals.map((v, i) => (
                            <div
                                key={i}
                                className="text-[11.5px] text-obsidian font-medium leading-tight"
                                style={{
                                    borderBottom: row.differs ? "1.5px solid var(--color-muted-gold)" : "none",
                                    paddingBottom: row.differs ? 1 : 0,
                                }}
                            >
                                {v}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Per-product CTAs */}
            <div
                className="grid gap-2 px-3 py-2.5"
                style={{
                    gridTemplateColumns: `repeat(${products.length}, minmax(0, 1fr))`,
                    borderTop: "1px solid rgba(212, 197, 169, 0.4)",
                    background: "rgba(238, 230, 212, 0.2)",
                }}
            >
                {products.map((p) => (
                    <GraceCtaRow
                        key={p.graceSku}
                        product={p}
                        onAddToShortlist={onAddToShortlist}
                        showPrice={false}
                        compact
                    />
                ))}
            </div>
        </div>
    );
}
