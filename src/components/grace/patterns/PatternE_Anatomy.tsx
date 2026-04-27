"use client";

import Image from "next/image";
import type { AnatomyPayload } from "@/components/GraceContext";

/**
 * Pattern E — anatomical bottle view.
 *
 * Wraps the bottle hero (or PaperDoll body layer) with absolute-positioned
 * callout pins. Each pin is a small Antiqued Gold tick on the bottle, with
 * a Stone-tone caption to the side carrying label + value.
 *
 * v1 stub (per plan): pins use a fixed 4-anchor preset (cap 8%, neck 22%,
 * shoulder 38%, base 90%). Per-family precise anchor positions land in a
 * follow-up via Sanity-stored presets keyed on `paperDollFamilyKey`.
 */
export interface PatternEAnatomyProps {
    payload: AnatomyPayload;
}

export default function PatternE_Anatomy({ payload }: PatternEAnatomyProps) {
    const hero = payload.product.heroImageUrl ?? payload.product.paperDollBodyUrl;
    if (!hero) return null;

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
                    Anatomy · {payload.product.itemName}
                </div>
            </div>

            {/* Hero + pin overlay */}
            <div className="flex">
                <div
                    className="relative shrink-0"
                    style={{ width: "55%", aspectRatio: "4 / 5", background: "var(--color-travertine)" }}
                >
                    <Image
                        src={hero}
                        alt={payload.product.itemName}
                        fill
                        className="object-contain p-3"
                        sizes="240px"
                        unoptimized
                    />
                    {/* Pin dots */}
                    {payload.pins.map((pin, i) => (
                        <span
                            key={i}
                            className="absolute"
                            style={{
                                left: `${pin.x * 100}%`,
                                top: `${pin.y * 100}%`,
                                transform: "translate(-50%, -50%)",
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "var(--color-muted-gold)",
                                border: "1.5px solid var(--color-bone)",
                                boxShadow: "0 0 0 1px rgba(29, 29, 31, 0.16), 0 0 0 4px rgba(197, 160, 101, 0.18)",
                            }}
                            aria-hidden
                        />
                    ))}
                </div>

                {/* Caption block */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-2.5 px-3.5 py-3">
                    {payload.pins.map((pin, i) => (
                        <div
                            key={i}
                            className="flex items-baseline gap-2"
                            style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.4)", paddingBottom: 6 }}
                        >
                            <div
                                className="rounded-full shrink-0"
                                style={{
                                    width: 5,
                                    height: 5,
                                    background: "var(--color-muted-gold)",
                                    transform: "translateY(-2px)",
                                }}
                                aria-hidden
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate">
                                    {pin.label}
                                </div>
                                {pin.value && (
                                    <div className="font-serif text-[12.5px] font-medium text-obsidian leading-tight mt-0.5">
                                        {pin.value}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div
                className="px-3 py-2 text-[10px] italic text-slate text-center"
                style={{ borderTop: "1px solid rgba(212, 197, 169, 0.4)" }}
            >
                Specs are nominal — exact tolerances on the tech sheet.
            </div>
        </div>
    );
}
