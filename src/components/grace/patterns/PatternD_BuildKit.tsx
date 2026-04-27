"use client";

import Image from "next/image";
import { ArrowsLeftRight } from "@phosphor-icons/react";
import { useMemo } from "react";
import type { BuildKitPayload, ProductCard } from "@/components/GraceContext";
import { useCart } from "@/components/CartProvider";

/**
 * Pattern D — build-a-kit composer.
 *
 * Three stacked rows: bottle / closure / applicator. Each row has a "Swap"
 * action that opens an alternative picker (v1 stub: prints alternates inline).
 * Single primary CTA: "Add kit to cart".
 */
export interface PatternDBuildKitProps {
    payload: BuildKitPayload;
    onSwap?: (role: "bottle" | "closure" | "applicator") => void;
    onAddKitToCart?: (items: ProductCard[]) => void;
    onAddKitToShortlist?: (items: ProductCard[]) => void;
}

interface KitSlot {
    role: "bottle" | "closure" | "applicator";
    label: string;
    product: ProductCard | null | undefined;
}

export default function PatternD_BuildKit({
    payload,
    onSwap,
    onAddKitToCart,
    onAddKitToShortlist,
}: PatternDBuildKitProps) {
    const { addToCart } = useCart();

    const slots: KitSlot[] = [
        { role: "bottle", label: "Bottle", product: payload.bottle },
        { role: "closure", label: "Closure", product: payload.closure },
        { role: "applicator", label: "Applicator", product: payload.applicator },
    ];

    const filledSlots = slots.filter((s) => s.product) as Array<KitSlot & { product: ProductCard }>;

    const subtotal = useMemo(() => {
        if (payload.subtotalCents != null) return payload.subtotalCents / 100;
        return filledSlots.reduce((sum, s) => sum + (s.product.webPrice1pc ?? 0), 0);
    }, [payload.subtotalCents, filledSlots]);

    const handleAddKit = () => {
        const items = filledSlots.map((s) => s.product);
        if (onAddKitToCart) {
            onAddKitToCart(items);
            return;
        }
        addToCart(
            items.map((p) => ({
                graceSku: p.graceSku,
                itemName: p.itemName,
                quantity: 1,
                unitPrice: p.webPrice1pc ?? null,
            })),
        );
    };

    return (
        <div
            className="mt-2 rounded-[2px] overflow-hidden"
            style={{
                background: "var(--color-linen)",
                border: "1px solid rgba(212, 197, 169, 0.55)",
            }}
        >
            {/* Header */}
            <div
                className="px-3 py-2"
                style={{
                    background: "rgba(238, 230, 212, 0.4)",
                    borderBottom: "1px solid rgba(212, 197, 169, 0.4)",
                }}
            >
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate">
                    Build-a-kit · {filledSlots.length} component{filledSlots.length === 1 ? "" : "s"}
                </div>
            </div>

            {/* Slots */}
            {slots.map((s) => (
                <div
                    key={s.role}
                    className="flex items-center gap-2.5 px-3 py-2"
                    style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.3)" }}
                >
                    <div
                        className="relative shrink-0 rounded-[2px] overflow-hidden bg-travertine"
                        style={{ width: 40, height: 40 }}
                    >
                        {s.product?.heroImageUrl ? (
                            <Image
                                src={s.product.heroImageUrl}
                                alt={s.product.itemName}
                                fill
                                className="object-cover"
                                sizes="40px"
                                unoptimized
                            />
                        ) : (
                            <div
                                className="w-full h-full flex items-center justify-center font-cormorant"
                                style={{ color: "rgba(29, 29, 31, 0.3)", fontSize: 14 }}
                            >
                                {s.label[0]}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-slate">
                            {s.label}
                        </div>
                        {s.product ? (
                            <div className="font-serif text-[12px] font-medium text-obsidian leading-tight truncate">
                                {s.product.itemName}
                            </div>
                        ) : (
                            <div className="text-[11px] text-slate italic">Not yet selected</div>
                        )}
                        {s.product && (
                            <div className="text-[9.5px] text-slate uppercase tracking-wider">
                                {s.product.graceSku}
                                {s.product.webPrice1pc != null && ` · $${s.product.webPrice1pc.toFixed(2)}`}
                            </div>
                        )}
                    </div>
                    {s.product && onSwap && (
                        <button
                            type="button"
                            onClick={() => onSwap(s.role)}
                            className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate hover:text-obsidian cursor-pointer rounded-[2px] px-1.5 py-1 transition-colors"
                            style={{ border: "1px solid rgba(99, 117, 136, 0.28)" }}
                            title="Swap this component"
                        >
                            <ArrowsLeftRight size={10} weight="bold" />
                            Swap
                        </button>
                    )}
                </div>
            ))}

            {/* Footer — subtotal + Add to cart */}
            <div className="px-3 py-2.5 flex items-center gap-2">
                <div className="flex-1">
                    <div className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-slate">Subtotal</div>
                    <div className="font-serif text-[16px] font-medium text-obsidian leading-none mt-0.5">
                        ${subtotal.toFixed(2)}
                    </div>
                </div>
                {onAddKitToShortlist && filledSlots.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onAddKitToShortlist(filledSlots.map((s) => s.product))}
                        className="text-[10.5px] font-medium tracking-[0.04em] text-slate hover:text-obsidian cursor-pointer pb-0.5"
                        style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.6)" }}
                    >
                        + shortlist
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleAddKit}
                    disabled={filledSlots.length === 0}
                    className="rounded-[2px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    style={{
                        background: "var(--color-obsidian)",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        padding: "7px 11px",
                        border: "none",
                        borderBottom: "2px solid var(--color-muted-gold)",
                    }}
                >
                    Add kit to cart
                </button>
            </div>
        </div>
    );
}
