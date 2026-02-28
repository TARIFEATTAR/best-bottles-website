"use client";

import { useState, useEffect, useMemo, useCallback, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ShoppingBag, ArrowLeft, ChevronRight, Package,
    Check, Layers, Plus, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import FitmentCarousel from "@/components/FitmentCarousel";
import FitmentDrawer from "@/components/FitmentDrawer";
import { useCart } from "@/components/CartProvider";
import { APPLICATOR_BUCKETS } from "@/lib/catalogFilters";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number | null | undefined): string {
    if (!price) return "—";
    return `$${price.toFixed(2)}`;
}

/** Extract thread size from SKU if present (e.g. CMP-CAP-BLK-18-400 → "18-400") */
function getThreadFromSku(sku: string): string | null {
    const m = sku.match(/(\d{2}-\d{3})/);
    return m ? m[1] : null;
}

function getComponentType(graceSku: string, itemName?: string): string {
    if (graceSku.includes("DRP")) return "Dropper";
    if (graceSku.includes("ROC")) return "Roller Cap";
    if (graceSku.includes("AST")) return "Sprayer";
    if (graceSku.includes("ASP")) return "Sprayer";
    if (graceSku.includes("SPR")) return "Sprayer";
    if (graceSku.includes("ATM")) return "Sprayer";
    if (graceSku.includes("LPM")) return "Lotion Pump";
    if (graceSku.includes("RDC")) return "Reducer";
    if (graceSku.includes("ROL") || graceSku.includes("MRL") || graceSku.includes("RON") || graceSku.includes("MRO") || graceSku.includes("RBL")) return "Roller";

    const name = (itemName || "").toLowerCase();
    if (name.includes("sprayer") || name.includes("bulb") || name.includes("atomizer")) return "Sprayer";
    if (name.includes("lotion") && name.includes("pump")) return "Lotion Pump";
    if (name.includes("dropper")) return "Dropper";
    if (name.includes("reducer")) return "Reducer";
    if (name.includes("roller") || name.includes("roll-on")) return "Roller";

    if (graceSku.includes("CAP")) return "Cap";
    return "Accessory";
}

function isPlasticBottleComponent(itemName?: string): boolean {
    return /plastic bottle with/i.test(itemName ?? "");
}

function getVariantLabel(variant: ProductVariant): string {
    const parts: string[] = [];
    if (variant.capColor) parts.push(variant.capColor);
    if (variant.capStyle) parts.push(variant.capStyle);
    if (variant.trimColor && variant.trimColor !== "Standard") parts.push(variant.trimColor);
    if (variant.ballMaterial) parts.push(variant.ballMaterial);
    if (parts.length > 0) return parts.join(" · ");
    return variant.websiteSku;
}

function getFinishFromGraceSku(graceSku: string | null | undefined): { label: string; swatchName: string } | null {
    if (!graceSku) return null;
    const token = graceSku.split("-").pop()?.toUpperCase() ?? "";
    const map: Record<string, { label: string; swatchName: string }> = {
        SBLK: { label: "Shiny Black", swatchName: "Shiny Black" },
        MBLK: { label: "Matte Black", swatchName: "Matte Black" },
        BLK: { label: "Black", swatchName: "Black" },
        SSLV: { label: "Shiny Silver", swatchName: "Shiny Silver" },
        MSLV: { label: "Matte Silver", swatchName: "Matte Silver" },
        SLV: { label: "Silver", swatchName: "Shiny Silver" },
        SGLD: { label: "Shiny Gold", swatchName: "Shiny Gold" },
        MGLD: { label: "Matte Gold", swatchName: "Matte Gold" },
        GLD: { label: "Gold", swatchName: "Shiny Gold" },
        MCPR: { label: "Matte Copper", swatchName: "Matte Copper" },
        SCPR: { label: "Shiny Copper", swatchName: "Copper" },
        MBLU: { label: "Matte Blue", swatchName: "Blue" },
        SBLU: { label: "Shiny Blue", swatchName: "Blue" },
        BLU: { label: "Blue", swatchName: "Blue" },
        WHT: { label: "White", swatchName: "White" },
        PNK: { label: "Pink", swatchName: "Pink" },
        GRN: { label: "Green", swatchName: "Green" },
        BKDT: { label: "Black with Dots", swatchName: "Black" },
    };
    return map[token] ?? null;
}

function getCapFinishFromItemName(itemName: string | null | undefined): { label: string; swatchName: string } | null {
    const name = (itemName ?? "").toLowerCase();
    if (!name) return null;
    if (name.includes("short black cap")) return { label: "Short Black", swatchName: "Black" };
    if (name.includes("short white cap")) return { label: "Short White", swatchName: "White" };
    if (name.includes("shiny silver cap")) return { label: "Shiny Silver", swatchName: "Shiny Silver" };
    if (name.includes("matte silver cap")) return { label: "Matte Silver", swatchName: "Matte Silver" };
    if (name.includes("shiny gold cap")) return { label: "Shiny Gold", swatchName: "Shiny Gold" };
    if (name.includes("matte gold cap")) return { label: "Matte Gold", swatchName: "Matte Gold" };
    if (name.includes("white cap")) return { label: "White", swatchName: "White" };
    if (name.includes("black cap")) return { label: "Black", swatchName: "Black" };
    if (name.includes("silver cap")) return { label: "Silver", swatchName: "Shiny Silver" };
    if (name.includes("gold cap")) return { label: "Gold", swatchName: "Shiny Gold" };
    return null;
}

function getCapFinishFromComponent(comp: ProductComponent): { label: string; swatchName: string } {
    const sku = (comp.grace_sku || "").toUpperCase();
    // Prioritize SKU tokens so dotted/matte variants don't collapse into generic labels.
    if (sku.includes("BKDT")) return { label: "Black with Dots", swatchName: "Black" };
    if (sku.includes("SLDT")) return { label: "Silver with Dots", swatchName: "Shiny Silver" };
    if (sku.includes("PKDT")) return { label: "Pink with Dots", swatchName: "Pink" };
    if (sku.includes("SBLK")) return { label: "Shiny Black", swatchName: "Shiny Black" };
    if (sku.includes("MBLK")) return { label: "Matte Black", swatchName: "Matte Black" };
    if (sku.includes("SSLV")) return { label: "Shiny Silver", swatchName: "Shiny Silver" };
    if (sku.includes("MSLV")) return { label: "Matte Silver", swatchName: "Matte Silver" };
    if (sku.includes("SGLD")) return { label: "Shiny Gold", swatchName: "Shiny Gold" };
    if (sku.includes("MGLD")) return { label: "Matte Gold", swatchName: "Matte Gold" };
    if (sku.includes("MCPR")) return { label: "Matte Copper", swatchName: "Matte Copper" };
    if (sku.includes("WHT")) return { label: "White", swatchName: "White" };
    if (sku.includes("BLK")) return { label: "Black", swatchName: "Black" };
    if (sku.includes("SLV")) return { label: "Silver", swatchName: "Shiny Silver" };
    if (sku.includes("GLD")) return { label: "Gold", swatchName: "Shiny Gold" };
    const fromName = getCapFinishFromItemName(comp.item_name);
    if (fromName) return fromName;
    return { label: "Cap Option", swatchName: "Standard" };
}

// Swatch hex values for trim/cap finish names
const COLOR_SWATCH: Record<string, string> = {
    "Matte Gold": "#C5A065",
    "Shiny Gold": "#D4AF37",
    "Matte Silver": "#ADADAD",
    "Shiny Silver": "#C8C8C8",
    "Black": "#1D1D1F",
    "Matte Black": "#2D2D2D",
    "Shiny Black": "#0D0D0D",
    "White": "#F5F5F0",
    "Matte Copper": "#B87333",
    "Copper": "#B87333",
    "Rose Gold": "#E8A090",
    "Pink": "#F4A7B9",
    "Blue": "#5B87B5",
    "Green": "#6B9A6B",
    "Standard": "#AAAAAA",
};

// Light swatches that need a dark checkmark
const LIGHT_SWATCHES = new Set(["White", "Shiny Silver", "Matte Silver", "Standard", "Pink", "Rose Gold"]);

// Glass bottle body color hex map — used for sibling color navigation swatches
const GLASS_COLOR_SWATCH: Record<string, string> = {
    "Clear":   "rgba(200, 235, 245, 0.55)",
    "Amber":   "#C8720A",
    "Frosted": "#D8D8D8",
    "Blue":    "#5B87B5",
    "Green":   "#6B9A6B",
    "Black":   "#1D1D1F",
    "Purple":  "#7B5EA7",
    "Pink":    "#F4A7B9",
    "White":   "#F5F5F0",
};
const LIGHT_GLASS = new Set(["Clear", "Frosted", "White", "Pink"]);

const COMPONENT_TYPE_ORDER = ["Reducer", "Roller Cap", "Roller", "Dropper", "Sprayer", "Lotion Pump", "Cap", "Accessory"];
const ROLLON_APPLICATORS = new Set(["Metal Roller", "Plastic Roller"]);

interface ProductComponent {
    grace_sku: string;
    item_name: string;
    image_url?: string | null;
    price_1?: number | null;
    price_12?: number | null;
}

interface ProductVariant {
    _id: string;
    graceSku: string;
    websiteSku: string;
    itemName: string;
    itemDescription: string | null;
    imageUrl: string | null;
    stockStatus: string | null;
    webPrice1pc: number | null;
    webPrice10pc: number | null;
    webPrice12pc: number | null;
    category: string;
    family: string | null;
    shape: string | null;
    color: string | null;
    capacity: string | null;
    heightWithCap: string | null;
    heightWithoutCap: string | null;
    diameter: string | null;
    bottleWeightG: number | null;
    neckThreadSize: string | null;
    bottleCollection: string | null;
    caseQuantity: number | null;
    applicator: string | null;
    capStyle: string | null;
    capColor: string | null;
    trimColor: string | null;
    capHeight?: string | null;
    ballMaterial?: string | null;
    assemblyType?: string | null;
    componentGroup?: string | null;
    graceDescription?: string | null;
    productUrl?: string | null;
    components?: ProductComponent[] | null;
}


// ── Spec Row ──────────────────────────────────────────────────────────────────

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
    if (value == null || value === "") return null;
    return (
        <div className="flex items-start justify-between py-3.5 border-b border-champagne/50">
            <dt className="text-xs uppercase tracking-wider font-bold text-slate">{label}</dt>
            <dd className="text-sm text-obsidian font-medium text-right max-w-[55%]">{value}</dd>
        </div>
    );
}

// ── Component Card ────────────────────────────────────────────────────────────

function ComponentCard({ comp }: { comp: ProductComponent }) {
    const { addItems } = useCart();
    const [justAdded, setJustAdded] = useState(false);

    const handleAdd = useCallback(() => {
        addItems([{
            graceSku: comp.grace_sku,
            itemName: comp.item_name || comp.grace_sku,
            quantity: 1,
            unitPrice: comp.price_1 ?? null,
        }]);
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1500);
    }, [addItems, comp]);

    return (
        <div className="group relative flex items-center space-x-4 p-3 bg-white border border-champagne/40 rounded-sm hover:border-muted-gold transition-colors">
            {comp.image_url ? (
                <div className="w-24 h-24 shrink-0 bg-travertine rounded-sm overflow-hidden flex items-center justify-center">
                    <img
                        src={comp.image_url}
                        alt={comp.item_name || comp.grace_sku}
                        className="w-full h-full object-contain p-1.5"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                        }}
                    />
                </div>
            ) : (
                <div className="w-24 h-24 shrink-0 bg-travertine rounded-sm flex items-center justify-center">
                    <Package className="w-8 h-8 text-champagne" strokeWidth={1} />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate/70 truncate">{comp.grace_sku}</p>
                <p className="text-xs text-obsidian leading-tight line-clamp-2 mt-0.5">{comp.item_name}</p>
                <div className="flex items-center gap-2 mt-2">
                    <p className="font-semibold text-obsidian text-sm">{formatPrice(comp.price_1)}</p>
                    {comp.price_12 && (
                        <p className="text-[10px] text-slate">{formatPrice(comp.price_12)} ×12</p>
                    )}
                </div>
            </div>
            <button
                onClick={handleAdd}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                    justAdded
                        ? "bg-emerald-500 text-white scale-110"
                        : "bg-bone border border-champagne/60 text-slate hover:bg-muted-gold hover:text-white hover:border-muted-gold"
                }`}
                title="Add to cart"
            >
                {justAdded ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                ) : (
                    <Plus className="w-4 h-4" strokeWidth={2} />
                )}
            </button>
        </div>
    );
}

// ── Main PDP ──────────────────────────────────────────────────────────────────

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const applicatorParam = searchParams.get("applicator");

    const data = useQuery(api.products.getProductGroup, { slug });

    const { addItems } = useCart();
    const [fitmentDrawerOpen, setFitmentDrawerOpen] = useState(false);
    const [selectedApplicator, setSelectedApplicator] = useState<string | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [selectedCapColor, setSelectedCapColor] = useState<string | null>(null);
    const [selectedCapStyle, setSelectedCapStyle] = useState<string | null>(null);
    const [selectedTrimColor, setSelectedTrimColor] = useState<string | null>(null);
    const [selectedCapComponentSku, setSelectedCapComponentSku] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"specs" | "components">("specs");
    const [qty, setQty] = useState(1);
    const [addedFlash, setAddedFlash] = useState(false);

    const group = data?.group;
    const variants = (data?.variants as ProductVariant[] | undefined) ?? [];

    // Sibling groups — same family + capacityMl + neckThreadSize, different glass color
    const siblingGroups = useQuery(
        api.products.getSiblingGroups,
        group
            ? {
                  family: group.family,
                  capacityMl: group.capacityMl ?? 0,
                  excludeSlug: slug,
                  neckThreadSize: group.neckThreadSize ?? undefined,
              }
            : "skip"
    );

    // Sibling groups: Cylinder 5ml roll-on shows Clear and Blue only (no Amber — 5ml Amber is Tulip-shaped)
    const displaySiblingGroups = siblingGroups;

    // Atomizer family flag — simplified UI (glass color only, no sub-selectors)
    const isAtomizer = useMemo(() =>
        (group?.family ?? "").toLowerCase().includes("atomizer"),
        [group]
    );

    // ── Derived selector options ─────────────────────────────────────────────

    // Applicator options — excludes "Cap/Closure" (handled separately)
    // Glass Rod is for 18-400 bottles (e.g. Boston Round 15ml), NOT 17-415 (9ml Cylinder)
    const applicatorOptions = useMemo(() => {
        const seen = new Set<string>();
        const bottleThread = group?.neckThreadSize ?? "";
        const isRollonGroup = slug.includes("rollon");
        return variants
            .map((v) => v.applicator)
            .filter((a): a is string => !!a && a !== "Cap/Closure")
            .filter((a) => {
                if (isRollonGroup && !ROLLON_APPLICATORS.has(a)) return false;
                if (a === "Glass Rod" && bottleThread === "17-415") return false;
                if (seen.has(a)) return false;
                seen.add(a);
                return true;
            });
    }, [variants, group?.neckThreadSize, slug]);

    // Whether any variant has no applicator (plain cap closure)
    const hasCapClosure = useMemo(() =>
        variants.some((v) => v.applicator === "Cap/Closure"),
        [variants]
    );

    // Default applicator: URL param (Option A) > user selection > first option > cap closure
    const defaultFromUrl = useMemo(() => {
        if (!applicatorParam) return null;
        if (applicatorParam === "capclosure" && hasCapClosure) return "Cap/Closure";
        const bucket = APPLICATOR_BUCKETS.find((b) => b.value === applicatorParam);
        if (!bucket) return null;
        const match = applicatorOptions.find((opt) => (bucket.productValues as readonly string[]).includes(opt));
        return match ?? null;
    }, [applicatorParam, applicatorOptions, hasCapClosure]);
    const validApplicatorParam = defaultFromUrl ? applicatorParam : null;

    // Guard stale deep links like ?applicator=spray on non-spray groups (e.g. decorative cap bottles).
    useEffect(() => {
        if (!applicatorParam) return;
        if (validApplicatorParam) return;
        router.replace(`/products/${slug}`);
    }, [applicatorParam, validApplicatorParam, router, slug]);

    const activeApplicator = selectedApplicator ?? defaultFromUrl ?? applicatorOptions[0] ?? (hasCapClosure ? "Cap/Closure" : null);
    const variantsForApplicator = useMemo(
        () => variants.filter((v) => v.applicator === activeApplicator),
        [variants, activeApplicator]
    );

    // Cap color options — filtered by selected applicator
    const capColorOptions = useMemo(() => {
        const seen = new Set<string>();
        return variants
            .filter((v) => v.applicator === activeApplicator)
            .map((v) => v.capColor)
            .filter((c): c is string => !!c)
            .filter((c) => {
                if (seen.has(c)) return false;
                seen.add(c);
                return true;
            });
    }, [variants, activeApplicator]);

    const activeCapColor = selectedCapColor ?? capColorOptions[0] ?? null;

    // Cap style options — filtered by applicator + cap color
    const capStyleOptions = useMemo(() => {
        const seen = new Set<string>();
        return variants
            .filter((v) => v.applicator === activeApplicator && v.capColor === activeCapColor)
            .map((v) => v.capStyle)
            .filter((s): s is string => !!s)
            .filter((s) => {
                if (seen.has(s)) return false;
                seen.add(s);
                return true;
            });
    }, [variants, activeApplicator, activeCapColor]);

    const activeCapStyle = selectedCapStyle ?? capStyleOptions[0] ?? null;

    // Trim options — filtered by applicator + cap color + cap style
    const trimColorOptions = useMemo(() => {
        const seen = new Set<string>();
        return variants
            .filter((v) =>
                v.applicator === activeApplicator &&
                v.capColor === activeCapColor &&
                (capStyleOptions.length === 0 || v.capStyle === activeCapStyle)
            )
            .map((v) => v.trimColor || "Standard")
            .filter((c) => {
                if (seen.has(c)) return false;
                seen.add(c);
                return true;
            });
    }, [variants, activeApplicator, activeCapColor, activeCapStyle, capStyleOptions]);

    const activeTrimColor = selectedTrimColor ?? trimColorOptions[0] ?? null;

    // Resolved variant — 4-way match with graceful fallback
    const selectedVariant = useMemo(() => {
        const explicit = selectedVariantId
            ? variantsForApplicator.find((v) => v._id === selectedVariantId)
            : null;
        if (explicit) return explicit;
        return (
            variants.find(
                (v) =>
                    v.applicator === activeApplicator &&
                    v.capColor === activeCapColor &&
                    (capStyleOptions.length === 0 || v.capStyle === activeCapStyle) &&
                    (v.trimColor || "Standard") === activeTrimColor
            ) ??
            variants.find((v) => v.applicator === activeApplicator) ??
            variants[0] ??
            null
        );
    }, [variants, variantsForApplicator, selectedVariantId, activeApplicator, activeCapColor, activeCapStyle, activeTrimColor, capStyleOptions]);

    const variantSwatchPreview = useMemo(() => {
        return variantsForApplicator.map((v) => {
            const fromCapFields = (() => {
                if (!v.capColor && !v.capStyle) return null;
                if (v.capColor && v.capStyle) {
                    return {
                        label: `${v.capStyle} ${v.capColor}`.replace(/\s+/g, " ").trim(),
                        swatchName: `${v.capStyle} ${v.capColor}`.replace(/\s+/g, " ").trim(),
                    };
                }
                if (v.capColor) return { label: v.capColor, swatchName: v.capColor };
                if (v.capStyle) return { label: v.capStyle, swatchName: v.capStyle };
                return null;
            })();

            const fromGraceSku = getFinishFromGraceSku(v.graceSku);
            const fromItemName = getCapFinishFromItemName(v.itemName);
            const resolved = fromCapFields ?? fromGraceSku ?? fromItemName ?? { label: "Variant Option", swatchName: "Standard" };
            const swatchHex = COLOR_SWATCH[resolved.swatchName] ?? GLASS_COLOR_SWATCH[resolved.swatchName] ?? "#AAAAAA";
            const useDarkCheck = LIGHT_SWATCHES.has(resolved.swatchName) || LIGHT_GLASS.has(resolved.swatchName);
            return {
                id: v._id,
                websiteSku: v.websiteSku,
                displayLabel: resolved.label,
                swatchHex,
                useDarkCheck,
                variantId: v._id as string | undefined,
                isComponentOnly: false,
            };
        });
    }, [variantsForApplicator]);

    const capSwatchPreview = useMemo(() => {
        if (activeApplicator) return variantSwatchPreview;

        const bottleThread = (group?.neckThreadSize ?? "").toString().trim();
        const merged = [...variantSwatchPreview];
        // Build from all variants in this cap-only group so all compatible finishes appear.
        const comps = variantsForApplicator.flatMap((v) => (Array.isArray(v.components) ? v.components : []));

        for (const comp of comps) {
            const sku = comp.grace_sku || "";
            const compThread = getThreadFromSku(sku);
            if (compThread && bottleThread && compThread !== bottleThread) continue;
            if ((group?.category ?? "") !== "Plastic Bottle" && isPlasticBottleComponent(comp.item_name)) continue;
            const type = getComponentType(sku, comp.item_name);
            if (type !== "Cap" && type !== "Roller Cap") continue;

            const finish = getCapFinishFromComponent(comp);
            const swatchHex = COLOR_SWATCH[finish.swatchName] ?? GLASS_COLOR_SWATCH[finish.swatchName] ?? "#AAAAAA";
            const useDarkCheck = LIGHT_SWATCHES.has(finish.swatchName) || LIGHT_GLASS.has(finish.swatchName);

            merged.push({
                id: `comp:${sku}`,
                websiteSku: sku,
                displayLabel: finish.label,
                swatchHex,
                useDarkCheck,
                variantId: undefined,
                isComponentOnly: true,
            });
        }

        // Dedupe by label, prefer real product variant-backed options first.
        const seen = new Set<string>();
        return merged.filter((item) => {
            const key = item.displayLabel.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [activeApplicator, variantSwatchPreview, variantsForApplicator, group?.neckThreadSize, group?.category]);

    const showTrimSelector = useMemo(() => {
        if (trimColorOptions.length === 0) return false;
        if (trimColorOptions.length === 1 && trimColorOptions[0] === "Standard") return false;
        return true;
    }, [trimColorOptions]);

    // Components grouped by type from selected variant
    // Filter by thread — 18-400 caps don't fit 17-415 bottles (e.g. 9ml Cylinder)
    const componentGroups = useMemo(() => {
        const comps = selectedVariant?.components ?? [];
        const bottleThread = (group?.neckThreadSize ?? "").toString().trim();
        const groups: Record<string, ProductComponent[]> = {};

        // Determine which component types are relevant for the active applicator.
        // A flat screw cap does NOT belong on a roll-on bottle even if the thread matches.
        const applicator = (activeApplicator ?? "").toLowerCase();
        const isRoller = applicator.includes("roller") || applicator.includes("roll-on");
        const isSprayer = applicator.includes("atomizer") || applicator.includes("sprayer") || applicator.includes("spray") || applicator.includes("mist");
        const isDropper = applicator.includes("dropper");
        const isLotionPump = applicator.includes("lotion") || applicator.includes("pump");
        const isCapOnly = !activeApplicator;

        // Types that are always irrelevant for this applicator (suppress entirely)
        const suppressedTypes = new Set<string>();
        if (isRoller) {
            // Roll-on bottles don't use flat caps or sprayer nozzles
            suppressedTypes.add("Cap");
            suppressedTypes.add("Sprayer");
            suppressedTypes.add("Dropper");
            suppressedTypes.add("Lotion Pump");
        } else if (isSprayer) {
            suppressedTypes.add("Roller Cap");
            suppressedTypes.add("Roller");
            suppressedTypes.add("Dropper");
            suppressedTypes.add("Lotion Pump");
        } else if (isDropper) {
            suppressedTypes.add("Roller Cap");
            suppressedTypes.add("Roller");
            suppressedTypes.add("Sprayer");
            suppressedTypes.add("Lotion Pump");
        } else if (isLotionPump) {
            suppressedTypes.add("Roller Cap");
            suppressedTypes.add("Roller");
            suppressedTypes.add("Sprayer");
            suppressedTypes.add("Dropper");
        } else if (isCapOnly) {
            // Cap-only PDP: show only classic cap closures as compatible options.
            suppressedTypes.add("Roller Cap");
            suppressedTypes.add("Roller");
            suppressedTypes.add("Sprayer");
            suppressedTypes.add("Dropper");
            suppressedTypes.add("Lotion Pump");
            suppressedTypes.add("Reducer");
        }

        for (const comp of comps) {
            const sku = comp.grace_sku || "";
            const compThread = getThreadFromSku(sku);
            if (compThread && bottleThread && compThread !== bottleThread) continue;
            // Guard: hide standalone plastic bottle products from glass-bottle component lists.
            if ((group?.category ?? "") !== "Plastic Bottle" && isPlasticBottleComponent(comp.item_name)) continue;
            const type = getComponentType(sku, comp.item_name);
            if (suppressedTypes.has(type)) continue;
            if (!groups[type]) groups[type] = [];
            groups[type].push(comp);
        }
        return groups;
    }, [selectedVariant, group?.neckThreadSize, group?.category, activeApplicator]);

    const totalComponents = Object.values(componentGroups).reduce(
        (sum, arr) => sum + arr.length,
        0
    );

    // Inline caps — surfaced directly on the PDP for easy access.
    // For roll-on applicators only show Roller Caps (ROC-prefix), never flat screw caps.
    const inlineCaps = useMemo(() => {
        const applicator = (activeApplicator ?? "").toLowerCase();
        const isRoller = applicator.includes("roller") || applicator.includes("roll-on");
        const isCapOnly = !activeApplicator;
        if (isRoller) {
            return [...(componentGroups["Roller Cap"] ?? [])];
        }
        if (isCapOnly) {
            return [...(componentGroups["Cap"] ?? [])];
        }
        return [
            ...(componentGroups["Cap"] ?? []),
            ...(componentGroups["Roller Cap"] ?? []),
        ];
    }, [componentGroups, activeApplicator]);

    // ── Dynamic SEO title ────────────────────────────────────────────────────
    useEffect(() => {
        if (group) {
            document.title = `${group.displayName} | Best Bottles`;
        }
        return () => { document.title = "Best Bottles"; };
    }, [group]);

    // ── JSON-LD structured data ──────────────────────────────────────────────
    const jsonLd = useMemo(() => {
        if (!group || !selectedVariant) return null;
        return {
            "@context": "https://schema.org",
            "@type": "Product",
            name: group.displayName,
            description: selectedVariant.itemDescription
                ?? `${group.displayName} — ${group.family} collection from Best Bottles. ${group.capacity ?? ""}`.trim(),
            sku: selectedVariant.websiteSku,
            brand: { "@type": "Brand", name: "Best Bottles" },
            category: group.category,
            ...(selectedVariant.imageUrl && { image: selectedVariant.imageUrl }),
            offers: {
                "@type": "AggregateOffer",
                priceCurrency: "USD",
                lowPrice: selectedVariant.webPrice12pc ?? selectedVariant.webPrice10pc ?? selectedVariant.webPrice1pc,
                highPrice: selectedVariant.webPrice1pc,
                availability: selectedVariant.stockStatus === "In Stock"
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
            },
        };
    }, [group, selectedVariant]);

    // ── Loading state ────────────────────────────────────────────────────────

    if (data === undefined) {
        return (
            <main className="min-h-screen bg-bone">
                <Navbar />
                <div className="pt-[156px] lg:pt-[104px] flex items-center justify-center min-h-screen">
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full border-2 border-champagne border-t-muted-gold animate-spin mb-4"></div>
                        <p className="text-xs uppercase tracking-widest font-semibold text-slate">Loading product...</p>
                    </div>
                </div>
            </main>
        );
    }

    // ── Not found state ──────────────────────────────────────────────────────

    if (!group) {
        return (
            <main className="min-h-screen bg-bone">
                <Navbar />
                <div className="pt-[156px] lg:pt-[104px] max-w-[1440px] mx-auto px-4 sm:px-6 py-32 text-center">
                    <h1 className="font-serif text-4xl text-obsidian mb-4">Product Not Found</h1>
                    <p className="text-slate mb-8 text-sm">This product may have been moved or is no longer available.</p>
                    <Link
                        href="/catalog"
                        className="inline-flex items-center px-6 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Browse Catalog
                    </Link>
                </div>
            </main>
        );
    }

    const inStock = selectedVariant?.stockStatus === "In Stock";
    const handleAddToCart = () => {
        if (!selectedVariant || !inStock) return;
        addItems([{
            graceSku: selectedVariant.graceSku,
            itemName: selectedVariant.itemName,
            quantity: qty,
            unitPrice: selectedVariant.webPrice1pc ?? null,
            family: group?.family,
            capacity: group?.capacity ?? undefined,
            color: group?.color ?? undefined,
        }]);
        setAddedFlash(true);
        setTimeout(() => setAddedFlash(false), 1800);
    };

    return (
        <main className="min-h-screen bg-bone">
            {/* JSON-LD structured data for SEO */}
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            <Navbar />
            {selectedVariant?.graceSku && (
                <FitmentDrawer
                    isOpen={fitmentDrawerOpen}
                    onClose={() => setFitmentDrawerOpen(false)}
                    bottleSku={selectedVariant.graceSku}
                />
            )}

            <div className="pt-[156px] lg:pt-[104px]">
                {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
                <div className="border-b border-champagne/50 bg-bone overflow-x-auto">
                    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex items-center space-x-2 text-xs text-slate whitespace-nowrap">
                        <Link href="/" className="hover:text-muted-gold transition-colors shrink-0">Home</Link>
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        <Link href="/catalog" className="hover:text-muted-gold transition-colors shrink-0">Catalog</Link>
                        {validApplicatorParam && (
                            <>
                                <ChevronRight className="w-3 h-3 shrink-0" />
                                <Link
                                    href={`/catalog?applicators=${encodeURIComponent(validApplicatorParam)}`}
                                    className="hover:text-muted-gold transition-colors shrink-0"
                                >
                                    {APPLICATOR_BUCKETS.find((b) => b.value === validApplicatorParam)?.label ?? validApplicatorParam} Bottles
                                </Link>
                            </>
                        )}
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        <Link
                            href={`/catalog?families=${encodeURIComponent(group.family)}${validApplicatorParam ? `&applicators=${encodeURIComponent(validApplicatorParam)}` : ""}`}
                            className="hover:text-muted-gold transition-colors shrink-0"
                        >
                            {group.family}
                        </Link>
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        <span className="text-obsidian font-medium truncate max-w-[150px] sm:max-w-[200px]">{group.displayName}</span>
                    </div>
                </div>

                {/* ── Hero Section ──────────────────────────────────────────────── */}
                <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 lg:py-16">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-20 items-start">

                        {/* ── Image Panel ──────────────────────────────────────────── */}
                        <div className="lg:sticky lg:top-[120px]">
                            <motion.div
                                key={selectedVariant?._id ?? "placeholder"}
                                initial={{ opacity: 0.6 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                                className="aspect-square bg-travertine rounded-sm border border-champagne/50 flex items-center justify-center relative overflow-hidden"
                            >
                                {selectedVariant?.imageUrl ? (
                                    <img
                                        src={selectedVariant.imageUrl}
                                        alt={selectedVariant.itemName}
                                        className="w-full h-full object-contain p-12"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center p-12">
                                        <Package className="w-20 h-20 text-champagne mb-4" strokeWidth={0.75} />
                                        <p className="text-xs text-slate/60 uppercase tracking-wider font-medium">{group.family}</p>
                                        <p className="text-sm text-slate/80 font-medium mt-1">{group.capacity}</p>
                                        <p className="text-[10px] text-slate/40 uppercase tracking-widest mt-6 font-medium">Photography coming soon</p>
                                    </div>
                                )}

                                {/* Variant count */}
                                <div className="absolute top-4 left-4">
                                    <span className="inline-flex items-center px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full bg-obsidian/80 text-white backdrop-blur-sm">
                                        {group.variantCount} Variant{group.variantCount !== 1 ? "s" : ""}
                                    </span>
                                </div>

                                {/* SKU watermark */}
                                {selectedVariant && (
                                    <div className="absolute bottom-4 right-4">
                                        <span className="text-[9px] uppercase tracking-widest text-slate/40 font-mono select-none">
                                            {selectedVariant.websiteSku}
                                        </span>
                                    </div>
                                )}
                            </motion.div>

                            {/* Glass color siblings */}
                            {displaySiblingGroups && displaySiblingGroups.length > 0 && group?.color && (
                                <div className="mt-4">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate mb-2.5">Glass Color</p>
                                    <div className="flex flex-wrap gap-3">
                                        {/* Current (selected) */}
                                        <div className="flex flex-col items-center gap-1">
                                            <span
                                                className="w-9 h-9 rounded-full border-2 border-obsidian scale-110 shadow-md flex items-center justify-center"
                                                style={{ backgroundColor: GLASS_COLOR_SWATCH[group.color] ?? "#CCCCCC" }}
                                            >
                                                <Check
                                                    className={`w-3.5 h-3.5 ${LIGHT_GLASS.has(group.color) ? "text-obsidian" : "text-white"}`}
                                                    strokeWidth={2.5}
                                                />
                                            </span>
                                            <span className="text-[9px] text-obsidian font-semibold">
                                                {group?.family === "Cylinder" && (group?.capacityMl ?? 0) === 5 && slug.includes("rollon") && group.color === "Cobalt Blue"
                                                    ? "Blue"
                                                    : (group.color ?? "")}
                                            </span>
                                        </div>
                                        {/* Sibling colors */}
                                        {displaySiblingGroups.map((s: { _id: string; slug: string; color?: string | null; displayName?: string }) => (
                                            <button
                                                key={s._id}
                                                onClick={() => router.push(`/products/${s.slug}`)}
                                                title={s.color ?? s.displayName}
                                                className="flex flex-col items-center gap-1 group/sib"
                                            >
                                                <span
                                                    className="w-9 h-9 rounded-full border-2 border-champagne/60 group-hover/sib:border-muted-gold transition-all"
                                                    style={{ backgroundColor: GLASS_COLOR_SWATCH[s.color ?? ""] ?? "#CCCCCC" }}
                                                />
                                                <span className="text-[9px] text-slate group-hover/sib:text-muted-gold transition-colors">
                                                    {group?.family === "Cylinder" && (group?.capacityMl ?? 0) === 5 && slug.includes("rollon") && s.color === "Cobalt Blue"
                                                        ? "Blue"
                                                        : (s.color ?? "")}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Config Panel ─────────────────────────────────────────── */}
                        <div>
                            {/* Category · Family */}
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-2">
                                {group.category} · {group.family}
                            </p>

                            {/* Title */}
                            <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-medium text-obsidian leading-[1.1] mb-5">
                                {group.displayName}
                            </h1>

                            {/* Stock + thread badges */}
                            <div className="flex items-center flex-wrap gap-2 mb-6">
                                <span className={`inline-flex items-center px-3 py-1 text-[11px] uppercase tracking-wider font-bold rounded-full ${inStock
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-red-50 text-red-600 border border-red-200"
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${inStock ? "bg-emerald-500" : "bg-red-400"}`}></span>
                                    {selectedVariant?.stockStatus ?? "Unknown"}
                                </span>
                                {group.neckThreadSize && (
                                    <span className="text-[11px] text-slate font-medium uppercase tracking-wider px-3 py-1 bg-bone border border-champagne/60 rounded-full">
                                        Thread {group.neckThreadSize}
                                    </span>
                                )}
                                {group.capacity && group.capacity !== "0 ml (0 oz)" && (
                                    <span className="text-[11px] text-slate font-medium uppercase tracking-wider px-3 py-1 bg-bone border border-champagne/60 rounded-full">
                                        {group.capacity}
                                    </span>
                                )}
                            </div>

                            {/* Price */}
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8 pb-8 border-b border-champagne/50">
                                <div>
                                    <p className="text-xs text-slate uppercase tracking-wider mb-1">From</p>
                                    <p className="font-serif text-3xl sm:text-4xl font-medium text-obsidian">
                                        {formatPrice(selectedVariant?.webPrice1pc ?? group.priceRangeMin)}
                                        <span className="text-lg font-normal text-slate ml-1">/ea</span>
                                    </p>
                                </div>
                                {(selectedVariant?.webPrice10pc || selectedVariant?.webPrice12pc) && (
                                    <div className="text-right space-y-0.5">
                                        {selectedVariant?.webPrice10pc && (
                                            <p className="text-xs text-slate">
                                                {formatPrice(selectedVariant.webPrice10pc)} <span className="text-slate/50">×10</span>
                                            </p>
                                        )}
                                        {selectedVariant?.webPrice12pc && (
                                            <p className="text-xs text-slate">
                                                {formatPrice(selectedVariant.webPrice12pc)} <span className="text-slate/50">×12</span>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Variant Selectors (hidden for atomizers — glass color is the only selection) ── */}

                            {!isAtomizer && (
                                <>
                                    {/* Applicator selector */}
                                    {(applicatorOptions.length > 0 || hasCapClosure) && (
                                        <div className="mb-6">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">Applicator</p>
                                            <div className="flex flex-wrap gap-2">
                                                {applicatorOptions.map((appl) => (
                                                    <button
                                                        key={appl}
                                                        onClick={() => {
                                                            setSelectedApplicator(appl);
                                                            setSelectedVariantId(null);
                                                            setSelectedCapColor(null);
                                                            setSelectedCapStyle(null);
                                                            setSelectedTrimColor(null);
                                                        }}
                                                        className={`px-4 py-2 text-sm font-medium border rounded-sm transition-all ${activeApplicator === appl
                                                            ? "border-obsidian bg-obsidian text-white"
                                                            : "border-champagne text-obsidian hover:border-muted-gold"
                                                            }`}
                                                    >
                                                        {appl}
                                                    </button>
                                                ))}
                                                {/* Cap closure — not an applicator, shown separately */}
                                                {hasCapClosure && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedApplicator("Cap/Closure");
                                                            setSelectedVariantId(null);
                                                            setSelectedCapColor(null);
                                                            setSelectedCapStyle(null);
                                                            setSelectedTrimColor(null);
                                                        }}
                                                        className={`px-4 py-2 text-sm font-medium border rounded-sm transition-all italic ${activeApplicator === "Cap/Closure"
                                                            ? "border-obsidian bg-obsidian text-white"
                                                            : "border-champagne/50 text-slate hover:border-muted-gold"
                                                            }`}
                                                    >
                                                        Cap Closure
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cap color selector */}
                                    {capColorOptions.length > 0 && (
                                        <div className="mb-6">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                                Cap Color
                                                {activeCapColor && (
                                                    <span className="ml-2 normal-case font-medium text-obsidian">{activeCapColor}</span>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-2.5">
                                                {capColorOptions.map((color) => {
                                                    const hex = COLOR_SWATCH[color] ?? GLASS_COLOR_SWATCH[color] ?? "#AAAAAA";
                                                    const isSelected = activeCapColor === color;
                                                    const useDarkCheck = LIGHT_SWATCHES.has(color);
                                                    return (
                                                        <button
                                                            key={color}
                                                            onClick={() => {
                                                                setSelectedVariantId(null);
                                                                setSelectedCapColor(color);
                                                                setSelectedCapStyle(null);
                                                                setSelectedTrimColor(null);
                                                            }}
                                                            title={color}
                                                            className={`w-9 h-9 rounded-full border-2 transition-all relative ${isSelected
                                                                ? "border-obsidian scale-110 shadow-md"
                                                                : "border-champagne hover:border-muted-gold"
                                                                }`}
                                                            style={{ backgroundColor: hex }}
                                                        >
                                                            {isSelected && (
                                                                <span className="absolute inset-0 flex items-center justify-center">
                                                                    <Check
                                                                        className={`w-3.5 h-3.5 ${useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                        strokeWidth={2.5}
                                                                    />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cap style selector — only when multiple options exist */}
                                    {capStyleOptions.length > 1 && (
                                        <div className="mb-6">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">Cap Style</p>
                                            <div className="flex flex-wrap gap-2">
                                                {capStyleOptions.map((style) => (
                                                    <button
                                                        key={style}
                                                        onClick={() => {
                                                            setSelectedVariantId(null);
                                                            setSelectedCapStyle(style);
                                                            setSelectedTrimColor(null);
                                                        }}
                                                        className={`px-4 py-2 text-sm font-medium border rounded-sm transition-all ${activeCapStyle === style
                                                            ? "border-obsidian bg-obsidian text-white"
                                                            : "border-champagne text-obsidian hover:border-muted-gold"
                                                            }`}
                                                    >
                                                        {style}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Trim selector — the decorative accent ring */}
                                    {showTrimSelector && (
                                        <div className="mb-8">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                                Trim
                                                {activeTrimColor && (
                                                    <span className="ml-2 normal-case font-medium text-obsidian">{activeTrimColor}</span>
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-2.5">
                                                {trimColorOptions.map((color) => {
                                                    const hex = COLOR_SWATCH[color] ?? "#AAAAAA";
                                                    const isSelected = activeTrimColor === color;
                                                    const useDarkCheck = LIGHT_SWATCHES.has(color);
                                                    return (
                                                        <button
                                                            key={color}
                                                            onClick={() => {
                                                                setSelectedVariantId(null);
                                                                setSelectedTrimColor(color);
                                                            }}
                                                            title={color}
                                                            className={`w-9 h-9 rounded-full border-2 transition-all relative ${isSelected
                                                                ? "border-obsidian scale-110 shadow-md"
                                                                : "border-champagne hover:border-muted-gold"
                                                                }`}
                                                            style={{ backgroundColor: hex }}
                                                        >
                                                            {isSelected && (
                                                                <span className="absolute inset-0 flex items-center justify-center">
                                                                    <Check
                                                                        className={`w-3.5 h-3.5 ${useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                        strokeWidth={2.5}
                                                                    />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Explicit SKU-level selector fallback when metadata is sparse */}
                                    {variantsForApplicator.length > 1 && (
                                        <div className="mb-6">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                                {activeApplicator ? "Cap Color / Variant (Preview)" : "Cap Finish"}
                                            </p>
                                            <div className="flex flex-wrap gap-3">
                                                {capSwatchPreview.map((item) => {
                                                    const isSelected = item.variantId
                                                        ? selectedVariant?._id === item.variantId
                                                        : selectedCapComponentSku === item.websiteSku;
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => {
                                                                if (item.variantId) {
                                                                    setSelectedVariantId(item.variantId);
                                                                    setSelectedCapComponentSku(null);
                                                                } else {
                                                                    setSelectedCapComponentSku(item.websiteSku);
                                                                }
                                                            }}
                                                            title={item.websiteSku}
                                                            className="flex flex-col items-center gap-1.5 group/variant"
                                                        >
                                                            <span
                                                                className={`w-10 h-10 rounded-full border-2 transition-all relative ${isSelected
                                                                    ? "border-obsidian scale-110 shadow-md"
                                                                    : "border-champagne group-hover/variant:border-muted-gold"
                                                                    }`}
                                                                style={{ backgroundColor: item.swatchHex }}
                                                            >
                                                                {isSelected && (
                                                                    <span className="absolute inset-0 flex items-center justify-center">
                                                                        <Check
                                                                            className={`w-3.5 h-3.5 ${item.useDarkCheck ? "text-obsidian" : "text-white"}`}
                                                                            strokeWidth={2.5}
                                                                        />
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <span
                                                                className={`text-[10px] leading-tight text-center max-w-[88px] ${isSelected
                                                                    ? "text-obsidian font-semibold"
                                                                    : "text-slate group-hover/variant:text-muted-gold"
                                                                    }`}
                                                            >
                                                                {item.displayLabel}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Quantity + Add to Cart */}
                            <div className="flex items-stretch space-x-3 mb-6">
                                <div className="flex items-center border border-champagne rounded-sm bg-white">
                                    <button
                                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                                        className="px-3.5 py-3 text-obsidian hover:text-muted-gold transition-colors border-r border-champagne"
                                        aria-label="Decrease quantity"
                                    >
                                        <span className="text-lg leading-none select-none">−</span>
                                    </button>
                                    <span className="px-4 text-sm font-semibold text-obsidian min-w-[44px] text-center">{qty}</span>
                                    <button
                                        onClick={() => setQty((q) => q + 1)}
                                        className="px-3.5 py-3 text-obsidian hover:text-muted-gold transition-colors border-l border-champagne"
                                        aria-label="Increase quantity"
                                    >
                                        <span className="text-lg leading-none select-none">+</span>
                                    </button>
                                </div>
                                <button
                                    disabled={!inStock || addedFlash}
                                    onClick={handleAddToCart}
                                    className={`flex-1 flex items-center justify-center space-x-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed ${
                                        addedFlash
                                            ? "bg-emerald-600 text-white"
                                            : "bg-obsidian text-white hover:bg-muted-gold disabled:opacity-40"
                                    }`}
                                >
                                    {addedFlash ? (
                                        <>
                                            <Check className="w-4 h-4" strokeWidth={2} />
                                            <span>Added!</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
                                            <span>{inStock ? "Add to Cart" : "Out of Stock"}</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* View All Compatible Components CTA */}
                            <button
                                onClick={() => setFitmentDrawerOpen(true)}
                                className="w-full mb-6 py-2.5 flex items-center justify-center space-x-2 border border-champagne text-obsidian text-xs font-semibold uppercase tracking-widest hover:border-muted-gold hover:text-muted-gold transition-colors bg-white"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-gold"></span>
                                <span>View All Compatible Components</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            {/* SKU info */}
                            {selectedVariant && (
                                <div className="text-xs text-slate/60 space-y-0.5 mb-8">
                                    <p><span className="font-semibold text-slate">SKU:</span> {selectedVariant.websiteSku}</p>
                                    {selectedVariant.graceSku && (
                                        <p><span className="font-semibold text-slate">Grace SKU:</span> {selectedVariant.graceSku}</p>
                                    )}
                                    {selectedVariant.caseQuantity && (
                                        <p><span className="font-semibold text-slate">Case Qty:</span> {selectedVariant.caseQuantity} units/case</p>
                                    )}
                                </div>
                            )}

                            {/* Volume pricing table */}
                            {selectedVariant?.webPrice1pc && (
                                <div className="bg-travertine border border-champagne/60 p-5 rounded-sm">
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate mb-4">Volume Pricing</p>
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-obsidian">1+ units</span>
                                            <span className="font-semibold text-obsidian">{formatPrice(selectedVariant.webPrice1pc)} each</span>
                                        </div>
                                        {selectedVariant.webPrice10pc && selectedVariant.webPrice10pc !== selectedVariant.webPrice1pc && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-obsidian">10+ units</span>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-semibold text-obsidian">{formatPrice(selectedVariant.webPrice10pc)} each</span>
                                                    <span className="text-[10px] text-emerald-600 font-bold uppercase bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                                        Save {Math.round((1 - selectedVariant.webPrice10pc / selectedVariant.webPrice1pc) * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {selectedVariant.webPrice12pc && selectedVariant.webPrice12pc !== selectedVariant.webPrice1pc && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-obsidian">12+ units</span>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-semibold text-obsidian">{formatPrice(selectedVariant.webPrice12pc)} each</span>
                                                    <span className="text-[10px] text-emerald-600 font-bold uppercase bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                                        Save {Math.round((1 - selectedVariant.webPrice12pc / selectedVariant.webPrice1pc) * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ── Inline Compatible Caps ───────────────────────────────── */}
                {inlineCaps.length > 0 && (
                    <section className="border-t border-champagne/30">
                        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs uppercase tracking-wider font-bold text-slate">Compatible Caps</p>
                                <button
                                    onClick={() => setFitmentDrawerOpen(true)}
                                    className="text-xs text-muted-gold hover:underline transition-colors"
                                >
                                    View all components →
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                {inlineCaps.slice(0, 6).map((comp) => (
                                    <ComponentCard key={comp.grace_sku} comp={comp} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Engineered Compatibility Carousel ────────────────────── */}
                {selectedVariant?.graceSku && (
                    <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
                        <FitmentCarousel
                            bottleSku={selectedVariant.graceSku}
                            onOpenDrawer={() => setFitmentDrawerOpen(true)}
                        />
                    </div>
                )}

                {/* ── Specs + Compatible Components ──────────────────────────── */}
                <section className="border-t border-champagne/50 bg-linen">
                    <div className="max-w-[1440px] mx-auto px-4 sm:px-6">

                        {/* Tab bar */}
                        <div className="flex border-b border-champagne/50 overflow-x-auto">
                            {(["specs", "components"] as const)
                                // Metal atomizers are standalone sealed units — no fitments, caps, or components
                                .filter((tab) => !(tab === "components" && group?.category === "Metal Atomizer"))
                                .map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 sm:px-8 py-4 sm:py-5 text-[10px] sm:text-xs uppercase tracking-wider font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab
                                        ? "border-obsidian text-obsidian"
                                        : "border-transparent text-slate hover:text-obsidian hover:border-champagne/60"
                                        }`}
                                >
                                    {tab === "specs"
                                        ? "Specifications"
                                        : `Components (${totalComponents})`}
                                </button>
                            ))}
                        </div>

                        <div className="py-10">
                            <AnimatePresence mode="wait">

                                {/* Specs Tab */}
                                {activeTab === "specs" && selectedVariant && (
                                    <motion.div
                                        key="specs"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.2 }}
                                        className="max-w-2xl"
                                    >
                                        <dl>
                                            <SpecRow label="Height (with cap)" value={selectedVariant.heightWithCap} />
                                            <SpecRow label="Height (without cap)" value={selectedVariant.heightWithoutCap} />
                                            <SpecRow label="Diameter" value={selectedVariant.diameter} />
                                            <SpecRow label="Neck Thread Size" value={selectedVariant.neckThreadSize} />
                                            <SpecRow label="Bottle Weight" value={selectedVariant.bottleWeightG ? `${selectedVariant.bottleWeightG}g` : null} />
                                            <SpecRow label="Case Quantity" value={selectedVariant.caseQuantity ? `${selectedVariant.caseQuantity} units/case` : null} />
                                            <SpecRow label="Capacity" value={selectedVariant.capacity} />
                                            <SpecRow label="Glass Color" value={selectedVariant.color} />
                                            <SpecRow label="Applicator" value={selectedVariant.applicator} />
                                            <SpecRow label="Ball Material" value={selectedVariant.ballMaterial} />
                                            <SpecRow label="Cap Style" value={selectedVariant.capStyle} />
                                            <SpecRow label="Cap Height" value={selectedVariant.capHeight} />
                                            <SpecRow label="Trim Finish" value={selectedVariant.trimColor} />
                                            <SpecRow label="Cap Color" value={selectedVariant.capColor} />
                                            <SpecRow label="Shape" value={selectedVariant.shape} />
                                            <SpecRow label="Assembly Type" value={selectedVariant.assemblyType} />
                                            <SpecRow label="Component Group" value={selectedVariant.componentGroup} />
                                            <SpecRow label="Category" value={selectedVariant.category} />
                                            <SpecRow label="Collection" value={selectedVariant.bottleCollection} />
                                        </dl>
                                        {(selectedVariant.graceDescription || selectedVariant.itemDescription) && (
                                            <div className="mt-8 pt-8 border-t border-champagne/50">
                                                <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">Description</p>
                                                <p className="text-sm text-obsidian/80 leading-relaxed">
                                                    {selectedVariant.graceDescription ?? selectedVariant.itemDescription}
                                                </p>
                                            </div>
                                        )}
                                        {selectedVariant.productUrl && (
                                            <div className="mt-6 pt-6 border-t border-champagne/50">
                                                <a
                                                    href={selectedVariant.productUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-sm font-semibold text-muted-gold hover:text-obsidian transition-colors"
                                                >
                                                    View on BestBottles.com
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Components Tab */}
                                {activeTab === "components" && (
                                    <motion.div
                                        key="components"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {totalComponents === 0 ? (
                                            <div className="text-center py-16">
                                                <Layers className="w-12 h-12 text-champagne mx-auto mb-4" strokeWidth={1} />
                                                <p className="text-sm text-slate">No compatible components on file for this variant.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-10">
                                                {COMPONENT_TYPE_ORDER.filter((t) => componentGroups[t]).map((type) => (
                                                    <div key={type}>
                                                        <div className="flex items-center space-x-3 mb-4">
                                                            <h3 className="text-xs uppercase tracking-wider font-bold text-slate">{type}</h3>
                                                            <span className="text-[10px] bg-bone border border-champagne/50 text-slate px-2 py-0.5 rounded-full font-medium">
                                                                {componentGroups[type].length} option{componentGroups[type].length !== 1 ? "s" : ""}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                                            {componentGroups[type].map((comp) => (
                                                                <ComponentCard key={comp.grace_sku} comp={comp} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </section>

                {/* Footer spacer */}
                <div className="h-32 bg-linen border-t border-champagne/30"></div>
            </div>

            {/* Mobile sticky purchase bar */}
            <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-champagne bg-bone/95 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),8px)]">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-slate font-semibold">From</p>
                        <p className="font-semibold text-obsidian truncate">
                            {formatPrice(selectedVariant?.webPrice1pc ?? group.priceRangeMin)}
                            <span className="text-xs text-slate ml-1">/ea</span>
                        </p>
                    </div>
                    <div className="flex items-center border border-champagne rounded-sm bg-white shrink-0">
                        <button
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                            className="px-3 py-2 text-obsidian border-r border-champagne"
                            aria-label="Decrease quantity"
                        >
                            −
                        </button>
                        <span className="px-3 text-sm font-semibold text-obsidian min-w-[36px] text-center">{qty}</span>
                        <button
                            onClick={() => setQty((q) => q + 1)}
                            className="px-3 py-2 text-obsidian border-l border-champagne"
                            aria-label="Increase quantity"
                        >
                            +
                        </button>
                    </div>
                    <button
                        disabled={!inStock || addedFlash}
                        onClick={handleAddToCart}
                        className={`flex-1 min-w-0 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                            addedFlash
                                ? "bg-emerald-600 text-white"
                                : "bg-obsidian text-white disabled:opacity-40"
                        }`}
                    >
                        {addedFlash ? "Added!" : inStock ? "Add to Cart" : "Out of Stock"}
                    </button>
                </div>
            </div>
        </main>
    );
}
