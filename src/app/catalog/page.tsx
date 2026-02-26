"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, ArrowRight, Filter, X, Package, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import CartDrawer from "@/components/CartDrawer";
import Navbar from "@/components/Navbar";

// -- Helper: Format price --
function formatPrice(price: number | null): string {
    if (!price) return "—";
    return `$${price.toFixed(2)}`;
}

// -- Stock Badge --
function StockBadge({ status }: { status: string | null }) {
    const inStock = status === "In Stock";
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full ${inStock
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-600 border border-red-200"
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${inStock ? "bg-emerald-500" : "bg-red-400"}`}></span>
            {status || "Unknown"}
        </span>
    );
}

// -- Product Group Card --
function ProductGroupCard({ group, index }: { group: any; index: number }) {
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
                    {/* Placeholder — replaced by paper doll render in Phase 5 */}
                    <div className="flex flex-col items-center justify-center text-center p-4">
                        <Package className="w-12 h-12 text-champagne mb-3" strokeWidth={1} />
                        <p className="text-[10px] text-slate/60 uppercase tracking-wider font-medium leading-tight max-w-[120px]">
                            {group.family}
                        </p>
                    </div>
                    <div className="absolute inset-0 bg-transparent group-hover:bg-obsidian/5 transition-colors duration-300 pointer-events-none"></div>

                    {/* Variant count badge */}
                    <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full bg-obsidian/80 text-white">
                            {group.variantCount} variant{group.variantCount !== 1 ? "s" : ""}
                        </span>
                    </div>

                    {/* Configure CTA */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-white/95 to-white/60 backdrop-blur-sm border-t border-white/50">
                        <div className="w-full py-2 bg-obsidian text-white text-[11px] uppercase font-bold tracking-wider text-center hover:bg-muted-gold transition-colors">
                            Configure <ArrowRight className="inline w-3 h-3 ml-1" />
                        </div>
                    </div>
                </div>

                <div className="p-5 flex flex-col flex-1">
                    <p className="text-[10px] text-slate uppercase tracking-wider font-bold mb-1">{group.category}</p>
                    <h4 className="font-serif text-lg text-obsidian font-medium mb-2 flex-1 leading-snug">{group.displayName}</h4>

                    {/* Specs row */}
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

// -- Main Catalog Content (needs useSearchParams in Suspense) --
function CatalogContent() {
    const searchParams = useSearchParams();
    const urlCollection = searchParams.get("collection");
    const urlFamily = searchParams.get("family");
    const urlCategory = searchParams.get("category");
    const urlSearch = searchParams.get("search");

    const [cartOpen, setCartOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(urlSearch ?? "");
    const [activeFilter, setActiveFilter] = useState<{
        type: "collection" | "family" | "category" | "search" | null;
        value: string;
    }>({
        type: urlSearch ? "search" : urlCollection ? "collection" : urlFamily ? "family" : urlCategory ? "category" : null,
        value: urlSearch ?? urlCollection ?? urlFamily ?? urlCategory ?? "",
    });
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    // Sync state when URL params change (e.g. navbar search navigates to /catalog?search=...)
    useEffect(() => {
        const hasSearch = urlSearch != null && urlSearch.trim().length > 0;
        if (hasSearch) {
            setSearchTerm(urlSearch!);
            setActiveFilter({ type: "search", value: urlSearch! });
        } else if (urlCollection) {
            setSearchTerm("");
            setActiveFilter({ type: "collection", value: urlCollection });
        } else if (urlFamily) {
            setSearchTerm("");
            setActiveFilter({ type: "family", value: urlFamily });
        } else if (urlCategory) {
            setSearchTerm("");
            setActiveFilter({ type: "category", value: urlCategory });
        } else {
            setSearchTerm("");
            setActiveFilter({ type: null, value: "" });
        }
    }, [urlSearch, urlCollection, urlFamily, urlCategory]);

    // ─── Convex Queries ──────────────────────────────────────────────────────
    const taxonomy = useQuery(api.products.getCatalogTaxonomy);
    const stats = useQuery(api.products.getHomepageStats);

    // Determine which query to run based on active filter
    const groups = useQuery(api.products.getCatalogGroups, {
        collection: activeFilter.type === "collection" ? activeFilter.value : undefined,
        family: activeFilter.type === "family" ? activeFilter.value : undefined,
        category: activeFilter.type === "category" ? activeFilter.value : undefined,
        searchTerm: activeFilter.type === "search" ? activeFilter.value : undefined,
        limit: 100,
    });

    // Determine what to display
    const displayProducts = groups;
    const isLoading = displayProducts === undefined;

    // Build sidebar data from taxonomy
    const sidebarData = useMemo(() => {
        if (!taxonomy) return [];

        // Priority order for categories
        const categoryOrder = [
            "Glass Bottle", "Cream Jar", "Lotion Bottle", "Aluminum Bottle",
            "Component", "Cap/Closure", "Roll-On Cap", "Accessory",
            "Packaging Box", "Other"
        ];

        return categoryOrder
            .filter(cat => taxonomy[cat])
            .map(cat => ({
                category: cat,
                collections: Object.entries(taxonomy[cat])
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([name, count]) => ({ name, count: count as number })),
                totalCount: Object.values(taxonomy[cat]).reduce((sum, c) => sum + (c as number), 0) as number,
            }));
    }, [taxonomy]);

    // Handler functions
    const handleFilterClick = (type: "collection" | "family" | "category", value: string) => {
        setActiveFilter({ type, value });
        setSearchTerm("");
        // Scroll to top of content
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSearch = (term: string) => {
        setSearchTerm(term);
        if (term.length >= 2) {
            setActiveFilter({ type: "search", value: term });
        } else if (term.length === 0) {
            setActiveFilter({ type: null, value: "" });
        }
    };

    const clearFilter = () => {
        setActiveFilter({ type: null, value: "" });
        setSearchTerm("");
    };

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    // Active filter display name
    const activeFilterLabel = activeFilter.value || "All Products";

    return (
        <main className="min-h-screen bg-bone pt-[104px]">
            <Navbar onCartOpen={() => setCartOpen(true)} variant="catalog" initialSearchValue={urlSearch ?? undefined} />
            <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

            <div className="max-w-[1440px] mx-auto px-6 py-8">

                {/* Catalog Header */}
                <div className="mb-12 border-b border-champagne/50 pb-8 flex flex-col md:flex-row md:items-end justify-between">
                    <div>
                        <h1 className="font-serif text-4xl lg:text-5xl text-obsidian font-medium leading-[1.1] mb-2">Master Catalog</h1>
                        <p className="text-slate text-sm max-w-xl">
                            {stats ? `${stats.totalProducts.toLocaleString()} products across ${Object.keys(stats.collectionCounts).length} curated collections.` : "Loading catalog..."}
                            {" "}Or, let Grace guide you directly to the perfect vessel.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="mt-6 md:mt-0">
                        <div className="flex items-center border border-champagne rounded-full px-4 py-2.5 bg-white/80 space-x-2 w-full md:w-80 hover:border-muted-gold transition-colors focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/20">
                            <Search className="w-4 h-4 text-slate shrink-0" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder="Search products, SKUs, families..."
                                className="bg-transparent text-sm focus:outline-none w-full placeholder-slate/60 text-obsidian"
                            />
                            {searchTerm && (
                                <button onClick={() => handleSearch("")} className="shrink-0">
                                    <X className="w-4 h-4 text-slate hover:text-obsidian transition-colors" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Active Filter Chip */}
                <AnimatePresence>
                    {activeFilter.type && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-6 flex items-center space-x-3"
                        >
                            <span className="text-xs uppercase tracking-wider font-semibold text-slate">Showing:</span>
                            <span className="inline-flex items-center px-4 py-1.5 bg-muted-gold/10 text-muted-gold border border-muted-gold/30 text-sm font-semibold rounded-full">
                                {activeFilterLabel}
                                <button onClick={clearFilter} className="ml-2 hover:text-obsidian transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </span>
                            {displayProducts && (
                                <span className="text-xs text-slate">
                                    {displayProducts.length} product{displayProducts.length !== 1 ? "s" : ""}
                                </span>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col lg:flex-row items-start lg:space-x-12">

                    {/* Sticky Sidebar Taxonomy (LIVE DATA) */}
                    <aside className="hidden lg:block w-72 shrink-0 sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto hide-scroll pb-12">
                        <h3 className="font-serif text-xl text-obsidian border-b border-champagne pb-3 mb-6">Browse</h3>

                        {/* All Products */}
                        <button
                            onClick={clearFilter}
                            className={`block text-left text-sm transition-colors w-full mb-6 pb-4 border-b border-champagne/30 ${!activeFilter.type ? "text-muted-gold font-semibold" : "text-obsidian hover:text-muted-gold"
                                }`}
                        >
                            All Products {stats ? `(${stats.totalProducts.toLocaleString()})` : ""}
                        </button>

                        {sidebarData.map((group) => (
                            <div key={group.category} className="mb-4">
                                <button
                                    onClick={() => toggleCategory(group.category)}
                                    className="flex items-center justify-between w-full text-xs uppercase tracking-wider font-bold text-slate mb-3 hover:text-obsidian transition-colors"
                                >
                                    <span>{group.category} ({group.totalCount})</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedCategories[group.category] !== false ? "rotate-0" : "-rotate-90"}`} />
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
                                            <div className="space-y-1.5 border-l border-champagne ml-2 pl-4 mb-6">
                                                {/* Category-level filter */}
                                                <button
                                                    onClick={() => handleFilterClick("category", group.category)}
                                                    className={`block text-left text-[13px] transition-colors w-full py-0.5 ${activeFilter.type === "category" && activeFilter.value === group.category
                                                        ? "text-muted-gold font-semibold"
                                                        : "text-obsidian/70 hover:text-muted-gold"
                                                        }`}
                                                >
                                                    All {group.category} ({group.totalCount})
                                                </button>
                                                {/* Collection-level filters */}
                                                {group.collections.map(col => (
                                                    <button
                                                        key={col.name}
                                                        onClick={() => handleFilterClick("collection", col.name)}
                                                        className={`block text-left text-[13px] transition-colors w-full py-0.5 ${activeFilter.type === "collection" && activeFilter.value === col.name
                                                            ? "text-muted-gold font-semibold"
                                                            : "text-obsidian/70 hover:text-muted-gold"
                                                            }`}
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

                        {/* Quick Family Filters */}
                        <div className="mt-8 pt-8 border-t border-champagne/40">
                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-4">Design Families</p>
                            <div className="space-y-1.5">
                                {["Elegant", "Cylinder", "Circle", "Diva", "Empire", "Slim", "Boston Round", "Sleek", "Diamond", "Royal", "Round", "Square"].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => handleFilterClick("family", f)}
                                        className={`block text-left text-[13px] transition-colors w-full py-0.5 ${activeFilter.type === "family" && activeFilter.value === f
                                            ? "text-muted-gold font-semibold"
                                            : "text-obsidian/70 hover:text-muted-gold"
                                            }`}
                                    >
                                        {f} {stats?.familyCounts?.[f] ? `(${stats.familyCounts[f]})` : ""}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>

                    {/* Product Grid Content Area */}
                    <div className="flex-1 w-full pb-32 border-l-0 lg:border-l border-champagne/30 lg:pl-12">

                        {/* Results Header */}
                        <div className="sticky top-[104px] z-30 bg-bone/95 backdrop-blur-md pt-4 pb-2 mb-8 border-b-2 border-obsidian">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-1">
                                        {activeFilter.type === "search" ? "Search Results" : "Catalog"}
                                    </p>
                                    <h2 className="font-serif text-3xl font-medium text-obsidian">
                                        {activeFilter.value || "All Products"}
                                    </h2>
                                </div>
                                {displayProducts && (
                                    <span className="px-3 py-1 bg-white border border-champagne text-xs font-semibold text-slate uppercase rounded-full">
                                        {displayProducts.length} {displayProducts.length === 1 ? "Product" : "Products"}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Loading State */}
                        {isLoading && (
                            <div className="flex justify-center py-24">
                                <div className="flex flex-col items-center">
                                    <div className="w-10 h-10 rounded-full border-2 border-champagne border-t-muted-gold animate-spin mb-4"></div>
                                    <p className="text-xs uppercase tracking-widest font-semibold text-slate">Loading products...</p>
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {displayProducts && displayProducts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                <Package className="w-16 h-16 text-champagne mb-6" strokeWidth={1} />
                                <h3 className="font-serif text-2xl text-obsidian mb-3">No products found</h3>
                                <p className="text-slate text-sm max-w-md mb-8">
                                    {activeFilter.type === "search"
                                        ? `No products match "${activeFilter.value}". Try a different search term or browse by collection.`
                                        : "This collection is currently empty."}
                                </p>
                                <button
                                    onClick={clearFilter}
                                    className="px-6 py-3 bg-obsidian text-white uppercase text-xs font-bold tracking-wider hover:bg-muted-gold transition-colors"
                                >
                                    Browse All Products
                                </button>
                            </div>
                        )}

                        {/* Product Group Grid */}
                        {displayProducts && displayProducts.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                {displayProducts.map((group: any, pIndex: number) => (
                                    <ProductGroupCard
                                        key={group._id}
                                        group={group}
                                        index={pIndex}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Load indicator */}
                        {displayProducts && displayProducts.length >= 100 && (
                            <div className="flex justify-center py-16 border-t border-champagne/40 mt-12">
                                <div className="flex flex-col items-center opacity-60">
                                    <p className="text-xs uppercase tracking-widest font-semibold text-slate">
                                        Showing first 100 results. Use search or filters to narrow down.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

// -- Export with Suspense boundary for useSearchParams --
export default function CatalogPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-bone pt-[104px] flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full border-2 border-champagne border-t-muted-gold animate-spin mb-4"></div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-slate">Loading catalog...</p>
                </div>
            </main>
        }>
            <CatalogContent />
        </Suspense>
    );
}
