"use client";

import GraceProductCard from "@/components/grace/cards/GraceProductCard";
import type { ProductCard } from "@/components/GraceContext";

/**
 * Pattern A — single SKU inline card.
 * Used when Grace surfaces one specific product the customer asked for.
 */
export interface PatternASingleSkuProps {
    product: ProductCard & { heroImageUrl?: string | null };
    onAddToShortlist?: (p: ProductCard) => void;
    tierLabel?: string | null;
}

export default function PatternA_SingleSku({ product, onAddToShortlist, tierLabel }: PatternASingleSkuProps) {
    return (
        <div className="mt-2">
            <GraceProductCard
                product={product}
                mode="single"
                onAddToShortlist={onAddToShortlist}
                tierLabel={tierLabel}
            />
        </div>
    );
}
