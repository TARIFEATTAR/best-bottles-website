// Option A: UI applicator buckets → product applicator values
export const APPLICATOR_BUCKETS = [
    { value: "rollon", label: "Roll-on", productValues: ["Metal Roller", "Plastic Roller"] },
    { value: "spray", label: "Spray", productValues: ["Fine Mist Sprayer", "Atomizer", "Antique Bulb Sprayer", "Antique Bulb Sprayer with Tassel"] },
    { value: "reducer", label: "Reducer", productValues: ["Reducer"] },
    { value: "dropper", label: "Dropper", productValues: ["Dropper"] },
    { value: "lotionpump", label: "Lotion Pump", productValues: ["Lotion Pump"] },
] as const;

export type ApplicatorBucket = (typeof APPLICATOR_BUCKETS)[number]["value"];

export function applicatorBucketMatchesProductValues(bucket: ApplicatorBucket, productApplicatorTypes: string[]): boolean {
    const def = APPLICATOR_BUCKETS.find((b) => b.value === bucket);
    if (!def) return false;
    return productApplicatorTypes.some((a) => (def.productValues as readonly string[]).includes(a));
}

export const SORT_OPTIONS = [
    { value: "featured", label: "By Design Family" },
    { value: "price-asc", label: "Price: Low to High" },
    { value: "price-desc", label: "Price: High to Low" },
    { value: "name-asc", label: "Name: A–Z" },
    { value: "name-desc", label: "Name: Z–A" },
    { value: "variants-desc", label: "Most Variants" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const VIEW_MODES = ["visual", "line"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export interface CatalogFilters {
    category: string | null;
    collection: string | null;
    applicators: ApplicatorBucket[];
    families: string[];
    colors: string[];
    capacities: string[];
    neckThreadSizes: string[];
    componentType: string | null;
    priceMin: number | null;
    priceMax: number | null;
    search: string;
}

export const EMPTY_FILTERS: CatalogFilters = {
    category: null,
    collection: null,
    applicators: [],
    families: [],
    colors: [],
    capacities: [],
    neckThreadSizes: [],
    componentType: null,
    priceMin: null,
    priceMax: null,
    search: "",
};

export function classifyComponentType(displayName: string, family: string | null): string | null {
    const name = displayName.toLowerCase();
    const fam = (family ?? "").toLowerCase();
    if (name.includes("sprayer") || name.includes("atomizer") || name.includes("bulb") || fam.includes("sprayer")) return "Sprayer";
    if (name.includes("dropper") || fam.includes("dropper")) return "Dropper";
    if (name.includes("lotion") && name.includes("pump") || fam.includes("lotion pump")) return "Lotion Pump";
    if (name.includes("roll-on") || name.includes("roll on") || fam.includes("roll-on")) return "Roll-On";
    if (name.includes("roller") || fam.includes("roller")) return "Roller";
    if (name.includes("reducer") || fam.includes("reducer")) return "Reducer";
    if (name.includes("cap") || name.includes("closure") || fam.includes("cap")) return "Cap";
    return null;
}

export function filtersAreEmpty(f: CatalogFilters): boolean {
    return (
        !f.category && !f.collection && f.applicators.length === 0 &&
        f.families.length === 0 && f.colors.length === 0 && f.capacities.length === 0 &&
        f.neckThreadSizes.length === 0 && !f.componentType &&
        f.priceMin === null && f.priceMax === null && !f.search
    );
}

export function activeFilterCount(f: CatalogFilters): number {
    let n = 0;
    if (f.category) n++;
    if (f.collection) n++;
    n += f.applicators.length;
    n += f.families.length;
    n += f.colors.length;
    n += f.capacities.length;
    n += f.neckThreadSizes.length;
    if (f.componentType) n++;
    if (f.priceMin !== null || f.priceMax !== null) n++;
    if (f.search) n++;
    return n;
}

export function filtersToParams(f: CatalogFilters, sort: SortValue, view: ViewMode = "visual"): URLSearchParams {
    const p = new URLSearchParams();
    if (f.category) p.set("category", f.category);
    if (f.collection) p.set("collection", f.collection);
    if (f.applicators.length) p.set("applicators", f.applicators.join(","));
    if (f.families.length) p.set("families", f.families.join(","));
    if (f.colors.length) p.set("colors", f.colors.join(","));
    if (f.capacities.length) p.set("capacities", f.capacities.join(","));
    if (f.neckThreadSizes.length) p.set("threads", f.neckThreadSizes.join(","));
    if (f.componentType) p.set("componentType", f.componentType);
    if (f.priceMin !== null) p.set("priceMin", String(f.priceMin));
    if (f.priceMax !== null) p.set("priceMax", String(f.priceMax));
    if (f.search) p.set("search", f.search);
    if (sort !== "featured") p.set("sort", sort);
    if (view !== "visual") p.set("view", view);
    return p;
}

export function paramsToFilters(sp: URLSearchParams): { filters: CatalogFilters; sort: SortValue; view: ViewMode } {
    const applicatorValues = sp.get("applicators")?.split(",").filter(Boolean) ?? [];
    const validApplicators = applicatorValues.filter((a) =>
        APPLICATOR_BUCKETS.some((b) => b.value === a)
    ) as ApplicatorBucket[];
    const viewParam = sp.get("view");
    const view: ViewMode = viewParam === "line" ? "line" : "visual";
    return {
        filters: {
            category: sp.get("category") || null,
            collection: sp.get("collection") || null,
            applicators: validApplicators,
            families: sp.get("families")?.split(",").filter(Boolean) ?? [],
            colors: sp.get("colors")?.split(",").filter(Boolean) ?? [],
            capacities: sp.get("capacities")?.split(",").filter(Boolean) ?? [],
            neckThreadSizes: sp.get("threads")?.split(",").filter(Boolean) ?? [],
            componentType: sp.get("componentType") || null,
            priceMin: sp.get("priceMin") ? Number(sp.get("priceMin")) : null,
            priceMax: sp.get("priceMax") ? Number(sp.get("priceMax")) : null,
            search: sp.get("search") || "",
        },
        sort: (sp.get("sort") as SortValue) || "featured",
        view,
    };
}
