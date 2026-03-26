"use client";

import { useState, useEffect, useMemo, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ShoppingBag, ArrowLeft, ChevronRight, Package,
    Check, ExternalLink,
} from "@/components/icons";
import { motion } from "framer-motion";
/* eslint-disable @next/next/no-img-element */
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import FitmentDrawer from "@/components/FitmentDrawer";
import PdpGraceTrigger from "@/components/PdpGraceTrigger";
import { useCart } from "@/components/CartProvider";
import { APPLICATOR_BUCKETS } from "@/lib/catalogFilters";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import {
    PdpInlineBadges,
    PdpInlinePromo,
    PdpEditorialZone,
    type PdpBlock,
} from "@/components/PdpBlocks";
import PaperDollImage from "@/components/PaperDollImage";
import { analytics } from "@/lib/analytics";
import { SITE_URL, buildProductJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo";

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
    // Antique/vintage sprayer colors (often at start of itemName)
    if (name.startsWith("lavender")) return { label: "Lavender", swatchName: "Lavender" };
    if (name.startsWith("ivory gold")) return { label: "Ivory Gold", swatchName: "Shiny Gold" };
    if (name.startsWith("ivory silver")) return { label: "Ivory Silver", swatchName: "Shiny Silver" };
    if (name.startsWith("white")) return { label: "White", swatchName: "White" };
    if (name.startsWith("pink")) return { label: "Pink", swatchName: "Pink" };
    if (name.startsWith("red")) return { label: "Red", swatchName: "Red" };
    if (name.startsWith("black")) return { label: "Black", swatchName: "Black" };
    // Fine Mist Sprayer & Lotion Pump — "[Finish] Fine Mist Sprayer" or "[Finish] Lotion or treatment pump"
    if (name.startsWith("matte copper")) return { label: "Matte Copper", swatchName: "Matte Copper" };
    if (name.startsWith("shiny black")) return { label: "Shiny Black", swatchName: "Shiny Black" };
    if (name.startsWith("matte blue")) return { label: "Matte Blue", swatchName: "Blue" };
    if (name.startsWith("shiny gold")) return { label: "Shiny Gold", swatchName: "Shiny Gold" };
    if (name.startsWith("matte gold")) return { label: "Matte Gold", swatchName: "Matte Gold" };
    if (name.startsWith("matte silver")) return { label: "Matte Silver", swatchName: "Matte Silver" };
    if (name.startsWith("shiny silver")) return { label: "Shiny Silver", swatchName: "Shiny Silver" };
    if (name.startsWith("matte black")) return { label: "Matte Black", swatchName: "Matte Black" };
    if (name.startsWith("gold")) return { label: "Gold", swatchName: "Shiny Gold" };
    // Lotion pump with clear overcap (e.g. "Matte Silver Lotion or treatment pump with clear overcap")
    if (name.includes("with clear overcap")) {
        if (name.startsWith("matte silver")) return { label: "Matte Silver (Clear Overcap)", swatchName: "Matte Silver" };
        if (name.startsWith("matte gold")) return { label: "Matte Gold (Clear Overcap)", swatchName: "Matte Gold" };
    }
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
    "Lavender": "#E6E6FA",
    "Red": "#C41E3A",
    "Ivory Gold": "#D4AF37",
    "Ivory Silver": "#C8C8C8",
    "Standard": "#AAAAAA",
};

// Light swatches that need a dark checkmark
const LIGHT_SWATCHES = new Set(["White", "Shiny Silver", "Matte Silver", "Standard", "Pink", "Rose Gold", "Lavender", "Ivory Gold", "Ivory Silver"]);

// Glass bottle body color hex map — used for sibling color navigation swatches
const GLASS_COLOR_SWATCH: Record<string, string> = {
    "Clear":   "rgba(200, 235, 245, 0.55)",
    "Amber":   "#C8720A",
    "Frosted": "#D8D8D8",
    "Cobalt Blue": "#5B87B5",
    "Blue":    "#5B87B5",
    "Cobalt":  "#5B87B5",
    "Green":   "#6B9A6B",
    "Black":   "#1D1D1F",
    "Purple":  "#7B5EA7",
    "Pink":    "#F4A7B9",
    "White":   "#F5F5F0",
    "Swirl":   "#B8D4E3",
};
const LIGHT_GLASS = new Set(["Clear", "Frosted", "White", "Pink", "Swirl"]);

const ATOMIZER_SHELL_MAP: Record<string, { label: string; hex: string; light: boolean }> = {
    black:    { label: "Black",    hex: "#1D1D1F", light: false },
    blue:     { label: "Blue",     hex: "#5B87B5", light: false },
    gold:     { label: "Gold",     hex: "#D4AF37", light: false },
    red:      { label: "Red",      hex: "#CC2936", light: false },
    silver:   { label: "Silver",   hex: "#C8C8C8", light: true },
    pink:     { label: "Pink",     hex: "#F4A7B9", light: true },
    green:    { label: "Green",    hex: "#3A7D44", light: false },
    lavender: { label: "Lavender", hex: "#B57EDC", light: true },
};

function getAtomizerShellInfo(variant: { itemName?: string | null }): { label: string; hex: string; useDarkCheck: boolean } {
    const name = (variant.itemName ?? "").toLowerCase();
    const hasDots = name.includes("with dots") || name.includes("dot pattern");
    const hasStars = name.includes("star pattern") || name.includes("stars");
    const pattern = hasDots ? " · Dots" : hasStars ? " · Stars" : "";
    const shellToken = name.split(/\s+(slim\s+)?atomizer/)[0]?.trim() ?? "";
    const match = ATOMIZER_SHELL_MAP[shellToken];
    if (match) return { label: match.label + pattern, hex: match.hex, useDarkCheck: match.light };
    return { label: "Standard", hex: "#AAAAAA", useDarkCheck: true };
}

const ROLLON_APPLICATORS = new Set([
    "Metal Roller Ball",
    "Plastic Roller Ball",
    "Metal Roller",
    "Plastic Roller",
]);

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

// ── Main PDP ──────────────────────────────────────────────────────────────────

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const applicatorParam = searchParams.get("applicator");
    const qtyParam = Math.max(1, Math.min(9999, parseInt(searchParams.get("qty") ?? "1") || 1));

    const data = useQuery(api.products.getProductGroup, { slug });

    const { addItems } = useCart();
    const [fitmentDrawerOpen, setFitmentDrawerOpen] = useState(false);
    
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [selectedApplicator, setSelectedApplicator] = useState<string | null>(null);
    const [selectedCapColor, setSelectedCapColor] = useState<string | null>(null);
    const [selectedCapStyle, setSelectedCapStyle] = useState<string | null>(null);
    const [selectedTrimColor, setSelectedTrimColor] = useState<string | null>(null);
    const [selectedCapComponentSku, setSelectedCapComponentSku] = useState<string | null>(null);

    const [qty, setQty] = useState(qtyParam);
    const [addedFlash, setAddedFlash] = useState(false);
    const [pdpBlocks, setPdpBlocks] = useState<PdpBlock[]>([]);
    const [stickyBarVisible, setStickyBarVisible] = useState(false);
    const inlineCartRef = useRef<HTMLDivElement>(null);

    const group = data?.group;
    const variants = useMemo(() => (data?.variants as ProductVariant[] | undefined) ?? [], [data?.variants]);

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

    // Applicator siblings — same bottle shape + size + color, different applicator
    const applicatorSiblings = useQuery(
        api.products.getApplicatorSiblings,
        group
            ? {
                  family: group.family,
                  capacityMl: group.capacityMl ?? 0,
                  color: group.color ?? "",
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

    const activeApplicator = selectedApplicator && applicatorOptions.includes(selectedApplicator)
        ? selectedApplicator
        : defaultFromUrl ?? applicatorOptions[0] ?? (hasCapClosure ? "Cap/Closure" : null);
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

    // Cap swatches: only show actual buyable variants. Component-only options (compatible caps
    // from fitment data) are surfaced in the "Also Fits This Bottle" section and Fitment Drawer,
    // not here — they would show as selectable but wouldn't change add-to-cart behavior.
    const capSwatchPreview = useMemo(() => variantSwatchPreview, [variantSwatchPreview]);

    const showTrimSelector = useMemo(() => {
        if (trimColorOptions.length === 0) return false;
        if (trimColorOptions.length === 1 && trimColorOptions[0] === "Standard") return false;
        return true;
    }, [trimColorOptions]);

    // ── Roller type toggle for roll-on groups ─────────────────────────────────
    const isRollonGroup = slug.includes("rollon");
    const rollerTypeOptions = useMemo(() => {
        if (!isRollonGroup || applicatorOptions.length < 2) return [];
        // Normalize to "Metal" / "Plastic" labels
        return applicatorOptions.map((a) => ({
            value: a,
            label: /metal/i.test(a) ? "Metal Roller" : /plastic/i.test(a) ? "Plastic Roller" : a,
        }));
    }, [isRollonGroup, applicatorOptions]);

    // ── Dynamic SEO title ────────────────────────────────────────────────────
    useEffect(() => {
        if (group) {
            document.title = `${group.displayName} — ${group.family} ${group.capacity ?? ""} | Best Bottles`.replace(/\s+/g, " ");

            const desc = group.groupDescription
                ?? `${group.displayName} from the ${group.family} collection. ${group.capacity ?? ""} glass bottle. Wholesale pricing from Best Bottles.`.trim();
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement("meta");
                metaDesc.setAttribute("name", "description");
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute("content", desc);

            let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
            if (!linkCanonical) {
                linkCanonical = document.createElement("link");
                linkCanonical.setAttribute("rel", "canonical");
                document.head.appendChild(linkCanonical);
            }
            linkCanonical.href = `https://www.bestbottles.com/products/${slug}`;

            analytics.productViewed({
                name: group.displayName,
                family: group.family,
                capacity: group.capacity ?? "",
                color: group.color ?? "",
                neckThreadSize: group.neckThreadSize ?? undefined,
                price: group.priceRangeMin ?? undefined,
                slug,
            });
        }
        return () => { document.title = "Best Bottles"; };
    }, [group, slug]);

    // ── Bridge current PDP product data for global Grace widgets ────────────
    useEffect(() => {
        if (typeof window === "undefined") return;

        if (selectedVariant) {
            const globalWindow = window as Window & {
                __GRACE_PRODUCT_NAME__?: string;
                __GRACE_PRODUCT_SKU__?: string;
                __GRACE_THREAD_SIZE__?: string;
            };

            globalWindow.__GRACE_PRODUCT_NAME__ = group?.displayName ?? selectedVariant.itemName ?? "";
            globalWindow.__GRACE_PRODUCT_SKU__ = selectedVariant.graceSku ?? "";
            globalWindow.__GRACE_THREAD_SIZE__ = selectedVariant.neckThreadSize ?? "";
        }

        return () => {
            const globalWindow = window as Window & {
                __GRACE_PRODUCT_NAME__?: string;
                __GRACE_PRODUCT_SKU__?: string;
                __GRACE_THREAD_SIZE__?: string;
            };
            delete globalWindow.__GRACE_PRODUCT_NAME__;
            delete globalWindow.__GRACE_PRODUCT_SKU__;
            delete globalWindow.__GRACE_THREAD_SIZE__;
        };
    }, [group?.displayName, selectedVariant]);

    // ── Sanity two-tier content (family template + product override) ──────────
    useEffect(() => {
        if (!isSanityConfigured || !slug || !group?.family) return;
        let cancelled = false;
        Promise.all([
            client.fetch<{ pageBlocks?: PdpBlock[]; overrideTemplate?: boolean } | null>(
                `*[_type == "productGroupContent" && slug.current == $slug][0] { pageBlocks, overrideTemplate }`,
                { slug }
            ),
            client.fetch<{ pageBlocks?: PdpBlock[] } | null>(
                `*[_type == "productFamilyContent" && family == $family][0] { pageBlocks }`,
                { family: group.family }
            ),
        ])
            .then(([groupContent, familyContent]) => {
                if (cancelled) return;
                const groupBlocks: PdpBlock[] = groupContent?.pageBlocks ?? [];
                const familyBlocks: PdpBlock[] = familyContent?.pageBlocks ?? [];
                const merged = groupContent?.overrideTemplate
                    ? groupBlocks
                    : [...groupBlocks, ...familyBlocks];
                setPdpBlocks(merged);
            })
            .catch(() => { if (!cancelled) setPdpBlocks([]); });
        return () => { cancelled = true; };
    }, [slug, group?.family]);

    // ── Mobile sticky bar: only visible once inline Add to Cart scrolls out of view ──
    useEffect(() => {
        const el = inlineCartRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => setStickyBarVisible(!entry.isIntersecting),
            { threshold: 0 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // ── JSON-LD structured data ──────────────────────────────────────────────
    const jsonLd = useMemo(() => {
        if (!group || !selectedVariant) return null;
        return buildProductJsonLd({
            name: group.displayName,
            description: group.groupDescription
                ?? selectedVariant.itemDescription
                ?? `${group.displayName} — ${group.family} collection from Best Bottles. ${group.capacity ?? ""}`.trim(),
            sku: selectedVariant.websiteSku,
            image: selectedVariant.imageUrl ?? undefined,
            url: `${SITE_URL}/products/${slug}`,
            family: group.family,
            priceLow: selectedVariant.webPrice12pc ?? selectedVariant.webPrice10pc ?? selectedVariant.webPrice1pc,
            priceHigh: selectedVariant.webPrice1pc,
            inStock: selectedVariant.stockStatus === "In Stock",
            neckThreadSize: group.neckThreadSize ?? undefined,
            capacity: group.capacity ?? undefined,
        });
    }, [group, selectedVariant, slug]);

    const breadcrumbJsonLd = useMemo(() => {
        if (!group) return null;
        return buildBreadcrumbJsonLd([
            { name: "Home", url: SITE_URL },
            { name: "Catalog", url: `${SITE_URL}/catalog` },
            { name: group.family, url: `${SITE_URL}/catalog?family=${encodeURIComponent(group.family)}` },
            { name: group.displayName, url: `${SITE_URL}/products/${slug}` },
        ]);
    }, [group, slug]);

    // ── Loading state ────────────────────────────────────────────────────────

    if (data === undefined) {
        return (
            <main className="min-h-screen bg-bone">
                <Navbar hideMobileSearch />
                <div className="pt-[104px] sm:pt-[160px] lg:pt-[120px] flex items-center justify-center min-h-screen">
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
                <Navbar hideMobileSearch />
                <div className="pt-[104px] sm:pt-[160px] lg:pt-[120px] max-w-[1440px] mx-auto px-4 sm:px-6 py-32 text-center">
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
        analytics.cartItemAdded({
            sku: selectedVariant.graceSku,
            name: selectedVariant.itemName,
            quantity: qty,
            unitPrice: selectedVariant.webPrice1pc,
            family: group?.family,
            capacity: group?.capacity ?? undefined,
            source: "pdp",
        });
        setAddedFlash(true);
        setTimeout(() => setAddedFlash(false), 1800);
        // Auto-open the cart drawer
        window.dispatchEvent(new Event("open-cart-drawer"));
    };

    return (
        <main className="min-h-screen bg-bone">
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            {breadcrumbJsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
                />
            )}
            <Navbar hideMobileSearch />
            {selectedVariant?.graceSku && (
                <FitmentDrawer
                    isOpen={fitmentDrawerOpen}
                    onClose={() => setFitmentDrawerOpen(false)}
                    bottleSku={selectedVariant.graceSku}
                />
            )}

            <div className="pt-[104px] sm:pt-[160px] lg:pt-[120px]">
                {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
                <div className="border-b border-champagne/50 bg-bone overflow-x-auto">
                    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-1.5 sm:py-3 flex items-center space-x-2 text-[11px] sm:text-xs text-slate whitespace-nowrap">
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
                <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 sm:py-8 lg:py-16">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 lg:gap-20 items-start">

                        {/* ── Image Panel ──────────────────────────────────────────── */}
                        <div className="lg:sticky lg:top-[120px]">
                            <motion.div
                                key={selectedVariant?._id ?? "placeholder"}
                                initial={{ opacity: 0.6 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                                className="aspect-square bg-travertine rounded-none sm:rounded-sm border-0 sm:border border-champagne/50 flex items-center justify-center relative overflow-hidden"
                            >
                                {group.paperDollFamilyKey && selectedVariant ? (
                                    <PaperDollImage
                                        familyKey={group.paperDollFamilyKey}
                                        glassColor={group.color}
                                        applicator={selectedVariant.applicator}
                                        itemName={selectedVariant.itemName}
                                        fallbackImageUrl={selectedVariant.imageUrl}
                                        className="w-full h-full p-6 sm:p-12"
                                    />
                                ) : selectedVariant?.imageUrl ? (
                                    <img
                                        src={selectedVariant.imageUrl}
                                        alt={selectedVariant.itemName}
                                        className="w-full h-full object-contain p-6 sm:p-12"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center p-6 sm:p-12">
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
                        <div className="px-2 sm:px-0">
                            {/* Category · Family */}
                            <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-1 sm:mb-2">
                                {group.category} · {group.family}
                            </p>

                            {/* Title */}
                            <h1 className="font-serif text-xl sm:text-4xl lg:text-5xl font-medium text-obsidian leading-[1.1] mb-2 sm:mb-3">
                                {group.displayName}
                            </h1>

                            {/* Sanity trust badges */}
                            <PdpInlineBadges blocks={pdpBlocks} />

                            {/* Stock badge */}
                            <div className="flex items-center flex-wrap gap-2 mb-3 sm:mb-6">
                                <span className={`inline-flex items-center px-3 py-1 text-[11px] uppercase tracking-wider font-bold rounded-full ${inStock
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-red-50 text-red-600 border border-red-200"
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${inStock ? "bg-emerald-500" : "bg-red-400"}`}></span>
                                    {selectedVariant?.stockStatus ?? "Unknown"}
                                </span>
                            </div>

                            {/* Price */}
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-3 mb-4 sm:mb-8 pb-4 sm:pb-8 border-b border-champagne/50">
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

                            {/* ── Ask Grace (inline, un-intrusive) ───────────────────────────────────────── */}
                            <div className="mb-6 sm:mb-8">
                                <PdpGraceTrigger />
                            </div>

                            {/* ── Variant Selectors (hidden for atomizers — glass color is the only selection) ── */}

                            {!isAtomizer && (
                                <>
                                    {/* Roller type toggle — Metal vs Plastic for roll-on groups */}
                                    {rollerTypeOptions.length >= 2 && (
                                        <div className="mb-6">
                                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                                Roller Type
                                            </p>
                                            <div className="flex gap-2">
                                                {rollerTypeOptions.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => {
                                                            setSelectedApplicator(opt.value);
                                                            setSelectedVariantId(null);
                                                            setSelectedCapColor(null);
                                                            setSelectedCapStyle(null);
                                                            setSelectedTrimColor(null);
                                                        }}
                                                        className={`px-4 py-2 text-sm font-medium border rounded-sm transition-all ${
                                                            activeApplicator === opt.value
                                                                ? "border-obsidian bg-obsidian text-white"
                                                                : "border-champagne text-obsidian hover:border-muted-gold"
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
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
                                                {activeApplicator ? "Cap Color / Variant" : "Cap Finish"}
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

                            {/* ── Atomizer Shell Design selector ── */}
                            {isAtomizer && variantsForApplicator.length > 1 && (
                                <div className="mb-6">
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                        Shell Design
                                        {selectedVariant && (
                                            <span className="ml-2 normal-case font-medium text-obsidian">
                                                {getAtomizerShellInfo(selectedVariant).label}
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        {variantsForApplicator.map((v) => {
                                            const shell = getAtomizerShellInfo(v);
                                            const isSelected = selectedVariant?._id === v._id;
                                            return (
                                                <button
                                                    key={v._id}
                                                    onClick={() => setSelectedVariantId(v._id)}
                                                    title={v.websiteSku}
                                                    className="flex flex-col items-center gap-1.5 group/variant"
                                                >
                                                    <span
                                                        className={`w-10 h-10 rounded-full border-2 transition-all relative ${isSelected
                                                            ? "border-obsidian scale-110 shadow-md"
                                                            : "border-champagne group-hover/variant:border-muted-gold"
                                                            }`}
                                                        style={{ backgroundColor: shell.hex }}
                                                    >
                                                        {isSelected && (
                                                            <span className="absolute inset-0 flex items-center justify-center">
                                                                <Check
                                                                    className={`w-3.5 h-3.5 ${shell.useDarkCheck ? "text-obsidian" : "text-white"}`}
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
                                                        {shell.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Sanity promo banner (above Add to Cart) */}
                            <PdpInlinePromo blocks={pdpBlocks} />

                            {/* Quantity + Add to Cart */}
                            <div ref={inlineCartRef} className="flex items-stretch space-x-3 mb-6">
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

                            {/* Request a Quote CTA */}
                            <div className="mb-6">
                                <Link
                                    href={`/request-quote?products=${encodeURIComponent(`${selectedVariant?.itemName ?? group?.displayName ?? ''} (SKU: ${selectedVariant?.graceSku ?? ''})`)}&quantities=${encodeURIComponent(`${qty} units`)}`}
                                    className="w-full flex items-center justify-center space-x-2 py-3 border border-obsidian text-obsidian text-xs font-bold uppercase tracking-widest hover:bg-obsidian hover:text-white transition-colors"
                                >
                                    <span>Request a Quote</span>
                                </Link>
                            </div>

                            {/* Product Description — group-level copy preferred, then variant, skipped when Sanity rich desc exists */}
                            {pdpBlocks.every((b) => b._type !== "pdpRichDescription") && (group?.groupDescription || selectedVariant?.itemDescription) && (
                                <div className="mb-6 pt-5 border-t border-champagne/60">
                                    <p className="text-[9px] uppercase tracking-[0.18em] font-sans text-muted-gold mb-3">
                                        About This Product
                                    </p>
                                    <p className="font-serif text-[14.5px] text-obsidian leading-[1.75]">
                                        {group?.groupDescription ?? selectedVariant?.itemDescription}
                                    </p>
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

                {/* ── Sanity Editorial Zone (feature strip, gallery, FAQ, rich desc) ── */}
                <PdpEditorialZone blocks={pdpBlocks} />

                {/* ── "This Bottle Also Takes" — cross-compatible applicator siblings ── */}
                {applicatorSiblings && applicatorSiblings.length > 0 && (
                    <section className="border-t border-champagne/30">
                        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-[9px] uppercase tracking-[0.18em] font-sans text-muted-gold mb-1">Compatible Options</p>
                                    <h3 className="font-serif text-lg text-obsidian">This Bottle Also Takes</h3>
                                </div>
                                <button
                                    onClick={() => setFitmentDrawerOpen(true)}
                                    className="text-xs text-muted-gold hover:underline transition-colors"
                                >
                                    View all components →
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {applicatorSiblings.map((sib: { _id: string; slug: string; displayName: string; applicatorTypes?: string[]; heroImageUrl?: string | null; priceRangeMin?: number | null }) => {
                                    const applicatorLabel = (sib.applicatorTypes ?? []).join(", ") || "Cap & Closure";
                                    return (
                                        <Link
                                            key={sib._id}
                                            href={`/products/${sib.slug}`}
                                            className="group flex items-center gap-4 p-4 border border-champagne/50 rounded-sm bg-white hover:border-muted-gold transition-colors"
                                        >
                                            <div className="w-16 h-16 shrink-0 bg-travertine rounded-sm border border-champagne/30 flex items-center justify-center overflow-hidden">
                                                {sib.heroImageUrl ? (
                                                    <img src={sib.heroImageUrl} alt={sib.displayName} className="w-full h-full object-contain p-1" />
                                                ) : (
                                                    <Package className="w-6 h-6 text-champagne" strokeWidth={1} />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] uppercase tracking-wider text-muted-gold font-semibold mb-0.5">{applicatorLabel}</p>
                                                <p className="text-sm text-obsidian font-medium truncate group-hover:text-muted-gold transition-colors">{sib.displayName}</p>
                                                {sib.priceRangeMin != null && (
                                                    <p className="text-xs text-slate mt-0.5">From {formatPrice(sib.priceRangeMin)}</p>
                                                )}
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-champagne group-hover:text-muted-gold transition-colors shrink-0" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Specifications ──────────────────────────────────────────── */}
                {selectedVariant && (
                    <section className="border-t border-champagne/50 bg-linen">
                        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
                            <div className="flex border-b border-champagne/50">
                                <div className="px-4 sm:px-8 py-4 sm:py-5 text-[10px] sm:text-xs uppercase tracking-wider font-bold border-b-2 border-obsidian text-obsidian">
                                    Specifications
                                </div>
                            </div>
                            <div className="py-10 max-w-2xl">
                                <dl>
                                    <SpecRow label="SKU" value={selectedVariant.websiteSku} />
                                    {selectedVariant.graceSku && (
                                        <SpecRow label="Grace SKU" value={selectedVariant.graceSku} />
                                    )}
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
                            </div>
                        </div>
                    </section>
                )}

                {/* Footer spacer */}
                <div className="h-32 bg-linen border-t border-champagne/30"></div>
            </div>

            {/* Mobile sticky purchase bar — only appears once inline Add to Cart scrolls out of view (Baymard best practice) */}
            <div className={`lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-champagne bg-bone/95 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),8px)] transition-transform duration-300 ${stickyBarVisible ? "translate-y-0" : "translate-y-full"}`}>
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
