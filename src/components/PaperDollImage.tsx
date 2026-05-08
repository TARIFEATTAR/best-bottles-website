"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { clientNoCdn, isSanityConfigured } from "@/sanity/lib/client";
/* eslint-disable @next/next/no-img-element */

// ── Types ────────────────────────────────────────────────────────────────────

interface LayerAsset {
    _key: string;
    slot: string;
    variantKey: string;
    imageUrl: string;
    offsetX?: number;
    offsetY?: number;
}

interface FamilyData {
    _id: string;
    familyKey: string;
    displayName: string;
    canvasWidth?: number;
    canvasHeight?: number;
    layerOrderRollon: string[];
    layerOrderSpray: string[];
    layerOrderShortcap: string[];
    layerOrderLotion: string[];
    anchorsJson?: string;
    layerAssets: LayerAsset[];
}

type ApplicatorMode = "rollon" | "spray" | "shortcap" | "lotion";

// ── Sanity query ─────────────────────────────────────────────────────────────

const FAMILY_QUERY = `*[_type == "paperDollFamily" && familyKey == $familyKey][0]{
    _id, familyKey, displayName,
    canvasWidth, canvasHeight,
    layerOrderRollon, layerOrderSpray, layerOrderShortcap, layerOrderLotion,
    anchorsJson,
    layerAssets[]{
        _key, slot, variantKey, sourceFilename,
        "imageUrl": image.asset->url,
        offsetX, offsetY
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
    const p = clientNoCdn.fetch<FamilyData | null>(FAMILY_QUERY, { familyKey }).catch(() => null);
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
    // Dot caps
    "black dot": "BLK-DOT",
    "black with dots": "BLK-DOT",
    "black dots": "BLK-DOT",
    "pink dot": "PNK-DOT",
    "pink with dots": "PNK-DOT",
    "pink dots": "PNK-DOT",
    "silver dot": "SL-DOT",
    "silver with dots": "SL-DOT",
    "silver dots": "SL-DOT",
    // Matte caps (both word orders)
    "matte copper": "MATT-CU",
    "copper matte": "MATT-CU",
    copper: "MATT-CU",
    "matte gold": "MATT-GL",
    "gold matte": "MATT-GL",
    "matte silver": "MATT-SL",
    "silver matte": "MATT-SL",
    // Shiny caps (both word orders)
    "shiny black": "SHN-BLK",
    "black shiny": "SHN-BLK",
    black: "SHN-BLK",
    "shiny gold": "SHN-GL",
    "gold shiny": "SHN-GL",
    "shiny silver": "SHN-SL",
    "silver shiny": "SHN-SL",
    silver: "SHN-SL",
    // Plain caps
    white: "WHT",
    transparent: "WHT",
};

const ROLLER_KEY_MAP: Record<string, string> = {
    "Metal Roller Ball": "MTL-ROLL",
    "Metal Roller": "MTL-ROLL",
    "Plastic Roller Ball": "PLS-ROLL",
    "Plastic Roller": "PLS-ROLL",
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

/** Parse sprayer mechanism variant from item name using the same key scheme as the Sanity family. */
function parseSprayerFromItemName(itemName: string, map: Record<string, string>): string | null {
    const lower = itemName.toLowerCase();
    const sorted = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
    for (const [desc, key] of sorted) {
        if (lower.includes(desc)) return key;
    }
    return parseTrimFromItemName(itemName);
}

/** Parse short cap variant from item name (e.g. "Black Short Cap" → "BLK-SHT") */
function parseShortCapFromItemName(itemName: string): string | null {
    const lower = itemName.toLowerCase();
    for (const [desc, key] of Object.entries(SHORT_CAP_MAP)) {
        if (lower.includes(desc)) return key;
    }
    return null;
}

/** Parse sprayer-overcap pairing from anchorsJson stored in Sanity */
function parseOvercapPairs(anchorsJson?: string): Record<string, string> {
    if (!anchorsJson) return {};
    try {
        const parsed = JSON.parse(anchorsJson);
        return parsed.sprayerOvercapPairs ?? {};
    } catch {
        return {};
    }
}

/** CYL-5ML / TALLCYL-style mechanism keys (pairs with SPR-MATT-* overcaps in Sanity). */
const SPRAYER_VARIANT_MAP: Record<string, string> = {
    "matte black": "BLK-MT",
    "shiny black": "BLK-SH",
    "matte blue": "BLU-MT",
    "matte copper": "CU-MT",
    "matte gold": "GL-MT",
    "shiny gold": "GL-SH",
    "matte silver": "SL-MT",
    "shiny silver": "SL-SH",
};

/**
 * Sprayer `variantKey`s for the **Cylinder 9 ml, neck 17-415** line (`paperDollFamily.familyKey`).
 * Sanity uses compact keys (SHN-SL, MATT-SL, …) and single-piece sprayer PNGs — not the BLK-MT / SL-SH scheme used on CYL-5ML.
 * @see data/paper-doll/CYL-9ML/manifest.json
 */
const SPRAYER_VARIANT_MAP_CYL9ML: Record<string, string> = {
    "shiny silver": "SHN-SL",
    "matte silver": "MATT-SL",
    silver: "SHN-SL",
    "shiny black": "BLK",
    "matte black": "BLK",
    black: "BLK",
    "shiny gold": "GL",
    "matte gold": "GL",
    gold: "GL",
    red: "RD",
    turquoise: "TUR",
    teal: "TUR",
};

/** Matches Convex/Sanity `familyKey` for 17-415 × 9 ml Cylinder only — other 9 ml SKUs may differ. */
const FAMILY_KEY_CYLINDER_9ML_17_415 = "CYL-9ML" as const;

function sprayerFinishMap(familyKey: string): Record<string, string> {
    return familyKey === FAMILY_KEY_CYLINDER_9ML_17_415 ? SPRAYER_VARIANT_MAP_CYL9ML : SPRAYER_VARIANT_MAP;
}

function matchCapColorToSprayerKey(capColor: string | null, map: Record<string, string>): string | null {
    if (!capColor) return null;
    const normalized = capColor.toLowerCase().trim();
    const sorted = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
    for (const [desc, key] of sorted) {
        if (normalized.includes(desc)) return key;
        if (normalized.length >= 3 && desc.includes(normalized)) return key;
    }
    return null;
}

/** Lotion pump keys for the same 17-415 × 9 ml Cylinder family (subset in Sanity — no shiny-silver-only pump layer). */
const PUMP_VARIANT_MAP_CYL9ML: Record<string, string> = {
    "matte black": "BLK",
    "shiny black": "BLK",
    black: "BLK",
    "matte gold": "GL",
    "shiny gold": "GL",
    gold: "GL",
    "matte silver": "MATT-SL",
    "shiny silver": "MATT-SL",
    silver: "MATT-SL",
};

/** Map cap color descriptions to short cap variant keys */
const SHORT_CAP_MAP: Record<string, string> = {
    black: "BLK-SHT",
    "shiny black": "BLK-SHT",
    "black shiny": "BLK-SHT",
    white: "WHT-SHT",
};

function getModeFromApplicator(applicator: string | null): ApplicatorMode {
    if (!applicator) return "rollon";
    const a = applicator.toLowerCase();
    if (a.includes("roller") || a.includes("roll-on")) return "rollon";
    if (a.includes("spray") || a.includes("mist") || a.includes("atomizer")) return "spray";
    if (a.includes("short cap") || a.includes("shortcap") || a.includes("short-cap")) return "shortcap";
    if (a.includes("cap/closure") || a.includes("cap") && a.includes("closure")) return "shortcap";
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
    // Serve full-resolution PNGs — same as pipeline UI uses.
    // Downscaling via ?w= can introduce subtle sub-pixel shifts.
    return `${url}?fm=png&q=90`;
}

// ── Canvas constants ────────────────────────────────────────────────────────
// Legacy fallback for older CYL families. When Sanity provides canvasWidth /
// canvasHeight, that family-specific source canvas is the authoritative
// coordinate space for layer offsets.
const CANVAS_W = 1000;
const CANVAS_H = 1300;

// ── Component ────────────────────────────────────────────────────────────────

interface PaperDollImageProps {
    familyKey: string;
    glassColor: string | null;
    applicator: string | null;
    /** Cap color from product data — e.g. "Shiny Black", "Black with Dots" */
    capColor?: string | null;
    /** Cap height — "Short" triggers shortcap mode when the family supports it */
    capHeight?: string | null;
    itemName: string;
    fallbackImageUrl?: string | null;
    className?: string;
    /** Per-product offset overrides (applied on top of family-level offsets) */
    productOffsets?: { offsetX?: number; offsetY?: number } | null;
    /** Start with cap hidden to show fitment (default: true for rollon) */
    initialCapLifted?: boolean;
    /** Notify parent when cap visibility changes */
    onCapStateChange?: (lifted: boolean) => void;
}

export default function PaperDollImage({
    familyKey,
    glassColor,
    applicator,
    capColor,
    capHeight,
    itemName,
    fallbackImageUrl,
    className = "",
    productOffsets,
    initialCapLifted,
    onCapStateChange,
}: PaperDollImageProps) {
    const [family, setFamily] = useState<FamilyData | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    // ── Container measurement ──────────────────────────────────────────
    // We measure the container and compute explicit top/left/width/height
    // for each layer, matching the pipeline UI's rendering approach exactly.
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
    const cW = family?.canvasWidth ?? CANVAS_W;
    const cH = family?.canvasHeight ?? CANVAS_H;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => {
            const { width, height } = el.getBoundingClientRect();
            if (width > 0 && height > 0) {
                setContainerSize({ w: width, h: height });
            }
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [loaded]);

    const mode = useMemo(() => {
        const baseMode = getModeFromApplicator(applicator);
        // Cap/Closure products: mode depends on capHeight
        // - "Short" → shortcap mode (uses the shortcap slot)
        // - "Tall" or unset → rollon mode (uses the regular cap slot)
        if (baseMode === "shortcap") {
            if (capHeight?.toLowerCase() === "short" && family?.layerOrderShortcap?.length) {
                return "shortcap" as ApplicatorMode;
            }
            // Tall caps or family doesn't support shortcap → use rollon (regular cap slot)
            return "rollon" as ApplicatorMode;
        }
        return baseMode;
    }, [applicator, capHeight, family]);

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
    const capKey = useMemo(() => {
        if (capColor) {
            const normalized = capColor.toLowerCase().trim();
            const directMatch = CAP_KEY_MAP[normalized];
            if (directMatch) return directMatch;
            const sortedEntries = Object.entries(CAP_KEY_MAP).sort((a, b) => b[0].length - a[0].length);
            for (const [desc, key] of sortedEntries) {
                if (normalized.includes(desc)) return key;
            }
        }
        return parseCapFromItemName(itemName);
    }, [capColor, itemName]);
    const rollerKey = useMemo(() => {
        if (mode !== "rollon" || !applicator) return null;
        return ROLLER_KEY_MAP[applicator] ?? null;
    }, [mode, applicator]);
    const trimKey = useMemo(() => parseTrimFromItemName(itemName), [itemName]);
    const sprayerMap = useMemo(() => sprayerFinishMap(familyKey), [familyKey]);
    const sprayerKey = useMemo(() => {
        if (mode !== "spray") return null;
        return matchCapColorToSprayerKey(capColor ?? null, sprayerMap) ?? parseSprayerFromItemName(itemName, sprayerMap);
    }, [capColor, mode, itemName, sprayerMap]);
    const cyl9PumpKey = useMemo(() => {
        if (familyKey !== FAMILY_KEY_CYLINDER_9ML_17_415 || mode !== "lotion") return null;
        return matchCapColorToSprayerKey(capColor ?? null, PUMP_VARIANT_MAP_CYL9ML) ?? parseSprayerFromItemName(itemName, PUMP_VARIANT_MAP_CYL9ML);
    }, [familyKey, mode, capColor, itemName]);
    const shortCapKey = useMemo(() => {
        // Use capColor directly for short cap resolution
        if (capColor) {
            const normalized = capColor.toLowerCase().trim();
            for (const [desc, key] of Object.entries(SHORT_CAP_MAP)) {
                if (normalized.includes(desc)) return key;
            }
        }
        return parseShortCapFromItemName(itemName);
    }, [capColor, itemName]);

    const bySlot = useMemo(() => {
        if (!family) return {};
        return groupBySlot(family.layerAssets);
    }, [family]);

    // Parse sprayer↔overcap pairs from anchorsJson
    const overcapPairs = useMemo(() => parseOvercapPairs(family?.anchorsJson), [family]);

    // Build the list of layers to render
    const layers = useMemo(() => {
        if (!family || !bodyKey) return [];

        const order = mode === "rollon"
            ? family.layerOrderRollon
            : mode === "spray"
                ? family.layerOrderSpray
                : mode === "shortcap"
                    ? family.layerOrderShortcap
                    : family.layerOrderLotion;

        if (!order) return [];

        // Resolve the sprayer variant so we can also look up its paired overcap
        const resolvedSprayerKey = sprayerKey ?? trimKey ?? bySlot.sprayer?.[0]?.variantKey ?? null;

        const result: { key: string; url: string; zIndex: number; slot: string; offsetX: number; offsetY: number }[] = [];

        order.forEach((slot, i) => {
            let variantKey: string | null = null;
            if (slot === "body") variantKey = bodyKey;
            else if (slot === "cap") variantKey = capKey;
            else if (slot === "roller") variantKey = rollerKey;
            else if (slot === "sprayer") {
                variantKey = resolvedSprayerKey;
            }
            else if (slot === "overcap") {
                // Look up the paired overcap for the current sprayer mechanism
                if (resolvedSprayerKey && overcapPairs[resolvedSprayerKey]) {
                    variantKey = overcapPairs[resolvedSprayerKey];
                } else {
                    // Fallback: first overcap
                    variantKey = bySlot.overcap?.[0]?.variantKey ?? null;
                }
            }
            else if (slot === "shortcap") {
                variantKey = shortCapKey ?? bySlot.shortcap?.[0]?.variantKey ?? null;
            }
            else if (slot === "pump") {
                variantKey = cyl9PumpKey ?? trimKey ?? bySlot.pump?.[0]?.variantKey ?? null;
            }

            if (!variantKey) return;

            const asset = bySlot[slot]?.find((a) => a.variantKey === variantKey);
            if (!asset?.imageUrl) return;

            result.push({
                key: `${slot}-${variantKey}`,
                url: sanityUrl(asset.imageUrl),
                zIndex: i + 1,
                slot,
                offsetX: asset.offsetX ?? 0,
                offsetY: asset.offsetY ?? 0,
            });
        });

        return result;
    }, [family, mode, bodyKey, capKey, rollerKey, trimKey, sprayerKey, shortCapKey, cyl9PumpKey, bySlot, overcapPairs]);

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
    const hasOvercapLayer = layers.some(l => l.slot === "overcap");
    // Show toggle for rollon (cap) and spray (overcap) — not for shortcap or lotion
    const showCapToggle = (mode === "rollon" && hasCapLayer) || (mode === "spray" && hasOvercapLayer);

    // Fit canvas into container preserving aspect ratio (same as object-contain)
    const scale = containerSize.w > 0 && containerSize.h > 0
        ? Math.min(containerSize.w / cW, containerSize.h / cH)
        : 0;
    const renderedW = cW * scale;
    const renderedH = cH * scale;
    // Center the rendered area within the container
    const offsetLeft = (containerSize.w - renderedW) / 2;
    const offsetTop = (containerSize.h - renderedH) / 2;

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {scale > 0 && layers.map(({ key, url, zIndex, slot, offsetX, offsetY }) => {
                // Hide cap in rollon mode, or overcap in spray mode, when toggled off
                const isRemovableLayer = (slot === "cap" && mode === "rollon") || (slot === "overcap" && mode === "spray");
                const hidden = isRemovableLayer && !capVisible;
                // Scale canvas-space offsets → display-space, add per-product overrides
                const totalX = offsetX + (productOffsets?.offsetX ?? 0);
                const totalY = offsetY + (productOffsets?.offsetY ?? 0);
                return (
                    <img
                        key={key}
                        src={url}
                        alt=""
                        onLoad={() => onLayerLoad(key)}
                        className="absolute transition-opacity duration-300 ease-out"
                        style={{
                            zIndex,
                            opacity: hidden ? 0 : (layersReady.has(key) ? 1 : 0),
                            // Mirror pipeline UI: explicit position + size, no object-contain
                            top: offsetTop + totalY * scale,
                            left: offsetLeft + totalX * scale,
                            width: renderedW,
                            height: renderedH,
                        }}
                        draggable={false}
                    />
                );
            })}

            {/* Cap/overcap toggle — clean pill button anchored at bottom of image */}
            {showCapToggle && allLoaded && (
                <button
                    onClick={toggleCap}
                    className="absolute z-50 left-1/2 -translate-x-1/2 bottom-[1%] flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                    style={{
                        backgroundColor: capVisible ? "rgba(255,255,255,0.85)" : "rgba(30,28,26,0.85)",
                        borderColor: capVisible ? "rgba(200,190,170,0.5)" : "transparent",
                        color: capVisible ? "#5c5549" : "#ffffff",
                    }}
                    aria-label={capVisible ? (mode === "spray" ? "Remove overcap to view sprayer" : "Remove cap to view fitment") : "Put cap back on"}
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
