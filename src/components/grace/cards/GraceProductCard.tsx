"use client";

import Image from "next/image";
import Link from "next/link";
import type { ProductCard } from "@/components/GraceContext";
import GraceCtaRow from "./GraceCtaRow";

/**
 * Base inline product card used by Patterns A, B (variant subview), J, L.
 *
 * Three modes:
 *  - "single"          — full card with image, name, key spec line, CTA row.
 *  - "shortlist-tile"  — compact tile for shortlist preview strips (just image + name).
 *  - "discovery"       — wider card used in catalog-discovery family strip (Pattern L).
 *
 * All variants render with 2px radius, hairline champagne borders, no `#FFFFFF`
 * (uses linen / bone) per the PRD constraint.
 */
export interface GraceProductCardProps {
    product: ProductCard & { heroImageUrl?: string | null };
    mode?: "single" | "shortlist-tile" | "discovery";
    onAddToShortlist?: (p: ProductCard) => void;
    /** When set, wraps the card image+name in a Link to the PDP. */
    linkToPdp?: boolean;
    tierLabel?: string | null;
}

function specLine(p: ProductCard): string {
    const bits: string[] = [];
    if (p.graceSku) bits.push(p.graceSku);
    if (p.capacity) bits.push(p.capacity);
    if (p.neckThreadSize) bits.push(p.neckThreadSize);
    return bits.join(" · ");
}

function FallbackThumb({ family }: { family?: string }) {
    return (
        <div
            className="flex flex-col items-center justify-center text-center w-full h-full"
            style={{ background: "var(--color-travertine)" }}
        >
            <span
                className="font-cormorant font-semibold"
                style={{ color: "rgba(29, 29, 31, 0.32)", fontSize: 28, lineHeight: 1 }}
            >
                {(family ?? "BB")[0]}
            </span>
            <span className="text-[8px] uppercase tracking-[0.18em] text-slate/60 mt-1.5">
                {family ?? ""}
            </span>
        </div>
    );
}

export default function GraceProductCard({
    product,
    mode = "single",
    onAddToShortlist,
    linkToPdp = true,
    tierLabel,
}: GraceProductCardProps) {
    const hero = product.heroImageUrl;
    const pdpHref = product.slug ? `/products/${product.slug}` : null;

    if (mode === "shortlist-tile") {
        return (
            <div
                className="rounded-[2px] overflow-hidden flex flex-col"
                style={{
                    background: "var(--color-linen)",
                    border: "1px solid rgba(212, 197, 169, 0.5)",
                }}
            >
                <div className="relative aspect-[4/5] w-full bg-travertine">
                    {hero ? (
                        <Image src={hero} alt={product.itemName} fill className="object-cover" sizes="120px" unoptimized />
                    ) : (
                        <FallbackThumb family={product.family} />
                    )}
                </div>
                <div className="px-2 py-1.5">
                    <div className="font-serif text-[11px] font-medium leading-tight truncate">
                        {product.itemName}
                    </div>
                    {product.capacity && (
                        <div className="text-[9px] text-slate uppercase tracking-wider mt-0.5">
                            {product.capacity}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (mode === "discovery") {
        return (
            <Link
                href={pdpHref ?? "#"}
                className="rounded-[2px] overflow-hidden flex flex-col cursor-pointer transition-colors group"
                style={{
                    background: "var(--color-linen)",
                    border: "1px solid rgba(212, 197, 169, 0.55)",
                    minWidth: 140,
                }}
            >
                <div className="relative aspect-[4/5] w-full bg-travertine">
                    {hero ? (
                        <Image src={hero} alt={product.itemName} fill className="object-cover" sizes="160px" unoptimized />
                    ) : (
                        <FallbackThumb family={product.family} />
                    )}
                </div>
                <div className="px-2.5 py-2">
                    <div className="font-serif text-[12.5px] font-medium tracking-[0.01em] leading-tight truncate group-hover:text-gold-dim transition-colors">
                        {product.itemName}
                    </div>
                    <div className="text-[9px] text-slate uppercase tracking-wider mt-0.5">
                        {product.family ?? ""}
                    </div>
                </div>
            </Link>
        );
    }

    // mode === "single"
    return (
        <div
            className="rounded-[2px] overflow-hidden"
            style={{
                background: "var(--color-linen)",
                border: "1px solid rgba(212, 197, 169, 0.55)",
            }}
        >
            <div className="flex gap-3 p-2.5">
                {pdpHref ? (
                    <Link
                        href={pdpHref}
                        className="relative shrink-0 rounded-[2px] overflow-hidden bg-travertine cursor-pointer"
                        style={{ width: 84, height: 105 }}
                        title="Open product page"
                    >
                        {hero ? (
                            <Image src={hero} alt={product.itemName} fill className="object-cover" sizes="84px" unoptimized />
                        ) : (
                            <FallbackThumb family={product.family} />
                        )}
                    </Link>
                ) : (
                    <div className="relative shrink-0 rounded-[2px] overflow-hidden bg-travertine" style={{ width: 84, height: 105 }}>
                        {hero ? (
                            <Image src={hero} alt={product.itemName} fill className="object-cover" sizes="84px" unoptimized />
                        ) : (
                            <FallbackThumb family={product.family} />
                        )}
                    </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                    {linkToPdp && pdpHref ? (
                        <Link
                            href={pdpHref}
                            className="font-serif text-[15px] font-medium text-obsidian tracking-[0.01em] leading-tight hover:text-gold-dim transition-colors"
                        >
                            {product.itemName}
                        </Link>
                    ) : (
                        <div className="font-serif text-[15px] font-medium text-obsidian tracking-[0.01em] leading-tight">
                            {product.itemName}
                        </div>
                    )}
                    <div className="text-[10px] text-slate uppercase tracking-wider mt-1">
                        {specLine(product)}
                    </div>
                    {product.applicator && (
                        <div className="text-[10.5px] text-slate mt-1 leading-tight">
                            {product.applicator}
                        </div>
                    )}
                    <span className="flex-1" />
                    <GraceCtaRow
                        product={product}
                        tierLabel={tierLabel ?? null}
                        onAddToShortlist={onAddToShortlist}
                        compact
                    />
                </div>
            </div>
        </div>
    );
}
