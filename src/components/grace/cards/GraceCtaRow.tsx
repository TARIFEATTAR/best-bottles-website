"use client";

import type { ProductCard } from "@/components/GraceContext";
import { useCart } from "@/components/CartProvider";

/**
 * The shared "Add to cart" + "+ shortlist" action row used by every product
 * surface (Patterns A, B, C, D, J, L). Add to cart is primary (gold underline
 * accent on hover), + shortlist is secondary ghost.
 *
 * Tier pricing badge surfaces only when the user is authenticated and a tier
 * is supplied via `tierLabel`. Anonymous users see a plain price, no badge.
 */
export interface GraceCtaRowProps {
    product: ProductCard;
    tierLabel?: string | null;
    /** Optional override for the cart hook (used in storybook / tests). */
    onAddToCart?: () => void;
    onAddToShortlist?: (product: ProductCard) => void;
    /** When false, hides the price text (useful when surrounding component already shows price prominently). */
    showPrice?: boolean;
    compact?: boolean;
}

export default function GraceCtaRow({
    product,
    tierLabel,
    onAddToCart,
    onAddToShortlist,
    showPrice = true,
    compact = false,
}: GraceCtaRowProps) {
    const { addItems } = useCart();

    const handleAdd = () => {
        if (onAddToCart) {
            onAddToCart();
            return;
        }
        addItems([
            {
                graceSku: product.graceSku,
                itemName: product.itemName,
                quantity: 1,
                unitPrice: product.webPrice1pc ?? null,
            },
        ]);
    };

    const price = product.webPrice1pc;

    return (
        <div className={`flex items-center gap-2 ${compact ? "" : "mt-2.5"}`}>
            {showPrice && price != null && (
                <div className="flex items-baseline gap-1.5">
                    <span className="font-serif text-[15px] font-medium text-obsidian leading-none">
                        ${price.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate uppercase tracking-wider">/ unit</span>
                </div>
            )}
            {tierLabel && (
                <span
                    className="text-[9.5px] font-semibold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-[2px]"
                    style={{
                        color: "var(--color-gold-dim)",
                        background: "rgba(197, 160, 101, 0.10)",
                        border: "1px solid rgba(197, 160, 101, 0.45)",
                    }}
                >
                    {tierLabel}
                </span>
            )}
            <span className="flex-1" />
            {onAddToShortlist && (
                <button
                    type="button"
                    onClick={() => onAddToShortlist(product)}
                    className="text-[10.5px] font-medium tracking-[0.04em] text-slate hover:text-obsidian cursor-pointer pb-0.5"
                    style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.6)" }}
                >
                    + shortlist
                </button>
            )}
            <button
                type="button"
                onClick={handleAdd}
                className="rounded-[2px] cursor-pointer transition-colors group"
                style={{
                    background: "var(--color-obsidian)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    padding: compact ? "5px 9px" : "6px 11px",
                    border: "none",
                    borderBottom: "2px solid var(--color-muted-gold)",
                }}
            >
                Add to cart
            </button>
        </div>
    );
}
