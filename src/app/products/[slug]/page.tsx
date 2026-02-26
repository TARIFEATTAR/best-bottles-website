"use client";

import { useState, useEffect, useMemo, useCallback, use } from "react";
import Link from "next/link";
import {
    ShoppingBag, ArrowLeft, ChevronRight, Package,
    Check, Layers, Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import FitmentCarousel from "@/components/FitmentCarousel";
import FitmentDrawer from "@/components/FitmentDrawer";
import { useCart } from "@/components/CartProvider";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number | null | undefined): string {
    if (!price) return "—";
    return `$${price.toFixed(2)}`;
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

const COMPONENT_TYPE_ORDER = ["Reducer", "Roller Cap", "Roller", "Dropper", "Sprayer", "Lotion Pump", "Cap", "Accessory"];


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

function ComponentCard({ comp }: { comp: any }) {
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

    const data = useQuery(api.products.getProductGroup, { slug });

    const { addItems } = useCart();
    const [fitmentDrawerOpen, setFitmentDrawerOpen] = useState(false);
    const [selectedApplicator, setSelectedApplicator] = useState<string | null>(null);
    const [selectedTrimColor, setSelectedTrimColor] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"specs" | "components">("specs");
    const [qty, setQty] = useState(1);
    const [addedFlash, setAddedFlash] = useState(false);

    const group = data?.group;
    const variants: any[] = data?.variants ?? [];

    // ── Derived selector options ─────────────────────────────────────────────

    const applicatorOptions = useMemo(() => {
        const seen = new Set<string>();
        return variants
            .map((v) => v.applicator)
            .filter((a): a is string => !!a)
            .filter((a) => {
                if (seen.has(a)) return false;
                seen.add(a);
                return true;
            });
    }, [variants]);

    const trimColorOptions = useMemo(() => {
        const seen = new Set<string>();
        return variants
            .filter((v) => v.applicator === selectedApplicator)
            .map((v) => v.trimColor || "Standard")
            .filter((c) => {
                if (seen.has(c)) return false;
                seen.add(c);
                return true;
            });
    }, [variants, selectedApplicator]);

    // Auto-select first applicator when data arrives
    useEffect(() => {
        if (applicatorOptions.length > 0 && !selectedApplicator) {
            setSelectedApplicator(applicatorOptions[0]);
        }
    }, [applicatorOptions, selectedApplicator]);

    // Auto-select first trim color when applicator changes
    useEffect(() => {
        if (trimColorOptions.length > 0) {
            setSelectedTrimColor(trimColorOptions[0]);
        }
    }, [trimColorOptions]);

    // Resolved variant based on current selections
    const selectedVariant = useMemo(() => {
        return (
            variants.find(
                (v) =>
                    v.applicator === selectedApplicator &&
                    (v.trimColor || "Standard") === selectedTrimColor
            ) ??
            variants[0] ??
            null
        );
    }, [variants, selectedApplicator, selectedTrimColor]);

    // Components grouped by type from selected variant
    const componentGroups = useMemo(() => {
        const comps: any[] = selectedVariant?.components ?? [];
        const groups: Record<string, any[]> = {};
        for (const comp of comps) {
            const type = getComponentType(comp.grace_sku || "", comp.item_name);
            if (!groups[type]) groups[type] = [];
            groups[type].push(comp);
        }
        return groups;
    }, [selectedVariant]);

    const totalComponents = Object.values(componentGroups).reduce(
        (sum, arr) => sum + arr.length,
        0
    );

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
                <div className="pt-[104px] flex items-center justify-center min-h-screen">
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
                <div className="pt-[104px] max-w-[1440px] mx-auto px-4 sm:px-6 py-32 text-center">
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

            <div className="pt-[104px]">
                {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
                <div className="border-b border-champagne/50 bg-bone overflow-x-auto">
                    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex items-center space-x-2 text-xs text-slate whitespace-nowrap">
                        <Link href="/" className="hover:text-muted-gold transition-colors shrink-0">Home</Link>
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        <Link href="/catalog" className="hover:text-muted-gold transition-colors shrink-0">Catalog</Link>
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        <Link
                            href={`/catalog?family=${encodeURIComponent(group.family)}`}
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

                            {/* Variant thumbnail strip */}
                            {variants.length > 1 && (
                                <div className="mt-3 flex space-x-2 overflow-x-auto pb-1">
                                    {variants.slice(0, 10).map((v) => (
                                        <button
                                            key={v._id}
                                            onClick={() => {
                                                setSelectedApplicator(v.applicator ?? null);
                                                setSelectedTrimColor(v.trimColor || "Standard");
                                            }}
                                            className={`shrink-0 w-14 h-14 rounded-sm border-2 transition-all bg-travertine flex items-center justify-center ${selectedVariant?._id === v._id
                                                ? "border-muted-gold"
                                                : "border-champagne/50 hover:border-muted-gold/60"
                                                }`}
                                            title={`${v.applicator ?? ""}${v.trimColor ? ` — ${v.trimColor}` : ""}`}
                                        >
                                            {v.imageUrl ? (
                                                <img src={v.imageUrl} alt="" className="w-full h-full object-contain p-1" />
                                            ) : (
                                                <Package className="w-5 h-5 text-champagne" strokeWidth={1} />
                                            )}
                                        </button>
                                    ))}
                                    {variants.length > 10 && (
                                        <div className="shrink-0 w-14 h-14 rounded-sm border-2 border-champagne/50 bg-travertine flex items-center justify-center">
                                            <span className="text-[10px] text-slate font-semibold">+{variants.length - 10}</span>
                                        </div>
                                    )}
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

                            {/* ── Variant Selectors ──────────────────────────────────── */}

                            {/* Applicator selector */}
                            {applicatorOptions.length > 0 && (
                                <div className="mb-6">
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">Applicator</p>
                                    <div className="flex flex-wrap gap-2">
                                        {applicatorOptions.map((appl) => (
                                            <button
                                                key={appl}
                                                onClick={() => {
                                                    setSelectedApplicator(appl);
                                                    setSelectedTrimColor(null);
                                                }}
                                                className={`px-4 py-2 text-sm font-medium border rounded-sm transition-all ${selectedApplicator === appl
                                                    ? "border-obsidian bg-obsidian text-white"
                                                    : "border-champagne text-obsidian hover:border-muted-gold"
                                                    }`}
                                            >
                                                {appl}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Finish / trim color selector */}
                            {trimColorOptions.length > 0 && (
                                <div className="mb-8">
                                    <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">
                                        Finish
                                        {selectedTrimColor && (
                                            <span className="ml-2 normal-case font-medium text-obsidian">{selectedTrimColor}</span>
                                        )}
                                    </p>
                                    <div className="flex flex-wrap gap-2.5">
                                        {trimColorOptions.map((color) => {
                                            const hex = COLOR_SWATCH[color] ?? "#AAAAAA";
                                            const isSelected = selectedTrimColor === color;
                                            const useDarkCheck = LIGHT_SWATCHES.has(color);
                                            return (
                                                <button
                                                    key={color}
                                                    onClick={() => setSelectedTrimColor(color)}
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
                                    onClick={() => {
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
                                    }}
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

                            {/* Swap Fitment CTA */}
                            <button
                                onClick={() => setFitmentDrawerOpen(true)}
                                className="w-full mb-6 py-2.5 flex items-center justify-center space-x-2 border border-champagne text-obsidian text-xs font-semibold uppercase tracking-widest hover:border-muted-gold hover:text-muted-gold transition-colors bg-white"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-gold"></span>
                                <span>Swap Applicator Type</span>
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
                            {(["specs", "components"] as const).map((tab) => (
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
                                            <SpecRow label="Cap Style" value={selectedVariant.capStyle} />
                                            <SpecRow label="Trim Finish" value={selectedVariant.trimColor} />
                                            <SpecRow label="Cap Color" value={selectedVariant.capColor} />
                                            <SpecRow label="Category" value={selectedVariant.category} />
                                            <SpecRow label="Collection" value={selectedVariant.bottleCollection} />
                                        </dl>
                                        {selectedVariant.itemDescription && (
                                            <div className="mt-8 pt-8 border-t border-champagne/50">
                                                <p className="text-xs uppercase tracking-wider font-bold text-slate mb-3">Description</p>
                                                <p className="text-sm text-obsidian/80 leading-relaxed">{selectedVariant.itemDescription}</p>
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
                                                            {componentGroups[type].map((comp: any) => (
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
                <div className="h-24 bg-linen border-t border-champagne/30"></div>
            </div>
        </main>
    );
}
