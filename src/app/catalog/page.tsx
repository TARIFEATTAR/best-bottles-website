"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
    Search, ArrowRight, X, Package, ChevronDown, ChevronUp,
    SlidersHorizontal, ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import {
    SORT_OPTIONS,
    type SortValue,
    type CatalogFilters,
    EMPTY_FILTERS,
    classifyComponentType,
    filtersAreEmpty,
    activeFilterCount,
    filtersToParams,
    paramsToFilters,
} from "@/lib/catalogFilters";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

const COLOR_SWATCH_MAP: Record<string, string> = {
    Clear: "bg-white border border-champagne/60",
    Amber: "bg-amber-600",
    Blue: "bg-blue-600",
    Green: "bg-emerald-600",
    Frosted: "bg-gradient-to-br from-white to-slate-200 border border-champagne/60",
    Black: "bg-black",
    White: "bg-white border border-champagne/60",
    Pink: "bg-pink-400",
    Red: "bg-red-600",
    Gold: "bg-yellow-500",
    Purple: "bg-purple-600",
    Cobalt: "bg-blue-800",
    "Cobalt Blue": "bg-blue-800",
    Opal: "bg-gradient-to-br from-white to-sky-100 border border-champagne/60",
};

const CATEGORY_ORDER = [
    "Glass Bottle", "Cream Jar", "Lotion Bottle", "Aluminum Bottle",
    "Component", "Cap/Closure", "Roll-On Cap", "Accessory",
    "Packaging Box", "Other",
];

const COMPONENT_CATEGORIES = new Set([
    "Component", "Cap/Closure", "Roll-On Cap", "Accessory",
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
    category: string;
    bottleCollection: string | null;
    neckThreadSize: string | null;
    variantCount: number;
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    heroImageUrl?: string | null;
}

interface Facets {
    categories: Record<string, number>;
    collections: Record<string, number>;
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
            <div className="aspect-[4/5] bg-champagne/20 w-full" />
            <div className="p-5 flex flex-col flex-1 space-y-3">
                <div className="h-3 w-16 bg-champagne/30 rounded" />
                <div className="h-5 w-3/4 bg-champagne/30 rounded" />
                <div className="flex gap-1.5">
                    <div className="h-4 w-14 bg-champagne/20 rounded-sm" />
                    <div className="h-4 w-14 bg-champagne/20 rounded-sm" />
                </div>
                <div className="mt-auto flex items-end justify-between pt-2">
                    <div className="h-6 w-20 bg-champagne/30 rounded" />
                    <div className="h-4 w-16 bg-champagne/20 rounded-sm" />
                </div>
            </div>
        </div>
    );
}

function SkeletonGrid() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

// ─── Product Group Card ──────────────────────────────────────────────────────

function ProductGroupCard({ group, index }: { group: CatalogGroup; index: number }) {
    return (
        <Link href={`/products/${group.slug}`}>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.3) }}
                className="group cursor-pointer flex flex-col h-full bg-white rounded-sm border border-champagne/40 overflow-hidden hover:border-muted-gold hover:shadow-lg transition-all duration-300"
            >
                <div className="relative aspect-[4/5] bg-travertine w-full overflow-hidden flex items-center justify-center">
                    {group.heroImageUrl ? (
                        <img
                            src={group.heroImageUrl}
                            alt={group.displayName}
                            className="w-full h-full object-contain p-4"
                            loading="lazy"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                            <Package className="w-12 h-12 text-champagne mb-3" strokeWidth={1} />
                            <p className="text-[10px] text-slate/60 uppercase tracking-wider font-medium leading-tight max-w-[120px]">
                                {group.family}
                            </p>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-transparent group-hover:bg-obsidian/5 transition-colors duration-300 pointer-events-none" />

                    <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full bg-obsidian/80 text-white">
                            {group.variantCount} variant{group.variantCount !== 1 ? "s" : ""}
                        </span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-white/95 to-white/60 backdrop-blur-sm border-t border-white/50">
                        <div className="w-full py-2 bg-obsidian text-white text-[11px] uppercase font-bold tracking-wider text-center hover:bg-muted-gold transition-colors">
                            Configure <ArrowRight className="inline w-3 h-3 ml-1" />
                        </div>
                    </div>
                </div>

                <div className="p-5 flex flex-col flex-1">
                    <p className="text-[10px] text-slate uppercase tracking-wider font-bold mb-1">{group.category}</p>
                    <h4 className="font-serif text-lg text-obsidian font-medium mb-2 flex-1 leading-snug">{group.displayName}</h4>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {group.capacity && group.capacity !== "0 ml (0 oz)" && (
                            <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-bone border border-champagne/50 text-slate rounded-sm font-medium">
                                {group.capacity}
                            </span>
                        )}
                        {group.color && (
                            <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-bone border border-champagne/50 text-slate rounded-sm font-medium">
                                {group.color}
                            </span>
                        )}
                        {group.neckThreadSize && (
                            <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-bone border border-champagne/50 text-slate rounded-sm font-medium">
                                Thread {group.neckThreadSize}
                            </span>
                        )}
                    </div>

                    <div className="flex items-end justify-between mt-auto">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate">from</span>
                            <span className="font-semibold text-obsidian text-lg">{formatPrice(group.priceRangeMin)}/ea</span>
                        </div>
                        {group.priceRangeMax && group.priceRangeMax !== group.priceRangeMin && (
                            <span className="text-[10px] text-slate uppercase font-medium bg-travertine px-2 py-1 rounded-sm border border-champagne">
                                to {formatPrice(group.priceRangeMax)}
                            </span>
                        )}
                    </div>
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
    children,
}: {
    title: string;
    defaultOpen?: boolean;
    expanded?: boolean;
    onToggle?: () => void;
    children: React.ReactNode;
}) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isOpen = expanded ?? internalOpen;
    const toggle = onToggle ?? (() => setInternalOpen((p) => !p));

    return (
        <div className="border-b border-champagne/30 pb-4 mb-4">
            <button
                onClick={toggle}
                className="flex items-center justify-between w-full text-xs uppercase tracking-wider font-bold text-slate hover:text-obsidian transition-colors py-1"
                aria-expanded={isOpen}
            >
                <span>{title}</span>
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
        <label className="flex items-center gap-2.5 py-1 cursor-pointer group/check">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="w-3.5 h-3.5 rounded border-champagne text-muted-gold focus:ring-muted-gold/30 cursor-pointer"
            />
            {swatch && (
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${swatch}`} />
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

    const sortedColors = useMemo(() => {
        if (!facets) return [];
        return Object.entries(facets.colors).sort(([, a], [, b]) => b - a);
    }, [facets]);

    const sortedThreads = useMemo(() => {
        if (!facets) return [];
        return Object.entries(facets.neckThreadSizes).sort(([a], [b]) => {
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

    return (
        <>
            <h3 className="font-serif text-xl text-obsidian border-b border-champagne pb-3 mb-6">Browse</h3>

            <button
                onClick={onClearAll}
                className={`block text-left text-sm transition-colors w-full mb-6 pb-4 border-b border-champagne/30 ${filtersAreEmpty(filters) ? "text-muted-gold font-semibold" : "text-obsidian hover:text-muted-gold"}`}
            >
                All Products ({totalCount.toLocaleString()})
            </button>

            {/* Category + Collection Tree */}
            <FilterSection title="Categories" defaultOpen>
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
                                            className={`block text-left text-[13px] transition-colors w-full py-0.5 ${filters.category === group.category && !filters.collection ? "text-muted-gold font-semibold" : "text-obsidian/70 hover:text-muted-gold"}`}
                                        >
                                            All {group.category} ({group.totalCount})
                                        </button>
                                        {group.collections.map((col) => (
                                            <button
                                                key={col.name}
                                                onClick={() => onFilterChange({ collection: filters.collection === col.name ? null : col.name, category: null })}
                                                className={`block text-left text-[13px] transition-colors w-full py-0.5 ${filters.collection === col.name ? "text-muted-gold font-semibold" : "text-obsidian/70 hover:text-muted-gold"}`}
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

            {/* Design Families */}
            {sortedFamilies.length > 0 && (
                <FilterSection title="Design Families" defaultOpen>
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

            {/* Component Type (contextual) */}
            {isComponentCategory && sortedComponentTypes.length > 0 && (
                <FilterSection title="Component Type" defaultOpen>
                    <div className="space-y-0.5">
                        {sortedComponentTypes.map(([type, count]) => (
                            <button
                                key={type}
                                onClick={() => onFilterChange({ componentType: filters.componentType === type ? null : type })}
                                className={`block text-left text-[13px] transition-colors w-full py-1 ${filters.componentType === type ? "text-muted-gold font-semibold" : "text-obsidian/70 hover:text-muted-gold"}`}
                            >
                                {type} ({count})
                            </button>
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Capacity */}
            {sortedCapacities.length > 0 && (
                <FilterSection title="Capacity">
                    <div className="space-y-0.5 max-h-[240px] overflow-y-auto hide-scroll">
                        {sortedCapacities.map((cap) => (
                            <CheckboxItem
                                key={cap.label}
                                label={cap.label}
                                count={cap.count}
                                checked={filters.capacities.includes(cap.label)}
                                onChange={() => toggleArrayFilter("capacities", cap.label)}
                            />
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Color */}
            {sortedColors.length > 0 && (
                <FilterSection title="Color">
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

            {/* Neck Thread Size */}
            {sortedThreads.length > 0 && (
                <FilterSection title="Neck Thread Size">
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

            {/* Price Range */}
            {facets && facets.priceRange.min < facets.priceRange.max && (
                <FilterSection title="Price Range">
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

    const initialState = paramsToFilters(searchParams);

    const [filters, setFilters] = useState<CatalogFilters>(initialState.filters);
    const [sortBy, setSortBy] = useState<SortValue>(initialState.sort);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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

    // Sync URL when filters/sort change
    const pushToUrl = useCallback(
        (f: CatalogFilters, s: SortValue) => {
            const qs = filtersToParams(f, s).toString();
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
    const allGroups = useQuery(api.products.getAllCatalogGroups) as CatalogGroup[] | undefined;
    const taxonomy = useQuery(api.products.getCatalogTaxonomy);

    // ── Client-Side Filter + Sort + Facet Pipeline ──────────────────────────
    const { filtered, facets, totalCount } = useMemo(() => {
        if (!allGroups) return { filtered: [], facets: null, totalCount: 0 };

        let result = [...allGroups];
        const total = result.length;

        // Search (multi-field)
        if (filters.search) {
            const term = filters.search.toLowerCase();
            result = result.filter((g) =>
                g.displayName.toLowerCase().includes(term) ||
                g.family?.toLowerCase().includes(term) ||
                g.color?.toLowerCase().includes(term) ||
                g.capacity?.toLowerCase().includes(term) ||
                g.neckThreadSize?.toLowerCase().includes(term) ||
                g.bottleCollection?.toLowerCase().includes(term) ||
                g.slug.toLowerCase().includes(term),
            );
        }

        // Category
        if (filters.category) {
            result = result.filter((g) => g.category === filters.category);
        }

        // Collection
        if (filters.collection) {
            result = result.filter((g) => g.bottleCollection === filters.collection);
        }

        // Families (multi-select)
        if (filters.families.length > 0) {
            const set = new Set(filters.families);
            result = result.filter((g) => g.family && set.has(g.family));
        }

        // Colors (multi-select)
        if (filters.colors.length > 0) {
            const set = new Set(filters.colors);
            result = result.filter((g) => g.color && set.has(g.color));
        }

        // Capacities (multi-select)
        if (filters.capacities.length > 0) {
            const set = new Set(filters.capacities);
            result = result.filter((g) => g.capacity && set.has(g.capacity));
        }

        // Neck thread sizes (multi-select)
        if (filters.neckThreadSizes.length > 0) {
            const set = new Set(filters.neckThreadSizes);
            result = result.filter((g) => g.neckThreadSize && set.has(g.neckThreadSize));
        }

        // Component type
        if (filters.componentType) {
            result = result.filter((g) => classifyComponentType(g.displayName, g.family) === filters.componentType);
        }

        // Price range
        if (filters.priceMin !== null) {
            result = result.filter((g) => g.priceRangeMin !== null && g.priceRangeMin >= filters.priceMin!);
        }
        if (filters.priceMax !== null) {
            result = result.filter((g) => g.priceRangeMin !== null && g.priceRangeMin <= filters.priceMax!);
        }

        // Compute facets from filtered set
        const facetData: Facets = {
            categories: countBy(result, (g) => g.category),
            collections: countBy(result, (g) => g.bottleCollection),
            families: countBy(result, (g) => g.family),
            colors: countBy(result, (g) => g.color),
            capacities: {},
            neckThreadSizes: countBy(result, (g) => g.neckThreadSize),
            componentTypes: countBy(result, (g) => classifyComponentType(g.displayName, g.family)),
            priceRange: { min: Infinity, max: -Infinity },
        };

        const capMap: Record<string, { ml: number | null; count: number }> = {};
        for (const g of result) {
            if (g.capacity) {
                if (!capMap[g.capacity]) capMap[g.capacity] = { ml: g.capacityMl ?? null, count: 0 };
                capMap[g.capacity].count++;
            }
            if (g.priceRangeMin !== null && g.priceRangeMin !== undefined) {
                if (g.priceRangeMin < facetData.priceRange.min) facetData.priceRange.min = g.priceRangeMin;
                if (g.priceRangeMin > facetData.priceRange.max) facetData.priceRange.max = g.priceRangeMin;
            }
        }
        facetData.capacities = Object.fromEntries(
            Object.entries(capMap).map(([label, data]) => [label, { label, ...data }]),
        );

        if (facetData.priceRange.min === Infinity) facetData.priceRange = { min: 0, max: 0 };

        // Sort
        if (sortBy === "price-asc") {
            result.sort((a, b) => (a.priceRangeMin ?? Infinity) - (b.priceRangeMin ?? Infinity));
        } else if (sortBy === "price-desc") {
            result.sort((a, b) => (b.priceRangeMin ?? -Infinity) - (a.priceRangeMin ?? -Infinity));
        } else if (sortBy === "name-asc") {
            result.sort((a, b) => a.displayName.localeCompare(b.displayName));
        } else if (sortBy === "name-desc") {
            result.sort((a, b) => b.displayName.localeCompare(a.displayName));
        } else if (sortBy === "variants-desc") {
            result.sort((a, b) => (b.variantCount ?? 0) - (a.variantCount ?? 0));
        }

        return { filtered: result, facets: facetData, totalCount: total };
    }, [allGroups, filters, sortBy]);

    const visibleProducts = filtered.slice(0, visibleCount);
    const hasMore = visibleCount < filtered.length;
    const isLoading = allGroups === undefined;

    // ── Handler Functions ────────────────────────────────────────────────────

    const handleFilterChange = useCallback(
        (patch: Partial<CatalogFilters>) => {
            setFilters((prev) => {
                const next = { ...prev, ...patch };
                // Using a timeout defers the URL update until after the render cycle completes
                setTimeout(() => pushToUrl(next, sortBy), 0);
                return next;
            });
            setVisibleCount(PAGE_SIZE);
            setMobileFilterOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
        },
        [pushToUrl, sortBy],
    );

    const handleClearAll = useCallback(() => {
        setFilters(EMPTY_FILTERS);
        setVisibleCount(PAGE_SIZE);
        setSearchInput("");
        pushToUrl(EMPTY_FILTERS, sortBy);
    }, [pushToUrl, sortBy]);

    const handleSortChange = useCallback(
        (value: SortValue) => {
            setSortBy(value);
            setVisibleCount(PAGE_SIZE);
            pushToUrl(filters, value);
        },
        [pushToUrl, filters],
    );

    const handleSearchInput = useCallback(
        (term: string) => {
            setSearchInput(term);
            clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = setTimeout(() => {
                handleFilterChange({ search: term || "" });
            }, SEARCH_DEBOUNCE_MS);
        },
        [handleFilterChange],
    );

    const toggleCategory = useCallback((cat: string) => {
        setExpandedCategories((prev) => ({ ...prev, [cat]: prev[cat] === false ? true : !prev[cat] ? false : !prev[cat] }));
    }, []);

    // Build active filter chips
    const chips: Array<{ label: string; onRemove: () => void }> = [];
    if (filters.category) chips.push({ label: filters.category, onRemove: () => handleFilterChange({ category: null }) });
    if (filters.collection) chips.push({ label: filters.collection, onRemove: () => handleFilterChange({ collection: null }) });
    for (const f of filters.families) chips.push({ label: f, onRemove: () => handleFilterChange({ families: filters.families.filter((x) => x !== f) }) });
    for (const c of filters.colors) chips.push({ label: c, onRemove: () => handleFilterChange({ colors: filters.colors.filter((x) => x !== c) }) });
    for (const cap of filters.capacities) chips.push({ label: cap, onRemove: () => handleFilterChange({ capacities: filters.capacities.filter((x) => x !== cap) }) });
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
        <main className="min-h-screen bg-bone pt-[104px]">
            <Navbar variant="catalog" initialSearchValue={filters.search || undefined} />

            <div className="max-w-[1440px] mx-auto px-6 py-8">

                {/* Catalog Header */}
                <div className="mb-12 border-b border-champagne/50 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="font-serif text-4xl lg:text-5xl text-obsidian font-medium leading-[1.1] mb-2">Master Catalog</h1>
                        <p className="text-slate text-sm max-w-xl">
                            {totalCount > 0 ? `${totalCount.toLocaleString()} product groups.` : "Loading catalog..."}
                            {" "}Or, let Grace guide you directly to the perfect vessel.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="shrink-0">
                        <div className="flex items-center border border-champagne rounded-full px-4 py-2.5 bg-white/80 space-x-2 w-full md:w-80 hover:border-muted-gold transition-colors focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/20">
                            <Search className="w-4 h-4 text-slate shrink-0" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                placeholder="Search products, SKUs, families..."
                                className="bg-transparent text-sm focus:outline-none w-full placeholder-slate/60 text-obsidian"
                            />
                            {searchInput && (
                                <button onClick={() => handleSearchInput("")} className="shrink-0">
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
                            className="mb-6 flex flex-wrap items-center gap-2"
                        >
                            <span className="text-xs uppercase tracking-wider font-semibold text-slate">Active Filters:</span>
                            {chips.map((chip, i) => (
                                <span
                                    key={`${chip.label}-${i}`}
                                    className="inline-flex items-center px-3 py-1.5 bg-muted-gold/10 text-muted-gold border border-muted-gold/30 text-xs font-semibold rounded-full"
                                >
                                    <span className="truncate max-w-[160px]">{chip.label}</span>
                                    <button onClick={chip.onRemove} className="ml-2 hover:text-obsidian transition-colors shrink-0">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            {chips.length >= 2 && (
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
                <div className="lg:hidden mb-4 flex items-center gap-3">
                    <button
                        onClick={() => setMobileFilterOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-champagne rounded-lg text-sm font-medium text-obsidian hover:border-muted-gold transition-colors"
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        Filters
                        {activeFilterCount(filters) > 0 && (
                            <span className="w-5 h-5 rounded-full bg-muted-gold text-white text-[10px] flex items-center justify-center font-bold">
                                {activeFilterCount(filters)}
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
                            {SORT_OPTIONS.map((opt) => (
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
                                className="fixed top-0 left-0 bottom-0 z-50 w-[300px] max-w-[85vw] bg-bone overflow-y-auto lg:hidden"
                                style={{ boxShadow: "8px 0 40px rgba(29,29,31,0.15)" }}
                            >
                                <div className="flex items-center justify-between px-5 py-4 border-b border-champagne/50 sticky top-0 bg-bone z-10">
                                    <h3 className="font-serif text-lg text-obsidian font-medium">Filters</h3>
                                    <button
                                        onClick={() => setMobileFilterOpen(false)}
                                        className="p-1.5 rounded-lg hover:bg-champagne/40 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-slate" />
                                    </button>
                                </div>
                                <div className="px-5 py-4">
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
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                <div className="flex flex-col lg:flex-row items-start lg:space-x-12">

                    {/* Desktop Sidebar */}
                    <aside className="hidden lg:block w-72 shrink-0 sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto hide-scroll pb-12">
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
                    <div className="flex-1 w-full pb-32 border-l-0 lg:border-l border-champagne/30 lg:pl-12">

                        {/* Results Header */}
                        <div className="sticky top-[104px] z-30 bg-bone/95 backdrop-blur-md pt-4 pb-2 mb-6 sm:mb-8 border-b-2 border-obsidian">
                            <div className="flex items-end justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-1">
                                        {filters.search ? "Search Results" : "Catalog"}
                                    </p>
                                    <h2 className="font-serif text-xl sm:text-3xl font-medium text-obsidian truncate">
                                        {filters.search
                                            ? `"${filters.search}"`
                                            : filters.category || filters.collection || (filters.families.length === 1 ? filters.families[0] : "All Products")}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {/* Desktop Sort */}
                                    <div className="relative hidden lg:block">
                                        <select
                                            value={sortBy}
                                            onChange={(e) => handleSortChange(e.target.value as SortValue)}
                                            className="appearance-none bg-white border border-champagne rounded-lg px-3 py-1.5 text-xs text-obsidian pr-7 focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/20 outline-none cursor-pointer"
                                        >
                                            {SORT_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate pointer-events-none" />
                                    </div>

                                    <span className="px-2 sm:px-3 py-1 bg-white border border-champagne text-[10px] sm:text-xs font-semibold text-slate uppercase rounded-full whitespace-nowrap">
                                        {filtered.length} {filtered.length === 1 ? "Product" : "Products"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Loading */}
                        {isLoading && <SkeletonGrid />}

                        {/* Empty State */}
                        {!isLoading && filtered.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <Package className="w-16 h-16 text-champagne mb-6" strokeWidth={1} />
                                <h3 className="font-serif text-2xl text-obsidian mb-3">No products found</h3>
                                <p className="text-slate text-sm max-w-md mb-4">
                                    {filters.search
                                        ? `No products match "${filters.search}".`
                                        : "No products match your current filters."}
                                </p>
                                {chips.length > 0 && (
                                    <p className="text-slate text-xs mb-8">
                                        Try removing {chips.length === 1 ? "your filter" : "some filters"} to see more results.
                                    </p>
                                )}
                                <button
                                    onClick={handleClearAll}
                                    className="px-6 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors"
                                >
                                    Browse All Products
                                </button>
                            </div>
                        )}

                        {/* Product Grid */}
                        {visibleProducts.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                                {visibleProducts.map((group: CatalogGroup, pIndex: number) => (
                                    <ProductGroupCard key={group._id} group={group} index={pIndex} />
                                ))}
                            </div>
                        )}

                        {/* Load More */}
                        {hasMore && (
                            <div className="flex flex-col items-center py-12 mt-8 border-t border-champagne/40">
                                <p className="text-xs text-slate mb-4">
                                    Showing {visibleCount} of {filtered.length} products
                                </p>
                                <button
                                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
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
                <main className="min-h-screen bg-bone pt-[104px]">
                    <div className="max-w-[1440px] mx-auto px-6 py-8">
                        <div className="mb-12 border-b border-champagne/50 pb-8">
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
