"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { client, isSanityConfigured } from "@/sanity/lib/client";
/* eslint-disable @next/next/no-img-element */

// ── Types ────────────────────────────────────────────────────────────────────

interface LayerAsset {
    _key: string;
    slot: string;
    variantKey: string;
    imageUrl: string;
}

interface FamilyData {
    _id: string;
    familyKey: string;
    displayName: string;
    layerOrderRollon: string[];
    layerOrderSpray: string[];
    layerOrderLotion: string[];
    layerAssets: LayerAsset[];
}

type ApplicatorMode = "rollon" | "spray" | "lotion";

// ── Sanity query ─────────────────────────────────────────────────────────────

const FAMILY_QUERY = `*[_type == "paperDollFamily" && familyKey == $familyKey][0]{
    _id, familyKey, displayName,
    layerOrderRollon, layerOrderSpray, layerOrderLotion,
    layerAssets[]{
        _key, slot, variantKey, sourceFilename,
        "imageUrl": image.asset->url
    }
}`;

// ── Cache: fetch once per family, reuse across re-renders ────────────────────

const familyCache = new Map<string, Promise<FamilyData | null>>();

function fetchFamily(familyKey: string): Promise<FamilyData | null> {
    if (familyCache.has(familyKey)) return familyCache.get(familyKey)!;
    if (!isSanityConfigured) {
        const p = Promise.resolve(null);
        familyCache.set(familyKey, p);
        return p;
    }
    const p = client.fetch<FamilyData | null>(FAMILY_QUERY, { familyKey }).catch(() => null);
    familyCache.set(familyKey, p);
    return p;
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

const BODY_KEY_MAP: Record<string, string> = {
    clear: "CLR",
    amber: "AMB",
    blue: "BLU",
    "cobalt blue": "BLU",
    frosted: "FRS",
    swirl: "SWL",
};

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

const ROLLER_KEY_MAP: Record<string, string> = {
    "Metal Roller Ball": "MTL-ROLL",
    "Plastic Roller Ball": "PLS-ROLL",
};

/** Map trim color descriptions (from itemName) to Sanity sprayer/pump variant keys */
const TRIM_KEY_MAP: Record<string, string> = {
    black: "BLK",
    gold: "GL",
    "matte silver": "MATT-SL",
    "shiny silver": "SHN-SL",
    turquoise: "TUR",
    red: "RD",
};

function parseCapFromItemName(itemName: string): string | null {
    const match = itemName.toLowerCase().match(/and\s+(.+?)\s+cap/);
    if (!match) return null;
    const desc = match[1].trim();
    if (CAP_KEY_MAP[desc]) return CAP_KEY_MAP[desc];
    for (const [key, value] of Object.entries(CAP_KEY_MAP)) {
        if (desc.includes(key)) return value;
    }
    return null;
}

function parseTrimFromItemName(itemName: string): string | null {
    const match = itemName.toLowerCase().match(/with\s+(.+?)\s+trim/);
    if (!match) return null;
    const desc = match[1].trim();
    if (TRIM_KEY_MAP[desc]) return TRIM_KEY_MAP[desc];
    for (const [key, value] of Object.entries(TRIM_KEY_MAP)) {
        if (desc.includes(key)) return value;
    }
    return null;
}

function getModeFromApplicator(applicator: string | null): ApplicatorMode {
    if (!applicator) return "rollon";
    const a = applicator.toLowerCase();
    if (a.includes("roller") || a.includes("roll-on")) return "rollon";
    if (a.includes("spray") || a.includes("mist") || a.includes("atomizer")) return "spray";
    if (a.includes("lotion") || a.includes("pump")) return "lotion";
    return "rollon";
}

function groupBySlot(assets: LayerAsset[]): Record<string, LayerAsset[]> {
    const r: Record<string, LayerAsset[]> = {};
    for (const a of assets) {
        (r[a.slot] = r[a.slot] || []).push(a);
    }
    return r;
}

function sanityUrl(url: string): string {
    return `${url}?w=1000&fm=png&q=90`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface PaperDollImageProps {
    familyKey: string;
    glassColor: string | null;
    applicator: string | null;
    itemName: string;
    fallbackImageUrl?: string | null;
    className?: string;
    /** Start with cap hidden to show fitment (default: true for rollon) */
    initialCapLifted?: boolean;
    /** Notify parent when cap visibility changes */
    onCapStateChange?: (lifted: boolean) => void;
}

export default function PaperDollImage({
    familyKey,
    glassColor,
    applicator,
    itemName,
    fallbackImageUrl,
    className = "",
    initialCapLifted,
    onCapStateChange,
}: PaperDollImageProps) {
    const [family, setFamily] = useState<FamilyData | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    const mode = useMemo(() => getModeFromApplicator(applicator), [applicator]);

    // Cap visibility — for rollon mode, default to cap ON (showing the finished product)
    const [capVisible, setCapVisible] = useState(
        initialCapLifted != null ? !initialCapLifted : true
    );

    // Reset cap visibility when the applicator mode changes
    const prevModeRef = useRef(mode);
    useEffect(() => {
        if (prevModeRef.current !== mode) {
            prevModeRef.current = mode;
            setCapVisible(true); // eslint-disable-line react-hooks/set-state-in-effect -- intentional prev-value sync
        }
    }, [mode]);

    const toggleCap = useCallback(() => {
        const next = !capVisible;
        setCapVisible(next);
        onCapStateChange?.(!next); // lifted=true means cap is OFF
    }, [capVisible, onCapStateChange]);

    // Show cap when user picks a new cap color
    const currentCapKey = useMemo(() => parseCapFromItemName(itemName), [itemName]);
    const [prevCapKey, setPrevCapKey] = useState(currentCapKey);
    useEffect(() => {
        if (currentCapKey !== prevCapKey) {
            setPrevCapKey(currentCapKey); // eslint-disable-line react-hooks/set-state-in-effect -- intentional prev-value sync
            if (!capVisible) {
                setCapVisible(true);
                onCapStateChange?.(false);
            }
        }
    }, [currentCapKey, prevCapKey, capVisible, onCapStateChange]);

    // Fetch family data once (cached)
    useEffect(() => {
        let cancelled = false;
        fetchFamily(familyKey)
            .then((data) => {
                if (cancelled) return;
                if (!data) { setError(true); setLoaded(true); return; }
                setFamily(data);
                setLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
                setLoaded(true);
            });
        return () => { cancelled = true; };
    }, [familyKey]);

    // Derive current selections from product attributes
    const bodyKey = useMemo(() => BODY_KEY_MAP[(glassColor ?? "").toLowerCase()] ?? null, [glassColor]);
    const capKey = useMemo(() => parseCapFromItemName(itemName), [itemName]);
    const rollerKey = useMemo(() => {
        if (mode !== "rollon" || !applicator) return null;
        return ROLLER_KEY_MAP[applicator] ?? null;
    }, [mode, applicator]);
    const trimKey = useMemo(() => parseTrimFromItemName(itemName), [itemName]);

    const bySlot = useMemo(() => {
        if (!family) return {};
        return groupBySlot(family.layerAssets);
    }, [family]);

    // Build the list of layers to render
    const layers = useMemo(() => {
        if (!family || !bodyKey) return [];

        const order = mode === "rollon"
            ? family.layerOrderRollon
            : mode === "spray"
                ? family.layerOrderSpray
                : family.layerOrderLotion;

        if (!order) return [];

        const result: { key: string; url: string; zIndex: number; slot: string }[] = [];

        order.forEach((slot, i) => {
            let variantKey: string | null = null;
            if (slot === "body") variantKey = bodyKey;
            else if (slot === "cap") variantKey = capKey;
            else if (slot === "roller") variantKey = rollerKey;
            else if (slot === "sprayer") {
                variantKey = trimKey ?? bySlot.sprayer?.[0]?.variantKey ?? null;
            }
            else if (slot === "pump") {
                variantKey = trimKey ?? bySlot.pump?.[0]?.variantKey ?? null;
            }

            if (!variantKey) return;

            const asset = bySlot[slot]?.find((a) => a.variantKey === variantKey);
            if (!asset?.imageUrl) return;

            result.push({
                key: `${slot}-${variantKey}`,
                url: sanityUrl(asset.imageUrl),
                zIndex: i + 1,
                slot,
            });
        });

        return result;
    }, [family, mode, bodyKey, capKey, rollerKey, trimKey, bySlot]);

    // Track per-layer load state for smooth appearance
    const [layersReady, setLayersReady] = useState<Set<string>>(new Set());
    const onLayerLoad = useCallback((key: string) => {
        setLayersReady((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

    // All layers loaded?
    const allLoaded = layers.length > 0 && layers.every(l => layersReady.has(l.key));

    // Fallback if Sanity fails or family not found
    if (error || (loaded && !family)) {
        if (fallbackImageUrl) {
            return <img src={fallbackImageUrl} alt="Product" className={className} />;
        }
        return null;
    }

    // Initial loading spinner (only before first paint)
    if (!loaded) {
        return (
            <div className={`relative ${className}`}>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-champagne/40 border-t-muted-gold rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    // No layers resolved (missing body key, etc.)
    if (layers.length === 0) {
        if (fallbackImageUrl) {
            return <img src={fallbackImageUrl} alt="Product" className={className} />;
        }
        return null;
    }

    const hasCapLayer = layers.some(l => l.slot === "cap");
    const showCapToggle = mode === "rollon" && hasCapLayer;

    return (
        <div className={`relative ${className}`}>
            {layers.map(({ key, url, zIndex, slot }) => {
                const isCap = slot === "cap";
                const hidden = isCap && !capVisible && mode === "rollon";
                return (
                    <img
                        key={key}
                        src={url}
                        alt=""
                        onLoad={() => onLayerLoad(key)}
                        className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ease-out"
                        style={{
                            zIndex,
                            opacity: hidden ? 0 : (layersReady.has(key) ? 1 : 0),
                            objectPosition: "50% 50%",
                        }}
                        draggable={false}
                    />
                );
            })}

            {/* Cap on/off toggle — clean pill button anchored at bottom of image */}
            {showCapToggle && allLoaded && (
                <button
                    onClick={toggleCap}
                    className="absolute z-50 left-1/2 -translate-x-1/2 bottom-[1%] flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                    style={{
                        backgroundColor: capVisible ? "rgba(255,255,255,0.85)" : "rgba(30,28,26,0.85)",
                        borderColor: capVisible ? "rgba(200,190,170,0.5)" : "transparent",
                        color: capVisible ? "#5c5549" : "#ffffff",
                    }}
                    aria-label={capVisible ? "Remove cap to view fitment" : "Put cap back on"}
                >
                    <span className="text-[11px] uppercase tracking-wider font-semibold">
                        {capVisible ? "Remove Cap" : "Cap On"}
                    </span>
                    <span
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200"
                        style={{
                            borderColor: capVisible ? "#b8a88a" : "#ffffff",
                            backgroundColor: capVisible ? "transparent" : "#ffffff",
                        }}
                    >
                        {!capVisible && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5L4.5 7.5L8 3" stroke="#1e1c1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </span>
                </button>
            )}
        </div>
    );
}
