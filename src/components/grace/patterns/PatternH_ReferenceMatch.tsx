"use client";

import Image from "next/image";
import type { ReferenceMatchPayload } from "@/components/GraceContext";
import GraceProductCard from "@/components/grace/cards/GraceProductCard";

/**
 * Pattern H — reference image match.
 *
 * v1 stub behavior: the upload is shown left, matched products on the right.
 * Match logic in this PR is a keyword fallback (`searchCatalog` against a
 * model-generated description of the upload). Honest framing in the caption:
 * "best matches based on what I see — request a sample to confirm geometry."
 *
 * Full visual-similarity (CLIP embeddings) lands as a follow-up; the renderer
 * doesn't change shape when that lights up.
 */
export interface PatternHReferenceMatchProps {
    payload: ReferenceMatchPayload;
}

export default function PatternH_ReferenceMatch({ payload }: PatternHReferenceMatchProps) {
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
                    Closest matches in the catalog
                </div>
                {payload.description && (
                    <div className="text-[10.5px] text-obsidian italic mt-1 leading-snug">
                        “{payload.description}”
                    </div>
                )}
            </div>

            <div className="flex gap-3 p-3">
                {/* Reference thumb */}
                <div className="shrink-0">
                    <div
                        className="relative rounded-[2px] overflow-hidden bg-travertine"
                        style={{ width: 80, height: 80 }}
                    >
                        <Image
                            src={payload.referenceUrl}
                            alt="Your reference"
                            fill
                            className="object-cover"
                            sizes="80px"
                            unoptimized
                        />
                    </div>
                    <div className="text-[8.5px] uppercase tracking-[0.18em] text-slate mt-1 text-center font-semibold">
                        Reference
                    </div>
                </div>

                {/* Matched products column */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    {payload.matches.length === 0 ? (
                        <div className="text-[12px] text-slate italic py-3">
                            Still looking — try a clearer photo or a closer crop.
                        </div>
                    ) : (
                        payload.matches.slice(0, 3).map((m) => (
                            <div key={m.graceSku}>
                                <GraceProductCard product={m} mode="single" />
                                {m.reasoning && (
                                    <div className="text-[10.5px] text-slate italic mt-1 px-1 leading-snug">
                                        {m.reasoning}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div
                className="px-3 py-2 text-[10px] italic text-slate text-center"
                style={{ borderTop: "1px solid rgba(212, 197, 169, 0.4)" }}
            >
                Best matches based on what I see — request a sample to confirm geometry.
            </div>
        </div>
    );
}
