"use client";

import Image from "next/image";
import type { BrandMockupPayload } from "@/components/GraceContext";

/**
 * Pattern I — brand mockup canvas (v1 stub).
 *
 * Renders the bare hero bottle with the user's logo overlaid as a translucent
 * decal at fixed coordinates (50% width, 60% from top). Refinement chip row
 * lets the user adjust the cap finish; "Save to project" / "Download" land
 * with the full studio render pipeline in a follow-up PR.
 *
 * Honest framing in the caption — Pattern I doesn't pretend to be a final
 * studio render.
 */
export interface PatternIBrandMockupProps {
    payload: BrandMockupPayload;
    onTryFinish?: (finish: string) => void;
    onRequestStudioRender?: () => void;
}

const CAP_FINISHES = ["Brushed silver", "Matte black", "Polished gold", "Frosted"];

export default function PatternI_BrandMockup({
    payload,
    onTryFinish,
    onRequestStudioRender,
}: PatternIBrandMockupProps) {
    const bottleHero = payload.product.heroImageUrl;

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
                    Quick mockup · {payload.product.itemName}
                </div>
            </div>

            {/* Composite render — bottle hero + logo decal overlay */}
            <div
                className="relative w-full"
                style={{ aspectRatio: "4 / 5", background: "var(--color-travertine)" }}
            >
                {bottleHero ? (
                    <Image
                        src={bottleHero}
                        alt={payload.product.itemName}
                        fill
                        className="object-contain p-4"
                        sizes="(max-width: 768px) 100vw, 460px"
                        unoptimized
                    />
                ) : (
                    <div
                        className="absolute inset-0 flex items-center justify-center font-cormorant"
                        style={{ color: "rgba(29, 29, 31, 0.3)", fontSize: 60 }}
                    >
                        {payload.product.family?.[0] ?? "B"}
                    </div>
                )}
                {/* Logo decal — 50% width, 60% from top, multiply blend per spec */}
                <div
                    className="absolute"
                    style={{
                        left: "50%",
                        top: "60%",
                        width: "50%",
                        height: "20%",
                        transform: "translate(-50%, -50%)",
                        backgroundImage: `url(${payload.logoUrl})`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                        backgroundSize: "contain",
                        mixBlendMode: "multiply",
                        opacity: 0.85,
                        pointerEvents: "none",
                    }}
                    aria-hidden
                />
            </div>

            {/* Refinement chip row */}
            <div className="px-3 pt-2.5 pb-1.5 flex flex-wrap gap-1.5">
                {CAP_FINISHES.map((f) => {
                    const sel = payload.capFinish === f;
                    return (
                        <button
                            key={f}
                            type="button"
                            onClick={() => onTryFinish?.(f)}
                            aria-pressed={sel}
                            className="rounded-[2px] cursor-pointer transition-colors"
                            style={{
                                fontSize: 10.5,
                                fontWeight: 500,
                                letterSpacing: "0.04em",
                                padding: "5px 9px",
                                background: sel ? "rgba(245, 243, 239, 0.7)" : "transparent",
                                border: sel ? "1.5px solid var(--color-muted-gold)" : "1px solid rgba(99, 117, 136, 0.28)",
                                color: sel ? "var(--color-gold-dim)" : "var(--color-obsidian)",
                            }}
                        >
                            {f}
                        </button>
                    );
                })}
            </div>

            <div
                className="px-3 py-2 flex items-center justify-between text-[10px] italic text-slate"
                style={{ borderTop: "1px solid rgba(212, 197, 169, 0.4)" }}
            >
                <span>Quick mockup — full studio render available on request</span>
                {onRequestStudioRender && (
                    <button
                        type="button"
                        onClick={onRequestStudioRender}
                        className="not-italic text-[10.5px] font-medium tracking-[0.04em] text-slate hover:text-obsidian cursor-pointer pb-0.5"
                        style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.6)" }}
                    >
                        Request studio render →
                    </button>
                )}
            </div>
        </div>
    );
}
