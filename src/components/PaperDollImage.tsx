"use client";

import { useState, useEffect, useMemo } from "react";

// ── Mapping: variant attributes → paper doll variant keys ────────────────────

/** Map glass color (from product group) to body variant key */
const BODY_KEY_MAP: Record<string, string> = {
    clear: "CLR",
    amber: "AMB",
    blue: "BLU",
    "cobalt blue": "BLU",
    frosted: "FRS",
    swirl: "SWL",
};

/** Map cap description (parsed from itemName) to cap variant key */
const CAP_KEY_MAP: Record<string, string> = {
    "black dot": "BLK-DOT",
    "pink dot": "PNK-DOT",
    "silver dot": "SL-DOT",
    "matte copper": "MATT-CU",
    "matte gold": "MATT-GL",
    "matte silver": "MATT-SL",
    "shiny black": "SHN-BLK",
    "shiny gold": "SHN-GL",
    "shiny silver": "SHN-SL",
    white: "WHT",
    transparent: "WHT",
};

/** Map applicator type to roller variant key */
const ROLLER_KEY_MAP: Record<string, string> = {
    "Metal Roller Ball": "MTL-ROLL",
    "Plastic Roller Ball": "PLS-ROLL",
};

/** Parse cap description from itemName, e.g. "...with metal roller ball plug and matte gold cap." */
function parseCapFromItemName(itemName: string): string | null {
    const match = itemName.toLowerCase().match(/and\s+(.+?)\s+cap/);
    if (!match) return null;
    const desc = match[1].trim();
    // Direct lookup
    if (CAP_KEY_MAP[desc]) return CAP_KEY_MAP[desc];
    // Fuzzy match
    for (const [key, value] of Object.entries(CAP_KEY_MAP)) {
        if (desc.includes(key)) return value;
    }
    return null;
}

/** Determine paper doll mode from applicator */
function getModeFromApplicator(applicator: string | null): "rollon" | "spray" | "lotion" {
    if (!applicator) return "rollon";
    const a = applicator.toLowerCase();
    if (a.includes("roller") || a.includes("roll-on")) return "rollon";
    if (a.includes("spray") || a.includes("mist") || a.includes("atomizer")) return "spray";
    if (a.includes("lotion") || a.includes("pump")) return "lotion";
    return "rollon";
}

// ── Component ────────────────────────────────────────────────────────────────

interface PaperDollImageProps {
    familyKey: string;
    glassColor: string | null;
    applicator: string | null;
    itemName: string;
    fallbackImageUrl?: string | null;
    className?: string;
}

export default function PaperDollImage({
    familyKey,
    glassColor,
    applicator,
    itemName,
    fallbackImageUrl,
    className = "",
}: PaperDollImageProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const config = useMemo(() => {
        const mode = getModeFromApplicator(applicator);
        const body = BODY_KEY_MAP[(glassColor ?? "").toLowerCase()] ?? null;
        const cap = parseCapFromItemName(itemName);
        const roller = mode === "rollon" && applicator ? ROLLER_KEY_MAP[applicator] ?? null : undefined;

        if (!body) return null;

        const payload: Record<string, string | boolean> = {
            family: familyKey,
            mode,
            body,
            preview: true,
        };

        if (mode === "rollon") {
            if (roller) payload.roller = roller;
            if (cap) payload.cap = cap;
        } else if (mode === "spray") {
            // For spray mode, we'd need sprayer key mapping
            // For now, use a default if available
        } else if (mode === "lotion") {
            // Same for lotion/pump
        }

        return payload;
    }, [familyKey, glassColor, applicator, itemName]);

    useEffect(() => {
        if (!config) {
            setLoading(false);
            setError(true);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(false);

        fetch("/api/paper-doll/render", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
        })
            .then(async (res) => {
                if (cancelled) return;
                if (!res.ok) {
                    setError(true);
                    setLoading(false);
                    return;
                }
                const blob = await res.blob();
                if (cancelled) return;
                const url = URL.createObjectURL(blob);
                setImageUrl(url);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [config]);

    // Clean up blob URL
    useEffect(() => {
        return () => {
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [imageUrl]);

    // Fall back to static image if paper doll fails
    if (error || (!loading && !imageUrl)) {
        if (fallbackImageUrl) {
            return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={fallbackImageUrl}
                    alt="Product"
                    className={className}
                />
            );
        }
        return null;
    }

    return (
        <div className={`relative ${className}`}>
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-champagne/40 border-t-muted-gold rounded-full animate-spin" />
                </div>
            )}
            {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={imageUrl}
                    alt="Product configuration"
                    className={`w-full h-full object-contain transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
                />
            )}
        </div>
    );
}
