"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
    MagnifyingGlass as Search, X, Package, CaretDown as ChevronDown, CaretUp as ChevronUp,
    SlidersHorizontal, ArrowsDownUp as ArrowUpDown, SquaresFour as LayoutGrid, List, Plus, Minus, ShoppingCart, ChatCircle as MessageCircle, Sparkles,
} from "@/components/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import { useGrace } from "@/components/useGrace";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import {
    SORT_OPTIONS,
    APPLICATOR_BUCKETS,
    CAPACITY_RANGES,
    applicatorBucketMatchesProductValues,
    capacityInRange,
    type SortValue,
    type CatalogFilters,
    type ViewMode,
    EMPTY_FILTERS,
    classifyComponentType,
    filtersAreEmpty,
    activeFilterCount,
    filtersToParams,
    paramsToFilters,
    catalogSearchMatches,
    catalogSearchRecoverySuggestions,
    catalogSearchResultTieBreak,
    catalogSearchScore,
} from "@/lib/catalogFilters";
import { buildCanonicalProductGroup } from "@/lib/canonicalProduct";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_VISIBLE_LIMIT = 240;

const PACKAGING_ANSWER_BLOCKS = [
    {
        question: "What does neck size mean?",
        answer: "Neck size is the bottle opening and thread finish used to match a bottle with a compatible cap, reducer, sprayer, dropper, or roller. Treat matching neck sizes as the first fitment check, then verify the selected SKU before ordering.",
        href: "/resources#neck-size",
        gracePrompt: "Can you explain neck size and help me find bottles and applicators that match?",
    },
    {
        question: "How should I find a 10 ml roll-on bottle for perfume oil?",
        answer: "Start with the Roll-On applicator filter and small capacities around 6-15 ml, then compare neck size, roller style, cap finish, and case quantity on the product page before adding to cart.",
        href: "/catalog?applicators=rollon&search=10%20ml%20roll-on",
        gracePrompt: "I need a 10 ml roll-on bottle for perfume oil. Help me compare compatible options.",
    },
    {
        question: "Can I use any applicator with any bottle?",
        answer: "No. Applicators and closures need to be compatible with the bottle neck finish and the selected product configuration. If compatibility is not clearly shown, confirm it with Grace or the Best Bottles team before ordering.",
        href: "/catalog?applicators=rollon,finemist,dropper",
        gracePrompt: "Can you check applicator compatibility for the bottle I am considering?",
    },
    {
        question: "How many bottles come in a case?",
        answer: "Case quantity can vary by product and selected SKU. Use the product detail page for the specific bottle, color, size, and applicator configuration you plan to order.",
        href: "/catalog",
        gracePrompt: "Can you help me verify case quantity for a product before I order?",
    },
] as const;

// ─── Sanity Family Banner ─────────────────────────────────────────────────────

// Module-level cache so the Sanity query only runs once per session
const familyImageCache = new Map<string, string>();

function useFamilyBannerImage(family: string | null): string | null {
    const [imgUrl, setImgUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!family || !isSanityConfigured) return;
        const cached = familyImageCache.get(family);
        if (cached !== undefined) { setImgUrl(cached || null); return; } // eslint-disable-line react-hooks/set-state-in-effect -- early return from cache
        client
            .fetch<{ image?: { asset?: { _ref: string }; _type?: string } } | null>(
                `*[_type == "homepagePage"][0].designFamilyCards[family == $fam][0] { image }`,
                { fam: family }
            )
            .then((card) => {
                const url = card?.image ? urlFor(card.image) : "";
                familyImageCache.set(family, url);
                setImgUrl(url || null);
            })
            .catch(() => { familyImageCache.set(family, ""); });
    }, [family]);

    return imgUrl;
}

function FamilyBanner({ family }: { family: string }) {
    const imgUrl = useFamilyBannerImage(family);
    if (!imgUrl) return null;
    return (
        <div className="relative w-full h-40 sm:h-52 lg:h-60 rounded-sm overflow-hidden mb-6 sm:mb-8 -ml-0">
            <Image
                src={imgUrl}
                alt={family}
                fill
                className="object-cover object-center"
                unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-r from-obsidian/60 via-obsidian/20 to-transparent" />
            <div className="absolute bottom-5 left-6">
                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-white/70 mb-1">Design Family</p>
                <p className="font-serif text-2xl sm:text-3xl text-white font-medium">{family}</p>
            </div>
        </div>
    );
}

// Valid glass colors — only these appear in the Glass Color filter.
const COLOR_SWATCH_MAP: Record<string, string> = {
    Clear: "bg-white border border-champagne/60",
    Frosted: "bg-gradient-to-br from-white to-slate-200 border border-champagne/60",
    "Cobalt Blue": "bg-blue-800",
    Cobalt: "bg-blue-800",
    Amber: "bg-amber-600",
    Green: "bg-emerald-600",
    Swirl: "bg-gradient-to-br from-sky-100 to-slate-300 border border-champagne/60",
};

const CATEGORY_ORDER = [
    "Glass Bottle", "Cream Jar", "Lotion Bottle",
    "Component", "Cap/Closure", "Roll-On Cap", "Accessory",
    "Packaging Box", "Other",
];

// Design family order for catalog — bottles flow Cylinder → Elegant → Circle → Sleek, etc.
// Glass bottles first by family, then by capacity (small→big). Non-bottle categories at end.
const FAMILY_ORDER = [
    "Cylinder", "Elegant", "Circle", "Sleek", "Diva", "Empire", "Boston Round",
    "Slim", "Diamond", "Royal", "Round", "Square", "Rectangle", "Flair",
    "Tulip", "Queen", "Bell", "Swirl", "Grace",
];
// Categories that are "bottle" types — appear first in catalog order
const BOTTLE_CATEGORIES = new Set(["Glass Bottle", "Cream Jar", "Lotion Bottle"]);

const COMPONENT_CATEGORIES = new Set([
    "Component", "Cap/Closure", "Roll-On Cap", "Accessory",
    // Non-bottle, non-component categories that should not appear in Design Families
    "Packaging", "Packaging Supply", "Tool", "Gift Box", "Gift Bag",
]);

// ─── Types ───────────────────────────────────────────────────────────────────

interface CatalogGroup {
    _id: string;
    slug: string;
    displayName: string;
    family: string | null;
    capacity: string | null;
    capacityMl: number | null;
    color: string | null;
    rawColor?: string | null;
    canonicalColor?: string | null;
    canonicalColorOptions?: string[];
    dataQualityFlags?: string[];
    category: string;
    bottleCollection: string | null;
    neckThreadSize: string | null;
    variantCount: number;
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    heroImageUrl?: string | null;
    applicatorTypes?: string[] | null;
}

interface CatalogGroupPrimarySku {
    groupId: string;
    websiteSku: string | null;
    graceSku: string | null;
}

interface Facets {
    categories: Record<string, number>;
    collections: Record<string, number>;
    applicators: Record<string, number>;
    families: Record<string, number>;
    colors: Record<string, number>;
    capacities: Record<string, { label: string; ml: number | null; count: number }>;
    neckThreadSizes: Record<string, number>;
    componentTypes: Record<string, number>;
    priceRange: { min: number; max: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
    if (!price) return "—";
    return `$${price.toFixed(2)}`;
}

function formatCatalogSpec(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === "" || value === "0 ml (0 oz)") return "—";
    return String(value);
}

function formatApplicatorLabels(applicators: string[] | null | undefined): string {
    const values = (applicators ?? []).filter((value) => value && value !== "Cap/Closure");
    if (values.length === 0) return "—";
    return values.slice(0, 2).join(", ") + (values.length > 2 ? ` +${values.length - 2}` : "");
}

function buildCatalogFaqJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: PACKAGING_ANSWER_BLOCKS.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
            },
        })),
    };
}

function clampVisibleLimit(rawLimit: string | null): number {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed <= PAGE_SIZE) return PAGE_SIZE;
    return Math.min(Math.ceil(parsed / PAGE_SIZE) * PAGE_SIZE, MAX_VISIBLE_LIMIT);
}

function countBy<T>(arr: T[], keyFn: (item: T) => string | null | undefined): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of arr) {
        const key = keyFn(item);
        if (key) counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}

// ─── URL Serialization ──────────────────────────────────────────────────────

// ─── Skeleton Components ─────────────────────────────────────────────────────

function SkeletonCard() {
    return (
        <div className="flex flex-col h-full bg-white rounded-sm border border-champagne/40 overflow-hidden animate-pulse">
            <div className="aspect-[10/11] bg-champagne/20 w-full" />
            <div className="p-5 flex flex-col flex-1">
                <div className="h-5 w-3/4 bg-champagne/30 rounded mb-2" />
                <div className="h-5 w-1/2 bg-champagne/30 rounded mb-3" />
                <div className="h-6 w-24 bg-champagne/30 rounded mt-auto" />
            </div>
        </div>
    );
}

function SkeletonGrid() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

// ─── Product Group Card ──────────────────────────────────────────────────────

function ProductGroupCard({ group, index, applicatorParam }: { group: CatalogGroup; index: number; applicatorParam?: string | null }) {
    const href = applicatorParam ? `/products/${group.slug}?applicator=${applicatorParam}` : `/products/${group.slug}`;
    const cardSpecs = [
        { label: "Size", value: formatCatalogSpec(group.capacity) },
        { label: "Color", value: formatCatalogSpec(group.color) },
        { label: "Neck", value: formatCatalogSpec(group.neckThreadSize) },
        { label: "Fitment", value: formatApplicatorLabels(group.applicatorTypes) },
    ];

    return (
        <Link href={href}>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.3) }}
                className="group cursor-pointer flex flex-col h-full bg-white rounded-sm border border-champagne/40 overflow-hidden hover:border-muted-gold hover:shadow-lg transition-all duration-300"
            >
                <div className="relative aspect-[10/11] bg-[#efe2d0] w-full overflow-hidden flex items-center justify-center">
                    {group.heroImageUrl ? (
                        <Image
                            src={group.heroImageUrl}
                            alt={group.displayName}
                            fill
                            className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            unoptimized
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                            <Package className="w-12 h-12 text-champagne mb-3" strokeWidth={1} />
                            <p className="text-[10px] text-slate/60 uppercase tracking-wider font-medium leading-tight max-w-[120px]">
                                {group.family}
                            </p>
                        </div>
                    )}

                    {group.variantCount > 1 && (
                        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-sm bg-obsidian/60 text-white">
                                {group.variantCount} variants
                            </span>
                        </div>
                    )}
                </div>

                <div className="p-5 flex flex-col flex-1">
                    <h4 className="font-serif text-lg text-obsidian font-medium leading-snug line-clamp-2 mb-3">{group.displayName}</h4>
                    <dl data-testid="catalog-card-specs" className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4 text-[11px]">
                        {cardSpecs.map((spec) => (
                            <div key={spec.label} className="min-w-0">
                                <dt className="text-slate/60 uppercase tracking-[0.14em] font-bold">{spec.label}</dt>
                                <dd className="truncate text-obsidian/80">{spec.value}</dd>
                            </div>
                        ))}
                    </dl>
                    <span className="font-semibold text-obsidian text-lg mt-auto">from {formatPrice(group.priceRangeMin)}/ea</span>
                </div>
            </motion.div>
        </Link>
    );
}

// ─── Collapsible Filter Section ──────────────────────────────────────────────

function FilterSection({
    title,
    defaultOpen = false,
    expanded,
    onToggle,
    hasActiveFilters = false,
    children,
}: {
    title: string;
    defaultOpen?: boolean;
    expanded?: boolean;
    onToggle?: () => void;
    hasActiveFilters?: boolean;
    children: React.ReactNode;
}) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = expanded ?? internalOpen;
    const toggle = onToggle ?? (() => setInternalOpen((p) => !p));
    const showGlow = hasActiveFilters && !isOpen;

    return (
        <div className={`border-b border-champagne/30 pb-4 mb-4 rounded-lg px-2 -mx-2 transition-all duration-200 ${showGlow ? "ring-1 ring-muted-gold/50 ring-offset-2 ring-offset-bone bg-muted-gold/5" : ""}`}>
            <button
                onClick={toggle}
                className="flex min-h-11 items-center justify-between w-full text-xs uppercase tracking-wider font-bold text-slate hover:text-obsidian transition-colors py-2"
                aria-expanded={isOpen}
            >
                <span className={hasActiveFilters ? "text-muted-gold font-semibold" : ""}>{title}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-3">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Checkbox Filter Item ────────────────────────────────────────────────────

function CheckboxItem({
    label,
    count,
    checked,
    onChange,
    swatch,
}: {
    label: string;
    count?: number;
    checked: boolean;
    onChange: () => void;
    swatch?: string;
}) {
    return (
        <label className="flex min-h-11 items-center gap-2.5 py-2 cursor-pointer group/check">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="w-4 h-4 rounded border-champagne text-muted-gold focus:ring-muted-gold/30 cursor-pointer"
            />
            {swatch && (
                <span className={`w-4 h-4 rounded-full shrink-0 ${swatch}`} />
            )}
            <span className={`text-[13px] flex-1 transition-colors ${checked ? "text-muted-gold font-semibold" : "text-obsidian/70 group-hover/check:text-obsidian"}`}>
                {label}
            </span>
            {count !== undefined && (
                <span className="text-[11px] text-slate/60">{count}</span>
            )}
        </label>
    );
}

// ─── Price Range Slider ──────────────────────────────────────────────────────

function PriceRangeSlider({
    min,
    max,
    valueMin,
    valueMax,
    onChange,
}: {
    min: number;
    max: number;
    valueMin: number | null;
    valueMax: number | null;
    onChange: (min: number | null, max: number | null) => void;
}) {
    const effectiveMin = valueMin ?? min;
    const effectiveMax = valueMax ?? max;
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleChange = (newMin: number, newMax: number) => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const isDefault = newMin <= min && newMax >= max;
            onChange(isDefault ? null : newMin, isDefault ? null : newMax);
        }, SEARCH_DEBOUNCE_MS);
    };

    if (min >= max) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-[12px] text-obsidian font-medium">
                <span>{formatPrice(effectiveMin)}</span>
                <span>{formatPrice(effectiveMax)}</span>
            </div>
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate w-8">Min</span>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.01}
                        value={effectiveMin}
                        onChange={(e) => handleChange(Number(e.target.value), effectiveMax)}
                        className="flex-1 h-1.5 accent-muted-gold cursor-pointer"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate w-8">Max</span>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.01}
                        value={effectiveMax}
                        onChange={(e) => handleChange(effectiveMin, Number(e.target.value))}
                        className="flex-1 h-1.5 accent-muted-gold cursor-pointer"
                    />
                </div>
            </div>
            {(valueMin !== null || valueMax !== null) && (
                <button
                    onClick={() => onChange(null, null)}
                    className="text-[11px] text-muted-gold hover:text-obsidian transition-colors"
                >
                    Reset price range
                </button>
            )}
        </div>
    );
}

// ─── Filter Sidebar Content ─────────────────────────────────────────────────

function FilterSidebarContent({
    facets,
    taxonomy,
    filters,
    totalCount,
    expandedCategories,
    toggleCategory,
    onFilterChange,
    onClearAll,
}: {
    facets: Facets | null;
    taxonomy: Record<string, Record<string, number>> | null;
    filters: CatalogFilters;
    totalCount: number;
    expandedCategories: Record<string, boolean>;
    toggleCategory: (cat: string) => void;
    onFilterChange: (patch: Partial<CatalogFilters>) => void;
    onClearAll: () => void;
}) {
    const isComponentCategory = filters.category ? COMPONENT_CATEGORIES.has(filters.category) : false;

    const toggleArrayFilter = (key: keyof CatalogFilters, value: string) => {
        const current = filters[key] as string[];
        const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        onFilterChange({ [key]: next });
    };

    const sidebarCategories = useMemo(() => {
        if (!taxonomy) return [];
        return CATEGORY_ORDER
            .filter((cat) => taxonomy[cat])
            .map((cat) => ({
                category: cat,
                collections: Object.entries(taxonomy[cat])
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([name, count]) => ({ name, count: count as number })),
                totalCount: Object.values(taxonomy[cat]).reduce((sum, c) => sum + (c as number), 0),
            }));
    }, [taxonomy]);

    const sortedCapacities = useMemo(() => {
        if (!facets) return [];
        return Object.values(facets.capacities).sort((a, b) => (a.ml ?? 9999) - (b.ml ?? 9999));
    }, [facets]);

    const capacityRanges = useMemo(() => {
        return CAPACITY_RANGES.map((range) => {
            const capacities = sortedCapacities.filter((cap) => capacityInRange(cap.ml, range));
            const selectedCount = capacities.filter((cap) => filters.capacities.includes(cap.label)).length;
            return {
                ...range,
                capacities,
                count: capacities.reduce((sum, cap) => sum + cap.count, 0),
                checked: capacities.length > 0 && selectedCount === capacities.length,
                partiallyChecked: selectedCount > 0 && selectedCount < capacities.length,
            };
        }).filter((range) => range.capacities.length > 0);
    }, [filters.capacities, sortedCapacities]);

    const sortedColors = useMemo(() => {
        if (!facets) return [];
        return Object.entries(facets.colors).sort(([, a], [, b]) => b - a);
    }, [facets]);

    const sortedThreads = useMemo(() => {
        if (!facets) return [];
        // Valid thread sizes match patterns like "18-415", "20-400", "13-415", "16mm"
        // Filter out anomalous values like "Ground", "Plug", "PRESS-FIT", "snap", "SPECIAL", garbled SKUs
        const VALID_THREAD_PATTERN = /^\d{1,3}[-/]\d{3,4}$|^\d{1,3}mm$/i;
        return Object.entries(facets.neckThreadSizes)
            .filter(([thread]) => VALID_THREAD_PATTERN.test(thread))
            .sort(([a], [b]) => {
                const na = parseFloat(a);
                const nb = parseFloat(b);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return a.localeCompare(b);
            });
    }, [facets]);

    const sortedFamilies = useMemo(() => {
        if (!facets) return [];
        return Object.entries(facets.families).sort(([a], [b]) => a.localeCompare(b));
    }, [facets]);

    const sortedComponentTypes = useMemo(() => {
        if (!facets) return [];
        return Object.entries(facets.componentTypes).sort(([, a], [, b]) => b - a);
    }, [facets]);

    const toggleCapacityRange = (labels: string[]) => {
        const selected = new Set(filters.capacities);
        const allSelected = labels.every((label) => selected.has(label));
        for (const label of labels) {
            if (allSelected) selected.delete(label);
            else selected.add(label);
        }
        onFilterChange({ capacities: [...selected] });
    };

    return (
        <>
            <h3 className="font-serif text-xl text-obsidian border-b border-champagne pb-3 mb-6">Browse</h3>

            <button
                onClick={onClearAll}
                className={`block min-h-11 text-left text-sm transition-colors w-full mb-6 py-2 border-b border-champagne/30 ${filtersAreEmpty(filters) ? "text-muted-gold font-semibold" : "text-obsidian hover:text-muted-gold"}`}
            >
                All Products ({totalCount.toLocaleString()})
            </button>

            {/* Applicator Type — Option A, top for bottles */}
            {Object.keys(facets?.applicators ?? {}).length > 0 && (
                <FilterSection title="Applicator Type" defaultOpen hasActiveFilters={filters.applicators.length > 0}>
                    <div className="space-y-0.5">
                        {APPLICATOR_BUCKETS.filter((b) => (facets?.applicators?.[b.value] ?? 0) > 0).map((bucket) => (
                            <CheckboxItem
                                key={bucket.value}
                                label={bucket.label}
                                count={facets?.applicators?.[bucket.value]}
                                checked={filters.applicators.includes(bucket.value)}
                                onChange={() => toggleArrayFilter("applicators", bucket.value)}
                            />
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Design Families — open by default */}
            {sortedFamilies.length > 0 && (
                <FilterSection title="Design Families" defaultOpen hasActiveFilters={filters.families.length > 0}>
                    <div className="space-y-0.5 max-h-[280px] overflow-y-auto hide-scroll">
                        {sortedFamilies.map(([fam, count]) => (
                            <CheckboxItem
                                key={fam}
                                label={fam}
                                count={count}
                                checked={filters.families.includes(fam)}
                                onChange={() => toggleArrayFilter("families", fam)}
                            />
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Capacity — open by default */}
            {capacityRanges.length > 0 && (
                <FilterSection title="Capacity" defaultOpen hasActiveFilters={filters.capacities.length > 0}>
                    <div className="space-y-0.5">
                        {capacityRanges.map((range) => (
                            <CheckboxItem
                                key={range.value}
                                label={`${range.label} — ${range.detail}`}
                                count={range.count}
                                checked={range.checked}
                                onChange={() => toggleCapacityRange(range.capacities.map((cap) => cap.label))}
                            />
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Color — closed by default */}
            {sortedColors.length > 0 && (
                <FilterSection title="Glass Color" defaultOpen={false} hasActiveFilters={filters.colors.length > 0}>
                    <div className="space-y-0.5 max-h-[240px] overflow-y-auto hide-scroll">
                        {sortedColors.map(([color, count]) => (
                            <CheckboxItem
                                key={color}
                                label={color}
                                count={count}
                                checked={filters.colors.includes(color)}
                                onChange={() => toggleArrayFilter("colors", color)}
                                swatch={COLOR_SWATCH_MAP[color] ?? "bg-slate-300"}
                            />
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Category + Collection Tree — closed by default */}
            <FilterSection title="Categories" defaultOpen={false} hasActiveFilters={!!(filters.category || filters.collection)}>
                {sidebarCategories.map((group) => (
                    <div key={group.category} className="mb-2">
                        <button
                            onClick={() => toggleCategory(group.category)}
                            className="flex items-center justify-between w-full text-xs uppercase tracking-wider font-bold text-slate mb-2 hover:text-obsidian transition-colors"
                        >
                            <span>{group.category} ({group.totalCount})</span>
                            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedCategories[group.category] !== false ? "rotate-0" : "-rotate-90"}`} />
                        </button>
                        <AnimatePresence>
                            {expandedCategories[group.category] !== false && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-1 border-l border-champagne ml-2 pl-4 mb-4">
                                        <button
                                            onClick={() => onFilterChange({ category: filters.category === group.category ? null : group.category, collection: null })}
                                            className={`block min-h-11 text-left text-[13px] transition-colors w-full py-2 ${filters.category === group.category && !filters.collection ? "text-muted-gold font-semibold" : "text-obsidian/70 hover:text-muted-gold"}`}
                                        >
                                            All {group.category} ({group.totalCount})
                                        </button>
                                        {group.collections.map((col) => (
                                            <button
                                                key={col.name}
                                                onClick={() => onFilterChange({ collection: filters.collection === col.name ? null : col.name, category: null })}
                                                className={`block min-h-11 text-left text-[13px] transition-colors w-full py-2 ${filters.collection === col.name ? "text-muted-gold font-semibold" : "text-obsidian/70 hover:text-muted-gold"}`}
                                            >
                                                {col.name} ({col.count})
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </FilterSection>

            {/* Component Type (contextual) */}
            {isComponentCategory && sortedComponentTypes.length > 0 && (
                <FilterSection title="Component Type" defaultOpen={false} hasActiveFilters={!!filters.componentType}>
                    <div className="space-y-0.5">
                        {sortedComponentTypes.map(([type, count]) => (
                            <button
                                key={type}
                                onClick={() => onFilterChange({ componentType: filters.componentType === type ? null : type })}
                                className={`block min-h-11 text-left text-[13px] transition-colors w-full py-2 ${filters.componentType === type ? "text-muted-gold font-semibold" : "text-obsidian/70 hover:text-muted-gold"}`}
                            >
                                {type} ({count})
                            </button>
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Neck Thread Size — closed by default */}
            {sortedThreads.length > 0 && (
                <FilterSection title="Neck Thread Size" defaultOpen={false} hasActiveFilters={filters.neckThreadSizes.length > 0}>
                    <div className="space-y-0.5 max-h-[200px] overflow-y-auto hide-scroll">
                        {sortedThreads.map(([thread, count]) => (
                            <CheckboxItem
                                key={thread}
                                label={thread}
                                count={count}
                                checked={filters.neckThreadSizes.includes(thread)}
                                onChange={() => toggleArrayFilter("neckThreadSizes", thread)}
                            />
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Price Range — closed by default */}
            {facets && facets.priceRange.min < facets.priceRange.max && (
                <FilterSection title="Price Range" defaultOpen={false} hasActiveFilters={filters.priceMin !== null || filters.priceMax !== null}>
                    <PriceRangeSlider
                        min={facets.priceRange.min}
                        max={facets.priceRange.max}
                        valueMin={filters.priceMin}
                        valueMax={filters.priceMax}
                        onChange={(min, max) => onFilterChange({ priceMin: min, priceMax: max })}
                    />
                </FilterSection>
            )}
        </>
    );
}

function CatalogAnswerBlocks({
    onAskGrace,
}: {
    onAskGrace: (prompt: string) => void;
}) {
    return (
        <section
            className="mb-5 sm:mb-8 rounded-xl border border-champagne/50 bg-white/80 p-4 sm:p-5"
            aria-labelledby="catalog-answer-blocks-heading"
            data-testid="catalog-answer-blocks"
        >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-gold font-bold mb-1">
                        Packaging Answers
                    </p>
                    <h2 id="catalog-answer-blocks-heading" className="font-serif text-xl sm:text-2xl text-obsidian font-medium">
                        Quick answers before you choose
                    </h2>
                </div>
                <p className="text-xs text-slate max-w-md">
                    Crawlable guidance for common packaging decisions, with Grace ready when fitment depends on a specific product.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {PACKAGING_ANSWER_BLOCKS.map((item) => (
                    <article key={item.question} className="rounded-lg border border-champagne/40 bg-bone/50 p-4 flex flex-col min-h-[220px]">
                        <h3 className="font-serif text-lg leading-snug text-obsidian mb-2">{item.question}</h3>
                        <p className="text-xs leading-relaxed text-slate mb-4">{item.answer}</p>
                        <div className="mt-auto flex flex-col gap-2">
                            <Link
                                href={item.href}
                                className="inline-flex min-h-11 items-center justify-center rounded-sm border border-champagne bg-white px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-obsidian hover:border-muted-gold hover:text-muted-gold transition-colors"
                            >
                                Explore products
                            </Link>
                            <button
                                type="button"
                                onClick={() => onAskGrace(item.gracePrompt)}
                                className="inline-flex min-h-11 items-center justify-center rounded-sm bg-obsidian px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-white hover:bg-muted-gold transition-colors"
                                data-testid="catalog-answer-grace-cta"
                            >
                                Ask Grace
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

// ─── View Toggle ─────────────────────────────────────────────────────────────

function ViewToggle({
    value,
    onChange,
}: {
    value: ViewMode;
    onChange: (v: ViewMode) => void;
}) {
    return (
        <div className="inline-flex items-center bg-white border border-champagne rounded-lg p-0.5">
            <button
                onClick={() => onChange("visual")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${value === "visual"
                    ? "bg-obsidian text-white"
                    : "text-slate hover:text-obsidian"
                    }`}
                aria-label="Visual grid view"
            >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Visual</span>
            </button>
            <button
                onClick={() => onChange("line")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${value === "line"
                    ? "bg-obsidian text-white"
                    : "text-slate hover:text-obsidian"
                    }`}
                aria-label="Line item view"
            >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Line Items</span>
            </button>
        </div>
    );
}

// ─── Line Item Row (Desktop) ─────────────────────────────────────────────────

function LineItemRow({
    group,
    sku,
    index,
    applicatorParam,
}: {
    group: CatalogGroup;
    sku: string;
    index: number;
    applicatorParam?: string | null;
}) {
    const [quantity, setQuantity] = useState(1);
    const href = (() => {
        const params = new URLSearchParams();
        if (applicatorParam) params.set("applicator", applicatorParam);
        if (quantity > 1) params.set("qty", String(quantity));
        const qs = params.toString();
        return `/products/${group.slug}${qs ? `?${qs}` : ""}`;
    })();

    const incrementQty = () => setQuantity((q) => Math.min(q + 1, 9999));
    const decrementQty = () => setQuantity((q) => Math.max(q - 1, 1));

    return (
        <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(index * 0.02, 0.3) }}
            className="border-b border-champagne/30 hover:bg-travertine/50 transition-colors group"
        >
            {/* Image + Name */}
            <td className="py-3 px-4">
                <Link href={href} className="flex items-center gap-4">
                    <div className="w-14 h-14 shrink-0 bg-travertine rounded border border-champagne/40 flex items-center justify-center overflow-hidden relative">
                        {group.heroImageUrl ? (
                            <Image
                                src={group.heroImageUrl}
                                alt={group.displayName}
                                fill
                                className="object-contain p-1"
                                sizes="56px"
                                unoptimized
                            />
                        ) : (
                            <Package className="w-6 h-6 text-champagne" strokeWidth={1} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-muted-gold uppercase tracking-wider font-bold mb-0.5">
                            {group.category}
                        </p>
                        <p className="font-serif text-sm text-obsidian font-medium leading-snug group-hover:text-muted-gold transition-colors truncate max-w-[280px]">
                            {group.displayName}
                        </p>
                        {group.family && (
                            <p className="text-[10px] text-slate">{group.family}</p>
                        )}
                    </div>
                </Link>
            </td>

            {/* Capacity */}
            <td className="py-3 px-4 text-left">
                <span className="text-xs text-obsidian font-mono">{sku}</span>
            </td>

            {/* Capacity */}
            <td className="py-3 px-4 text-center">
                <span className="text-xs text-obsidian">
                    {group.capacity && group.capacity !== "0 ml (0 oz)" ? group.capacity : "—"}
                </span>
            </td>

            {/* Color */}
            <td className="py-3 px-4 text-center">
                <span className="text-xs text-obsidian">{group.color || "—"}</span>
            </td>

            {/* Thread */}
            <td className="py-3 px-4 text-center">
                <span className="text-xs text-obsidian">{group.neckThreadSize || "—"}</span>
            </td>

            {/* Variants */}
            <td className="py-3 px-4 text-center">
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full bg-obsidian/10 text-obsidian">
                    {group.variantCount}
                </span>
            </td>

            {/* Price */}
            <td className="py-3 px-4 text-right">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-slate">from</span>
                    <span className="font-semibold text-obsidian">
                        {group.priceRangeMin ? `$${group.priceRangeMin.toFixed(2)}` : "—"}
                    </span>
                </div>
            </td>

            {/* Actions */}
            <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                    <div className="flex items-center border border-champagne rounded-lg bg-white">
                        <button
                            onClick={decrementQty}
                            className="min-h-11 min-w-11 flex items-center justify-center hover:bg-travertine transition-colors rounded-l-lg"
                            aria-label="Decrease quantity"
                        >
                            <Minus className="w-3 h-3 text-slate" />
                        </button>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
                            className="w-10 text-center text-xs font-medium text-obsidian bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={1}
                            max={9999}
                        />
                        <button
                            onClick={incrementQty}
                            className="min-h-11 min-w-11 flex items-center justify-center hover:bg-travertine transition-colors rounded-r-lg"
                            aria-label="Increase quantity"
                        >
                            <Plus className="w-3 h-3 text-slate" />
                        </button>
                    </div>
                    <Link
                        href={href}
                        className="px-3 py-1.5 bg-obsidian text-white text-[10px] uppercase font-bold tracking-wider rounded hover:bg-muted-gold transition-colors flex items-center gap-1"
                    >
                        <ShoppingCart className="w-3 h-3" />
                        View
                    </Link>
                </div>
            </td>
        </motion.tr>
    );
}

// ─── Line Item Mobile Card ───────────────────────────────────────────────────

function LineItemMobileCard({
    group,
    sku,
    index,
    applicatorParam,
}: {
    group: CatalogGroup;
    sku: string;
    index: number;
    applicatorParam?: string | null;
}) {
    const [expanded, setExpanded] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const href = (() => {
        const params = new URLSearchParams();
        if (applicatorParam) params.set("applicator", applicatorParam);
        if (quantity > 1) params.set("qty", String(quantity));
        const qs = params.toString();
        return `/products/${group.slug}${qs ? `?${qs}` : ""}`;
    })();

    const incrementQty = () => setQuantity((q) => Math.min(q + 1, 9999));
    const decrementQty = () => setQuantity((q) => Math.max(q - 1, 1));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(index * 0.02, 0.3) }}
            className="bg-white border border-champagne/40 rounded-lg overflow-hidden"
        >
            <div className="flex items-center p-3 gap-3">
                {/* Thumbnail */}
                <div className="w-14 h-14 shrink-0 bg-travertine rounded border border-champagne/40 flex items-center justify-center overflow-hidden relative">
                    {group.heroImageUrl ? (
                        <Image
                            src={group.heroImageUrl}
                            alt={group.displayName}
                            fill
                            className="object-contain p-1"
                            sizes="56px"
                            unoptimized
                        />
                    ) : (
                        <Package className="w-6 h-6 text-champagne" strokeWidth={1} />
                    )}
                </div>

                {/* Core Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-muted-gold uppercase tracking-wider font-bold">
                        {group.category}
                    </p>
                    <Link href={href}>
                        <p className="font-serif text-sm text-obsidian font-medium leading-tight truncate hover:text-muted-gold transition-colors">
                            {group.displayName}
                        </p>
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate font-mono bg-bone px-1.5 py-0.5 rounded">
                            {sku}
                        </span>
                        <span className="text-xs font-semibold text-obsidian">
                            {group.priceRangeMin ? `$${group.priceRangeMin.toFixed(2)}` : "—"}
                        </span>
                        <span className="text-[10px] text-slate bg-bone px-1.5 py-0.5 rounded">
                            {group.variantCount} variant{group.variantCount !== 1 ? "s" : ""}
                        </span>
                    </div>
                </div>

                {/* Expand Toggle */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="p-2 rounded-lg hover:bg-travertine transition-colors"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Collapse details" : "Expand details"}
                >
                    <ChevronDown
                        className={`w-4 h-4 text-slate transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                </button>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 pt-1 border-t border-champagne/30">
                            {/* Specs Grid */}
                            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                                <div className="bg-bone rounded px-2 py-1.5">
                                    <p className="text-[9px] text-slate uppercase tracking-wider mb-0.5">Capacity</p>
                                    <p className="text-xs text-obsidian font-medium">
                                        {group.capacity && group.capacity !== "0 ml (0 oz)" ? group.capacity : "—"}
                                    </p>
                                </div>
                                <div className="bg-bone rounded px-2 py-1.5">
                                    <p className="text-[9px] text-slate uppercase tracking-wider mb-0.5">Color</p>
                                    <p className="text-xs text-obsidian font-medium">{group.color || "—"}</p>
                                </div>
                                <div className="bg-bone rounded px-2 py-1.5">
                                    <p className="text-[9px] text-slate uppercase tracking-wider mb-0.5">Thread</p>
                                    <p className="text-xs text-obsidian font-medium">{group.neckThreadSize || "—"}</p>
                                </div>
                            </div>

                            {/* Actions Row */}
                            <div className="flex items-center gap-2">
                                {/* Quantity */}
                                <div className="flex items-center border border-champagne rounded-lg bg-bone">
                                    <button
                                        onClick={decrementQty}
                                        className="p-2 hover:bg-champagne/30 transition-colors rounded-l-lg"
                                        aria-label="Decrease quantity"
                                    >
                                        <Minus className="w-3 h-3 text-slate" />
                                    </button>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
                                        className="w-10 text-center text-xs font-medium text-obsidian bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        min={1}
                                        max={9999}
                                    />
                                    <button
                                        onClick={incrementQty}
                                        className="p-2 hover:bg-champagne/30 transition-colors rounded-r-lg"
                                        aria-label="Increase quantity"
                                    >
                                        <Plus className="w-3 h-3 text-slate" />
                                    </button>
                                </div>

                                {/* View/Add Button */}
                                <Link
                                    href={href}
                                    className="flex-1 py-2.5 bg-obsidian text-white text-xs uppercase font-bold tracking-wider text-center rounded-lg hover:bg-muted-gold transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    View & Configure
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Line Item Table (Desktop) ───────────────────────────────────────────────

function LineItemTable({
    groups,
    skuMap,
    applicatorParam,
}: {
    groups: CatalogGroup[];
    skuMap: Map<string, string>;
    applicatorParam?: string | null;
}) {
    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px]">
                <thead>
                    <tr className="border-b-2 border-obsidian">
                        <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold text-slate">
                            Product
                        </th>
                        <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold text-slate">
                            SKU
                        </th>
                        <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold text-slate">
                            Capacity
                        </th>
                        <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold text-slate">
                            Color
                        </th>
                        <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold text-slate">
                            Thread
                        </th>
                        <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold text-slate">
                            Variants
                        </th>
                        <th className="py-3 px-4 text-right text-[10px] uppercase tracking-wider font-bold text-slate">
                            Price
                        </th>
                        <th className="py-3 px-4 text-right text-[10px] uppercase tracking-wider font-bold text-slate">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map((group, idx) => (
                        <LineItemRow
                            key={group._id}
                            group={group}
                            sku={skuMap.get(group._id) ?? "—"}
                            index={idx}
                            applicatorParam={applicatorParam}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Line Item Grid (Mobile) ─────────────────────────────────────────────────

function LineItemMobileGrid({
    groups,
    skuMap,
    applicatorParam,
}: {
    groups: CatalogGroup[];
    skuMap: Map<string, string>;
    applicatorParam?: string | null;
}) {
    return (
        <div className="space-y-3">
            {groups.map((group, idx) => (
                <LineItemMobileCard
                    key={group._id}
                    group={group}
                    sku={skuMap.get(group._id) ?? "—"}
                    index={idx}
                    applicatorParam={applicatorParam}
                />
            ))}
        </div>
    );
}

// ─── Back to Top Button ──────────────────────────────────────────────────────

function BackToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 800);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <AnimatePresence>
            {visible && (
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="fixed bottom-6 left-6 z-40 w-10 h-10 rounded-full bg-obsidian text-bone flex items-center justify-center shadow-xl hover:bg-muted-gold transition-colors"
                    aria-label="Back to top"
                >
                    <ChevronUp className="w-5 h-5" />
                </motion.button>
            )}
        </AnimatePresence>
    );
}

// ─── Main Catalog Content ────────────────────────────────────────────────────

function CatalogContent({ searchParams }: { searchParams: URLSearchParams }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const { open: openGrace, setInput: setGraceInput } = useGrace();

    const isGraceNav = searchParams.get("grace") === "1";
    const [graceBannerDismissed, setGraceBannerDismissed] = useState(false);

    const initialState = paramsToFilters(searchParams);

    const [filters, setFilters] = useState<CatalogFilters>(initialState.filters);
    const [sortBy, setSortBy] = useState<SortValue>(initialState.sort);
    const [viewMode, setViewMode] = useState<ViewMode>(initialState.view);
    const [visibleCount, setVisibleCount] = useState(() => clampVisibleLimit(searchParams.get("limit")));
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
        if (typeof window === "undefined") return {};
        try {
            const saved = window.localStorage.getItem("catalog_expanded");
            return saved ? (JSON.parse(saved) as Record<string, boolean>) : {};
        } catch {
            return {};
        }
    });
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [searchInput, setSearchInput] = useState(initialState.filters.search);

    // Sync URL when filters/sort/view change
    const pushToUrl = useCallback(
        (f: CatalogFilters, s: SortValue, v: ViewMode, limit?: number) => {
            const params = filtersToParams(f, s, v);
            if (limit && limit > PAGE_SIZE) params.set("limit", String(limit));
            const qs = params.toString();
            router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
        },
        [router, pathname],
    );

    // Persist accordion state
    useEffect(() => {
        try {
            localStorage.setItem("catalog_expanded", JSON.stringify(expandedCategories));
        } catch { /* noop */ }
    }, [expandedCategories]);

    // Lock body scroll for mobile filter
    useEffect(() => {
        document.body.style.overflow = mobileFilterOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [mobileFilterOpen]);

    // ── Convex Queries ──────────────────────────────────────────────────────
    const rawGroups = useQuery(api.products.getAllCatalogGroups) as CatalogGroup[] | undefined;
    const groupSkus = useQuery(api.products.getCatalogGroupPrimarySkus) as CatalogGroupPrimarySku[] | undefined;
    const taxonomy = useQuery(api.products.getCatalogTaxonomy);

    const allGroups = useMemo(() => {
        return rawGroups?.map((group) => {
            const canonical = buildCanonicalProductGroup(group, [], "catalog-ui");
            return {
                ...group,
                color: canonical.canonicalColor ?? group.color,
                rawColor: canonical.rawColor,
                canonicalColor: canonical.canonicalColor,
                canonicalColorOptions: canonical.canonicalColorOptions,
                dataQualityFlags: canonical.dataQualityFlags,
            };
        });
    }, [rawGroups]);

    const skuMap = useMemo(() => {
        const next = new Map<string, string>();
        for (const row of groupSkus ?? []) {
            next.set(row.groupId, row.websiteSku ?? row.graceSku ?? "—");
        }
        return next;
    }, [groupSkus]);

    // ── Client-Side Filter + Sort + Facet Pipeline ──────────────────────────
    const { filtered, facets, totalCount } = useMemo(() => {
        if (!allGroups) return { filtered: [], facets: null, totalCount: 0 };

        const SLUG_BUCKET_SUFFIXES: Record<string, string[]> = {
            rollon: ["-rollon"], spray: ["-spray"], dropper: ["-dropper"], lotionpump: ["-lotionpump"], reducer: ["-reducer"],
        };

        // Run filters; when skipMultiSelect=true, omit families/capacities/applicators/colors/neckThreadSizes
        // so facet counts show "add this option" availability (Baymard: multi-select within facet type).
        const runFilters = (skipMultiSelect: boolean): CatalogGroup[] => {
            let r = [...allGroups];

            if (filters.search) {
                r = r.filter((g) => catalogSearchMatches(filters.search, [
                    g.displayName,
                    g.family,
                    g.color,
                    g.rawColor,
                    g.canonicalColor,
                    (g.canonicalColorOptions ?? []).join(" "),
                    g.capacity,
                    g.capacityMl == null ? null : `${g.capacityMl} ml`,
                    g.category,
                    g.neckThreadSize,
                    g.bottleCollection,
                    g.slug,
                    (g.applicatorTypes ?? []).join(" "),
                    skuMap.get(g._id),
                ]));
            }
            if (filters.category) r = r.filter((g) => g.category === filters.category);
            if (filters.collection) r = r.filter((g) => g.bottleCollection === filters.collection);

            if (!skipMultiSelect && filters.applicators.length > 0) {
                r = r.filter((g) => {
                    const types = g.applicatorTypes ?? [];
                    const slug = g.slug ?? "";
                    return filters.applicators.some((bucket) => {
                        if (!applicatorBucketMatchesProductValues(bucket, types)) return false;
                        const allowedSuffixes = SLUG_BUCKET_SUFFIXES[bucket];
                        return !allowedSuffixes || allowedSuffixes.some((s) => slug.endsWith(s));
                    });
                });
            }
            if (!skipMultiSelect && filters.families.length > 0) {
                const familySet = new Set(filters.families);
                r = r.filter((g) => g.family != null && familySet.has(g.family));
            }
            if (!skipMultiSelect && filters.colors.length > 0) {
                const set = new Set(filters.colors);
                r = r.filter((g) => g.color && set.has(g.color));
            }
            if (!skipMultiSelect && filters.capacities.length > 0) {
                const selectedMls = new Set(
                    filters.capacities.map((cap) => {
                        const m = cap.match(/^(\d+(?:\.\d+)?)\s*ml/i);
                        return m ? parseFloat(m[1]) : null;
                    }).filter((n): n is number => n !== null)
                );
                r = r.filter((g) => g.capacityMl != null && selectedMls.has(g.capacityMl));
            }
            if (!skipMultiSelect && filters.neckThreadSizes.length > 0) {
                const set = new Set(filters.neckThreadSizes);
                r = r.filter((g) => g.neckThreadSize && set.has(g.neckThreadSize));
            }
            if (filters.componentType) {
                r = r.filter((g) => classifyComponentType(g.displayName, g.family) === filters.componentType);
            }
            if (filters.priceMin !== null) {
                r = r.filter((g) => g.priceRangeMin !== null && g.priceRangeMin >= filters.priceMin!);
            }
            if (filters.priceMax !== null) {
                r = r.filter((g) => g.priceRangeMin !== null && g.priceRangeMin <= filters.priceMax!);
            }
            return r;
        };

        const result = runFilters(false);
        const facetBase = runFilters(true); // broader set for facet counts (multi-select options stay visible)

        // Compute multi-select facets from facetBase so options stay visible (Baymard)
        const applicatorCounts: Record<string, number> = {};
        for (const bucket of APPLICATOR_BUCKETS) {
            const count = facetBase.filter((g) => applicatorBucketMatchesProductValues(bucket.value, g.applicatorTypes ?? [])).length;
            if (count > 0) applicatorCounts[bucket.value] = count;
        }
        const familyFacets = countBy(
            facetBase.filter((g) => !COMPONENT_CATEGORIES.has(g.category)),
            (g) => g.family,
        );
        const facetData: Facets = {
            categories: countBy(result, (g) => g.category),
            collections: countBy(result, (g) => g.bottleCollection),
            applicators: applicatorCounts,
            families: familyFacets,
            colors: countBy(facetBase, (g) => g.color),
            capacities: {},
            neckThreadSizes: countBy(facetBase, (g) => g.neckThreadSize),
            componentTypes: countBy(result, (g) => classifyComponentType(g.displayName, g.family)),
            priceRange: { min: Infinity, max: -Infinity },
        };

        // Build capacity facets from facetBase
        const capMap: Record<number, { label: string; count: number }> = {};
        for (const g of facetBase) {
            const ml = g.capacityMl;
            if (ml !== null && ml !== undefined && ml > 0) {
                if (!capMap[ml]) {
                    const label = Number.isInteger(ml) ? `${ml} ml` : `${ml} ml`;
                    capMap[ml] = { label, count: 0 };
                }
                capMap[ml].count++;
            }
        }
        for (const g of result) {
            if (g.priceRangeMin != null) {
                if (g.priceRangeMin < facetData.priceRange.min) facetData.priceRange.min = g.priceRangeMin;
                if (g.priceRangeMin > facetData.priceRange.max) facetData.priceRange.max = g.priceRangeMin;
            }
        }
        // Convert to the shape the sidebar expects: Record<label, { label, ml, count }>
        facetData.capacities = Object.fromEntries(
            Object.entries(capMap).map(([mlKey, data]) => [
                data.label,
                { label: data.label, ml: Number(mlKey), count: data.count },
            ]),
        );

        if (facetData.priceRange.min === Infinity) facetData.priceRange = { min: 0, max: 0 };

        // Sort
        if (sortBy === "best-match" && filters.search) {
            // Name/SKU/applicator relevance first, then supporting product attributes.
            const score = (g: typeof result[0]) => catalogSearchScore(filters.search, [
                { value: g.displayName, weight: 5 },
                { value: skuMap.get(g._id), weight: 5 },
                { value: (g.applicatorTypes ?? []).join(" "), weight: 4 },
                { value: g.family, weight: 3 },
                { value: g.capacity, weight: 3 },
                { value: g.capacityMl == null ? null : `${g.capacityMl} ml`, weight: 3 },
                { value: g.color, weight: 2 },
                { value: g.neckThreadSize, weight: 2 },
                { value: g.category, weight: 1 },
                { value: g.bottleCollection, weight: 1 },
                { value: g.slug, weight: 1 },
            ]);
            result.sort((a, b) => score(b) - score(a) || catalogSearchResultTieBreak(a, b));
        } else if (sortBy === "price-asc") {
            result.sort((a, b) => (a.priceRangeMin ?? Infinity) - (b.priceRangeMin ?? Infinity));
        } else if (sortBy === "price-desc") {
            result.sort((a, b) => (b.priceRangeMin ?? -Infinity) - (a.priceRangeMin ?? -Infinity));
        } else if (sortBy === "name-asc") {
            result.sort((a, b) => a.displayName.localeCompare(b.displayName));
        } else if (sortBy === "name-desc") {
            result.sort((a, b) => b.displayName.localeCompare(a.displayName));
        } else if (sortBy === "variants-desc") {
            result.sort((a, b) => (b.variantCount ?? 0) - (a.variantCount ?? 0));
        } else if (sortBy === "capacity-asc") {
            result.sort((a, b) => (a.capacityMl ?? Infinity) - (b.capacityMl ?? Infinity));
        } else if (sortBy === "capacity-desc") {
            result.sort((a, b) => {
                const aMissing = a.capacityMl == null;
                const bMissing = b.capacityMl == null;
                if (aMissing && bMissing) return 0;
                if (aMissing) return 1;
                if (bMissing) return -1;
                return b.capacityMl! - a.capacityMl!;
            });
        } else {
            // "featured" default: by design family (Cylinder→Elegant→Circle→Sleek…), then capacity small→big
            // Bottle categories first; packaging/components at end
            const familyIdx = (fam: string | null) => {
                if (!fam) return FAMILY_ORDER.length;
                const i = FAMILY_ORDER.indexOf(fam);
                return i >= 0 ? i : FAMILY_ORDER.length;
            };
            const categoryOrder = (cat: string) =>
                BOTTLE_CATEGORIES.has(cat) ? 0 : 1;
            result.sort((a, b) => {
                const catA = categoryOrder(a.category);
                const catB = categoryOrder(b.category);
                if (catA !== catB) return catA - catB;
                const famA = familyIdx(a.family);
                const famB = familyIdx(b.family);
                if (famA !== famB) return famA - famB;
                return (a.capacityMl ?? 99999) - (b.capacityMl ?? 99999);
            });
        }

        return { filtered: result, facets: facetData, totalCount: result.length };
    }, [allGroups, filters, sortBy, skuMap]);

    const visibleProducts = filtered.slice(0, visibleCount);
    const hasMore = visibleCount < filtered.length;
    const isLoading = allGroups === undefined;
    const activeCount = activeFilterCount(filters);
    const searchRecoverySuggestions = useMemo(
        () => catalogSearchRecoverySuggestions(filters.search),
        [filters.search],
    );

    // ── Handler Functions ────────────────────────────────────────────────────

    const handleFilterChange = useCallback(
        (patch: Partial<CatalogFilters>) => {
            setFilters((prev) => {
                const next = { ...prev, ...patch };
                // Using a timeout defers the URL update until after the render cycle completes
                setTimeout(() => pushToUrl(next, sortBy, viewMode), 0);
                return next;
            });
            setVisibleCount(PAGE_SIZE);
            if (!mobileFilterOpen) window.scrollTo({ top: 0, behavior: "smooth" });
        },
        [mobileFilterOpen, pushToUrl, sortBy, viewMode],
    );

    const handleClearAll = useCallback(() => {
        setFilters(EMPTY_FILTERS);
        setVisibleCount(PAGE_SIZE);
        setSearchInput("");
        pushToUrl(EMPTY_FILTERS, sortBy, viewMode);
    }, [pushToUrl, sortBy, viewMode]);

    const handleSortChange = useCallback(
        (value: SortValue) => {
            setSortBy(value);
            setVisibleCount(PAGE_SIZE);
            pushToUrl(filters, value, viewMode);
        },
        [pushToUrl, filters, viewMode],
    );

    const handleViewChange = useCallback(
        (value: ViewMode) => {
            setViewMode(value);
            pushToUrl(filters, sortBy, value, visibleCount);
        },
        [pushToUrl, filters, sortBy, visibleCount],
    );

    const handleLoadMore = useCallback(() => {
        const next = Math.min(visibleCount + PAGE_SIZE, filtered.length);
        setVisibleCount(next);
        pushToUrl(filters, sortBy, viewMode, next);
    }, [filtered.length, filters, pushToUrl, sortBy, viewMode, visibleCount]);

    const handleSearchInput = useCallback(
        (term: string) => {
            setSearchInput(term);
            clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = setTimeout(() => {
                // Auto-switch to "best-match" when search is typed; restore "featured" when cleared
                if (term && sortBy === "featured") setSortBy("best-match");
                if (!term && sortBy === "best-match") setSortBy("featured");
                handleFilterChange({ search: term || "" });
            }, SEARCH_DEBOUNCE_MS);
        },
        [handleFilterChange, sortBy],
    );

    const handleAskGrace = useCallback(
        (prompt: string) => {
            setGraceInput(prompt);
            openGrace();
        },
        [openGrace, setGraceInput],
    );

    const toggleCategory = useCallback((cat: string) => {
        setExpandedCategories((prev) => ({ ...prev, [cat]: prev[cat] === false ? true : !prev[cat] ? false : !prev[cat] }));
    }, []);

    // Build active filter chips
    const chips: Array<{ label: string; onRemove: () => void }> = [];
    if (filters.category) chips.push({ label: filters.category, onRemove: () => handleFilterChange({ category: null }) });
    if (filters.collection) chips.push({ label: filters.collection, onRemove: () => handleFilterChange({ collection: null }) });
    for (const a of filters.applicators) {
        const label = APPLICATOR_BUCKETS.find((b) => b.value === a)?.label ?? a;
        chips.push({ label, onRemove: () => handleFilterChange({ applicators: filters.applicators.filter((x) => x !== a) }) });
    }
    for (const f of filters.families) chips.push({ label: f, onRemove: () => handleFilterChange({ families: filters.families.filter((x) => x !== f) }) });
    for (const c of filters.colors) chips.push({ label: c, onRemove: () => handleFilterChange({ colors: filters.colors.filter((x) => x !== c) }) });
    const capacityChipLabels = new Set<string>();
    if (facets) {
        const allCapacities = Object.values(facets.capacities);
        for (const range of CAPACITY_RANGES) {
            const labels = allCapacities.filter((cap) => capacityInRange(cap.ml, range)).map((cap) => cap.label);
            if (labels.length > 0 && labels.every((label) => filters.capacities.includes(label))) {
                labels.forEach((label) => capacityChipLabels.add(label));
                chips.push({
                    label: `${range.label} — ${range.detail}`,
                    onRemove: () => handleFilterChange({ capacities: filters.capacities.filter((x) => !labels.includes(x)) }),
                });
            }
        }
    }
    for (const cap of filters.capacities) {
        if (!capacityChipLabels.has(cap)) {
            chips.push({ label: cap, onRemove: () => handleFilterChange({ capacities: filters.capacities.filter((x) => x !== cap) }) });
        }
    }
    for (const t of filters.neckThreadSizes) chips.push({ label: `Thread ${t}`, onRemove: () => handleFilterChange({ neckThreadSizes: filters.neckThreadSizes.filter((x) => x !== t) }) });
    if (filters.componentType) chips.push({ label: filters.componentType, onRemove: () => handleFilterChange({ componentType: null }) });
    if (filters.priceMin !== null || filters.priceMax !== null) {
        chips.push({
            label: `${formatPrice(filters.priceMin ?? 0)} – ${formatPrice(filters.priceMax ?? 999)}`,
            onRemove: () => handleFilterChange({ priceMin: null, priceMax: null }),
        });
    }
    if (filters.search) chips.push({ label: `"${filters.search}"`, onRemove: () => { handleFilterChange({ search: "" }); setSearchInput(""); } });

    return (
        <main className="min-h-screen bg-warm-white pt-[160px] lg:pt-[120px]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildCatalogFaqJsonLd()) }}
            />
            <Navbar variant="catalog" initialSearchValue={filters.search || undefined} />

            <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-4 sm:py-8">

                {/* Catalog Header */}
                <div className="mb-4 sm:mb-12 border-b border-champagne/50 pb-4 sm:pb-8 flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-6">
                    <div>
                        <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl text-obsidian font-medium leading-[1.1] mb-1 sm:mb-2">Master Catalog</h1>
                        <p className="text-slate text-xs sm:text-sm max-w-xl">
                            {isLoading ? "Loading catalog..." : `${totalCount.toLocaleString()} product group${totalCount === 1 ? "" : "s"} currently visible.`}
                            <span>{" "}Need help? Talk with Grace, your AI Bottling Specialist.</span>
                        </p>
                    </div>

                    {/* Search Bar — desktop only (mobile uses navbar search) */}
                    <div className="shrink-0 hidden md:block">
                        <div className="flex items-center border border-champagne rounded-full px-4 py-2.5 bg-white/80 space-x-2 w-full md:w-80 hover:border-muted-gold transition-colors focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/20">
                            <Search className="w-4 h-4 text-slate shrink-0" />
                            <input
                                type="search"
                                name="search"
                                autoComplete="search"
                                enterKeyHint="search"
                                value={searchInput}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                placeholder="Search products, SKUs, families..."
                                className="bg-transparent text-sm focus:outline-none w-full placeholder-slate/60 text-obsidian"
                                aria-label="Search products"
                                data-testid="catalog-search-input"
                            />
                            {searchInput && (
                                <button onClick={() => handleSearchInput("")} className="shrink-0" aria-label="Clear search">
                                    <X className="w-4 h-4 text-slate hover:text-obsidian transition-colors" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Active Filter Chips */}
                <AnimatePresence>
                    {chips.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-3 sm:mb-6 flex flex-wrap items-center gap-2"
                            aria-label="Active catalog filters"
                        >
                            <span className="text-xs uppercase tracking-wider font-semibold text-slate">Active Filters:</span>
                            {chips.map((chip, i) => (
                                <span
                                    key={`${chip.label}-${i}`}
                                    className="inline-flex items-center px-3 py-1.5 bg-muted-gold/10 text-muted-gold border border-muted-gold/30 text-xs font-semibold rounded-full"
                                    data-testid="catalog-active-filter-chip"
                                >
                                    <span className="truncate max-w-[160px]">{chip.label}</span>
                                    <button
                                        onClick={chip.onRemove}
                                        className="ml-2 hover:text-obsidian transition-colors shrink-0"
                                        aria-label={`Remove ${chip.label} filter`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            {chips.length > 0 && (
                                <button
                                    onClick={handleClearAll}
                                    className="text-xs text-slate hover:text-obsidian transition-colors underline underline-offset-2"
                                >
                                    Clear all
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Mobile Filter Toggle */}
                <div className="lg:hidden mb-3 flex items-center gap-2">
                    <button
                        onClick={() => setMobileFilterOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-champagne rounded-lg text-sm font-medium text-obsidian hover:border-muted-gold transition-colors"
                        data-testid="catalog-mobile-filter-button"
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Filters
                        {activeCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-muted-gold text-white text-[10px] flex items-center justify-center font-bold">
                                {activeCount}
                            </span>
                        )}
                    </button>

                    {/* Mobile sort */}
                    <div className="relative flex-1 max-w-[200px]">
                        <select
                            value={sortBy}
                            onChange={(e) => handleSortChange(e.target.value as SortValue)}
                            className="w-full appearance-none bg-white border border-champagne rounded-lg px-3 py-2.5 text-sm text-obsidian pr-8 focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/20 outline-none"
                        >
                            {SORT_OPTIONS.filter((opt) => opt.value !== "best-match" || filters.search).map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate pointer-events-none" />
                    </div>
                </div>

                {/* Mobile Filter Drawer */}
                <AnimatePresence>
                    {mobileFilterOpen && (
                        <>
                            <motion.div
                                key="filter-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setMobileFilterOpen(false)}
                                className="fixed inset-0 z-50 bg-obsidian/40 backdrop-blur-sm lg:hidden"
                            />
                            <motion.div
                                key="filter-drawer"
                                initial={{ x: "-100%" }}
                                animate={{ x: 0 }}
                                exit={{ x: "-100%" }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                                className="fixed top-0 left-0 bottom-0 z-50 w-[300px] max-w-[85vw] bg-warm-white overflow-y-auto lg:hidden"
                                style={{ boxShadow: "8px 0 40px rgba(29,29,31,0.15)" }}
                                data-testid="catalog-filter-drawer"
                            >
                                <div className="flex items-center justify-between px-5 py-4 border-b border-champagne/50 sticky top-0 bg-warm-white z-10">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-serif text-lg text-obsidian font-medium">Filters</h3>
                                        {activeCount > 0 && (
                                            <span className="w-5 h-5 rounded-full bg-muted-gold text-white text-[10px] flex items-center justify-center font-bold">
                                                {activeCount}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setMobileFilterOpen(false)}
                                        className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-champagne/40 transition-colors"
                                        aria-label="Close filters"
                                    >
                                        <X className="w-5 h-5 text-slate" />
                                    </button>
                                </div>
                                <div className="px-5 py-4 pb-28">
                                    <FilterSidebarContent
                                        facets={facets}
                                        taxonomy={taxonomy ?? null}
                                        filters={filters}
                                        totalCount={totalCount}
                                        expandedCategories={expandedCategories}
                                        toggleCategory={toggleCategory}
                                        onFilterChange={handleFilterChange}
                                        onClearAll={handleClearAll}
                                    />
                                </div>
                                {/* Sticky "View results" button at bottom */}
                                <div className="sticky bottom-0 px-5 py-4 bg-warm-white border-t border-champagne/50">
                                    <button
                                        onClick={() => {
                                            setMobileFilterOpen(false);
                                            window.scrollTo({ top: 0, behavior: "smooth" });
                                        }}
                                        className="w-full py-3 bg-obsidian text-white text-sm font-bold uppercase tracking-wider hover:bg-muted-gold transition-colors rounded-sm"
                                    >
                                        {isLoading ? "Loading results" : `View ${filtered.length} ${filtered.length === 1 ? "Result" : "Results"}`}
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                <div className="flex flex-col lg:flex-row items-start lg:space-x-6">

                    {/* Desktop Sidebar */}
                    <aside className="hidden lg:block w-72 shrink-0 sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto hide-scroll pb-12 bg-parchment/30 rounded-xl px-4 pt-4">
                        <FilterSidebarContent
                            facets={facets}
                            taxonomy={taxonomy ?? null}
                            filters={filters}
                            totalCount={totalCount}
                            expandedCategories={expandedCategories}
                            toggleCategory={toggleCategory}
                            onFilterChange={handleFilterChange}
                            onClearAll={handleClearAll}
                        />
                    </aside>

                    {/* Product Grid Content */}
                    <div className="flex-1 min-w-0 w-full pb-32 border-l-0 lg:border-l border-champagne/30 lg:pl-6">

                        {/* Family banner — shown when a single design family is filtered */}
                        {filters.families.length === 1 && !filters.search && (
                            <FamilyBanner family={filters.families[0]} />
                        )}

                        {/* Results Header — sticks directly below fixed navbar */}
                        <div className="sticky top-[136px] lg:top-[100px] z-30 bg-warm-white pt-2 sm:pt-5 pb-2 mb-4 sm:mb-8 border-b-2 border-obsidian">
                            <div className="flex items-end justify-between gap-2 sm:gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-0.5 sm:mb-1">
                                        {filters.search
                                            ? "Search Results"
                                            : filters.applicators.length > 0 && filters.families.length === 1
                                                ? filters.families[0]
                                                : "Catalog"}
                                    </p>
                                    <h2 className="font-serif text-lg sm:text-3xl font-medium text-obsidian truncate">
                                        {filters.search
                                            ? `"${filters.search}"`
                                            : filters.applicators.length === 1
                                                ? `${APPLICATOR_BUCKETS.find((b) => b.value === filters.applicators[0])?.label ?? filters.applicators[0]} Bottles`
                                                : filters.applicators.length > 1
                                                    ? `${filters.applicators.map((a) => APPLICATOR_BUCKETS.find((b) => b.value === a)?.label ?? a).join(" & ")} Bottles`
                                                    : filters.families.length === 1
                                                        ? filters.families[0]
                                                        : filters.collection || filters.category || "All Products"}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    {/* View Toggle */}
                                    <ViewToggle value={viewMode} onChange={handleViewChange} />

                                    {/* Desktop Sort */}
                                    <div className="relative hidden lg:block">
                                        <select
                                            value={sortBy}
                                            onChange={(e) => handleSortChange(e.target.value as SortValue)}
                                            className="appearance-none bg-white border border-champagne rounded-lg px-3 py-1.5 text-xs text-obsidian pr-7 focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/20 outline-none cursor-pointer"
                                        >
                                            {SORT_OPTIONS.filter((opt) => opt.value !== "best-match" || filters.search).map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate pointer-events-none" />
                                    </div>

                                    <span
                                        className="hidden sm:inline-flex px-2 sm:px-3 py-1 bg-white border border-champagne text-[10px] sm:text-xs font-semibold text-slate uppercase rounded-full whitespace-nowrap"
                                        aria-live="polite"
                                        data-testid="catalog-result-count"
                                    >
                                        {isLoading ? "Loading" : `${filtered.length} ${filtered.length === 1 ? "Product" : "Products"}`}
                                    </span>
                                    {chips.length > 0 && (
                                        <button
                                            onClick={handleClearAll}
                                            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-muted-gold hover:text-obsidian bg-muted-gold/10 border border-muted-gold/30 rounded-full whitespace-nowrap transition-colors"
                                        >
                                            {chips.length} filter{chips.length !== 1 ? "s" : ""} · Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quick applicator chips */}
                        {facets && Object.keys(facets.applicators).length > 0 && (
                            <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-1 hide-scroll sm:flex-wrap">
                                <button
                                    onClick={() => handleFilterChange({ applicators: [] })}
                                    aria-pressed={filters.applicators.length === 0}
                                    data-testid="catalog-quick-applicator"
                                    className={`shrink-0 min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors ${filters.applicators.length === 0
                                        ? "bg-obsidian text-white border-obsidian"
                                        : "bg-white border-champagne text-obsidian hover:border-muted-gold"
                                        }`}
                                >
                                    All Bottles
                                </button>
                                {APPLICATOR_BUCKETS.filter((b) => (facets.applicators[b.value] ?? 0) > 0).map((bucket) => (
                                    <button
                                        key={bucket.value}
                                        onClick={() => {
                                            const isActive = filters.applicators.includes(bucket.value);
                                            handleFilterChange({
                                                applicators: isActive
                                                    ? filters.applicators.filter((a) => a !== bucket.value)
                                                    : [...filters.applicators, bucket.value],
                                            });
                                        }}
                                        aria-pressed={filters.applicators.includes(bucket.value)}
                                        data-testid="catalog-quick-applicator"
                                        className={`shrink-0 min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border transition-colors whitespace-nowrap ${filters.applicators.includes(bucket.value)
                                            ? "bg-obsidian text-white border-obsidian"
                                            : "bg-white border-champagne text-obsidian hover:border-muted-gold"
                                            }`}
                                    >
                                        {bucket.label} ({facets.applicators[bucket.value]})
                                    </button>
                                ))}
                            </div>
                        )}

                        <CatalogAnswerBlocks onAskGrace={handleAskGrace} />

                        {/* Loading */}
                        {isLoading && <SkeletonGrid />}

                        {/* Empty State */}
                        {!isLoading && filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="catalog-empty-state">
                                <Package className="w-16 h-16 text-champagne mb-6" strokeWidth={1} />
                                <h3 className="font-serif text-2xl text-obsidian mb-3">No products found</h3>
                                <p className="text-slate text-sm max-w-md mb-4">
                                    {filters.search
                                        ? `No products match "${filters.search}".`
                                        : "No products match your current filters."}
                                </p>
                                {chips.length > 0 && (
                                    <p className="text-slate text-xs mb-6">
                                        Try removing {chips.length === 1 ? "your filter" : "some filters"} to see more results.
                                    </p>
                                )}
                                {searchRecoverySuggestions.length > 0 && (
                                    <div className="mb-6 max-w-lg">
                                        <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate mb-3">
                                            Try a broader packaging term
                                        </p>
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            {searchRecoverySuggestions.map((suggestion) => (
                                                <button
                                                    key={suggestion}
                                                    onClick={() => {
                                                        setSearchInput(suggestion);
                                                        handleFilterChange({ search: suggestion });
                                                    }}
                                                    className="min-h-11 px-4 py-2 rounded-full border border-champagne bg-white text-xs font-semibold text-obsidian hover:border-muted-gold hover:text-muted-gold transition-colors"
                                                    data-testid="catalog-search-recovery-suggestion"
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                                    <button
                                        onClick={handleClearAll}
                                        className="px-6 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors rounded-sm"
                                    >
                                        Reset Filters
                                    </button>
                                    <button
                                        onClick={openGrace}
                                        className="px-6 py-3 border border-muted-gold text-muted-gold uppercase text-xs font-bold tracking-wider hover:bg-muted-gold hover:text-white transition-colors rounded-sm flex items-center gap-2"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        Talk with Grace
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Grace Navigation Banner */}
                        <AnimatePresence>
                            {isGraceNav && !graceBannerDismissed && visibleProducts.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-muted-gold/10 border border-muted-gold/30 rounded-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-muted-gold shrink-0" />
                                        <p className="text-sm text-muted-gold font-semibold">Grace found these for you</p>
                                        <span className="text-xs text-slate">— refine with the filters, or ask Grace to narrow it further.</span>
                                    </div>
                                    <button
                                        onClick={() => setGraceBannerDismissed(true)}
                                        className="shrink-0 p-1 hover:text-obsidian text-muted-gold transition-colors"
                                        aria-label="Dismiss"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Product Display — Visual Grid or Line Items */}
                        {visibleProducts.length > 0 && viewMode === "visual" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {visibleProducts.map((group: CatalogGroup, pIndex: number) => (
                                    <ProductGroupCard
                                        key={group._id}
                                        group={group}
                                        index={pIndex}
                                        applicatorParam={filters.applicators.length === 1 ? filters.applicators[0] : null}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Line Item View — Desktop Table */}
                        {visibleProducts.length > 0 && viewMode === "line" && (
                            <>
                                {/* Desktop: Table aligned with header */}
                                <div className="hidden lg:block">
                                    <div className="bg-white border border-champagne/40 rounded-lg overflow-hidden shadow-sm">
                                        <LineItemTable
                                            groups={visibleProducts}
                                            skuMap={skuMap}
                                            applicatorParam={filters.applicators.length === 1 ? filters.applicators[0] : null}
                                        />
                                    </div>
                                </div>

                                {/* Mobile: Compact cards */}
                                <div className="lg:hidden">
                                    <LineItemMobileGrid
                                        groups={visibleProducts}
                                        skuMap={skuMap}
                                        applicatorParam={filters.applicators.length === 1 ? filters.applicators[0] : null}
                                    />
                                </div>
                            </>
                        )}

                        {/* Load More */}
                        {hasMore && (
                            <div className="flex flex-col items-center py-12 mt-8 border-t border-champagne/40">
                                <p className="text-xs text-slate mb-4">
                                    Showing {visibleCount} of {filtered.length} products
                                </p>
                                <button
                                    onClick={handleLoadMore}
                                    className="px-8 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors rounded-sm"
                                >
                                    Load More
                                </button>
                            </div>
                        )}

                        {/* All shown indicator */}
                        {!isLoading && filtered.length > 0 && !hasMore && filtered.length > PAGE_SIZE && (
                            <div className="flex justify-center py-12 mt-8 border-t border-champagne/40">
                                <p className="text-xs text-slate">
                                    Showing all {filtered.length} products
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <BackToTop />
        </main>
    );
}

function CatalogContentLoader() {
    const searchParams = useSearchParams();
    const query = searchParams.toString();
    return <CatalogContent key={query} searchParams={new URLSearchParams(query)} />;
}

// ─── Export with Suspense ────────────────────────────────────────────────────

export default function CatalogPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-warm-white pt-[160px] lg:pt-[120px]">
                    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-4 sm:py-8">
                        <div className="mb-4 sm:mb-12 border-b border-champagne/50 pb-4 sm:pb-8">
                            <div className="h-10 w-64 bg-champagne/30 rounded animate-pulse mb-3" />
                            <div className="h-4 w-96 max-w-full bg-champagne/20 rounded animate-pulse" />
                        </div>
                        <SkeletonGrid />
                    </div>
                </main>
            }
        >
            <CatalogContentLoader />
        </Suspense>
    );
}
