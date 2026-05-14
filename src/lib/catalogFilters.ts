// Option A: UI applicator buckets → product applicator values
// Each spray sub-type is its own bucket so it gets its own grid card and filter option
export const APPLICATOR_BUCKETS = [
    {
        value: "rollon",
        label: "Roll-On",
        productValues: ["Metal Roller Ball", "Plastic Roller Ball", "Metal Roller", "Plastic Roller"],
    },
    // Fine Mist Spray: atomizer-style, typically < 30 ml
    { value: "finemist", label: "Fine Mist Spray", productValues: ["Fine Mist Sprayer", "Atomizer"] },
    // Perfume Spray Pump: classic spray collar, typically ≥ 30 ml
    { value: "perfumespray", label: "Perfume Spray", productValues: ["Perfume Spray Pump"] },
    { value: "reducer", label: "Reducer", productValues: ["Reducer"] },
    { value: "dropper", label: "Dropper", productValues: ["Dropper"] },
    { value: "lotionpump", label: "Lotion Pump", productValues: ["Lotion Pump"] },
    { value: "antiquespray", label: "Vintage Bulb Spray", productValues: ["Vintage Bulb Sprayer", "Antique Bulb Sprayer"] },
    { value: "antiquespray-tassel", label: "Vintage Bulb Spray with Tassel", productValues: ["Vintage Bulb Sprayer with Tassel", "Antique Bulb Sprayer with Tassel"] },
] as const;

export type ApplicatorBucket = (typeof APPLICATOR_BUCKETS)[number]["value"];

// ─── Navigation-level applicator categories (single source of truth) ─────────
// Used by: HomePage start-here cards, GuidedSelector dispensers, Navbar mega menu.
// Each nav category maps to one or more fine-grained APPLICATOR_BUCKETS values.
export const APPLICATOR_NAV = [
    { value: "rollon", label: "Roll-On", subtitle: "Perfume oils, essential oils, topicals", buckets: ["rollon"] as ApplicatorBucket[] },
    { value: "spray", label: "Fine Mist & Spray", subtitle: "Fragrance, room scent, setting spray", buckets: ["finemist", "perfumespray"] as ApplicatorBucket[] },
    { value: "dropper", label: "Dropper", subtitle: "Serums, tinctures, CBD, essential oils", buckets: ["dropper"] as ApplicatorBucket[] },
    { value: "lotionpump", label: "Lotion Pump", subtitle: "Skincare, body care, serums", buckets: ["lotionpump"] as ApplicatorBucket[] },
    { value: "reducer", label: "Reducer", subtitle: "Aftershave, cologne, beard oil", buckets: ["reducer"] as ApplicatorBucket[] },
] as const;

export type ApplicatorNavValue = (typeof APPLICATOR_NAV)[number]["value"];

export const CAPACITY_RANGES = [
    { value: "miniature", label: "Miniature", detail: "1-5 ml", min: 1, max: 5 },
    { value: "small", label: "Small", detail: "6-15 ml", min: 6, max: 15 },
    { value: "medium", label: "Medium", detail: "25-50 ml", min: 25, max: 50 },
    { value: "large", label: "Large", detail: "55-120 ml", min: 55, max: 120 },
    { value: "bulk", label: "Bulk", detail: "128 ml+", min: 128, max: null },
] as const;

export type CapacityRangeValue = (typeof CAPACITY_RANGES)[number]["value"];

export function capacityInRange(ml: number | null | undefined, range: (typeof CAPACITY_RANGES)[number]): boolean {
    if (ml == null || ml <= 0) return false;
    return ml >= range.min && (range.max == null || ml <= range.max);
}

export function normalizeCatalogSearchText(value: string | null | undefined): string {
    if (!value) return "";
    let normalized = value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[–—]/g, "-")
        .replace(/(\d{1,4})\s*ml\b/g, "$1ml $1 ml")
        .replace(/\b(\d{1,3})\s*[-/]\s*(\d{3,4})\b/g, "$1-$2 $1/$2")
        .replace(/\broll[\s-]?on\b/g, "rollon roll-on roller rollerball roller ball")
        .replace(/\broller\s*ball\b/g, "rollon roll-on roller rollerball roller ball")
        .replace(/\brollerball\b/g, "rollon roll-on roller rollerball roller ball")
        .replace(/\bfine[\s-]?mist\b/g, "finemist fine mist atomizer spray sprayer")
        .replace(/\bperfume\s*spray\b/g, "perfumespray perfume spray sprayer atomizer")
        .replace(/\bbulb\b/g, "bulb vintage antique")
        .replace(/\bsprayers?\b/g, "sprayer spray")
        .replace(/\bspray\b/g, "spray sprayer")
        .replace(/\batomizers?\b/g, "atomizer spray sprayer finemist")
        .replace(/\bdroppers?\b/g, "dropper pipette")
        .replace(/\breducers?\b/g, "reducer orifice plug")
        .replace(/\blotion\s*pumps?\b/g, "lotionpump lotion pump")
        .replace(/\bbottles?\b/g, "bottle bottles")
        .replace(/\bcaps?\b/g, "cap closure lid")
        .replace(/\bclosures?\b/g, "closure cap lid")
        .replace(/\bamber\b/g, "amber brown")
        .replace(/\bbrown\b/g, "brown amber")
        .replace(/\bcobalt\b/g, "cobalt blue")
        .replace(/\bfrost(ed)?\b/g, "frosted frost")
        .replace(/[^\w\s/-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Add both spaced and compact capacity variants after punctuation cleanup.
    normalized = normalized.replace(/\b(\d{1,4})\s+ml\b/g, "$1ml $1 ml");
    return normalized;
}

export function catalogSearchTokens(query: string): string[] {
    const normalized = normalizeCatalogSearchText(query);
    if (!normalized) return [];
    const stopWords = new Set(["a", "an", "and", "for", "of", "the", "with"]);
    return Array.from(new Set(normalized.split(/\s+/).filter((token) => token.length > 0 && !stopWords.has(token))));
}

export function catalogSearchMatches(query: string, fields: Array<string | null | undefined>): boolean {
    const tokens = catalogSearchTokens(query);
    if (tokens.length === 0) return true;
    const haystack = normalizeCatalogSearchText(fields.filter(Boolean).join(" "));
    return tokens.every((token) => haystack.includes(token));
}

export function catalogSearchScore(query: string, weightedFields: Array<{ value: string | null | undefined; weight: number }>): number {
    const tokens = catalogSearchTokens(query);
    if (tokens.length === 0) return 0;

    return weightedFields.reduce((score, field) => {
        const text = normalizeCatalogSearchText(field.value);
        if (!text) return score;
        const matchedTokens = tokens.filter((token) => text.includes(token)).length;
        const exactPhraseBoost = text.includes(normalizeCatalogSearchText(query)) ? field.weight : 0;
        return score + matchedTokens * field.weight + exactPhraseBoost;
    }, 0);
}

export function catalogSearchResultTieBreak(
    a: {
        capacityMl?: number | null;
        family?: string | null;
        displayName?: string | null;
        slug?: string | null;
    },
    b: {
        capacityMl?: number | null;
        family?: string | null;
        displayName?: string | null;
        slug?: string | null;
    },
): number {
    const capacityDelta = (a.capacityMl ?? Infinity) - (b.capacityMl ?? Infinity);
    if (capacityDelta !== 0) return capacityDelta;

    const familyDelta = (a.family ?? "").localeCompare(b.family ?? "");
    if (familyDelta !== 0) return familyDelta;

    const nameDelta = (a.displayName ?? "").localeCompare(b.displayName ?? "");
    if (nameDelta !== 0) return nameDelta;

    return (a.slug ?? "").localeCompare(b.slug ?? "");
}

export function catalogSearchRecoverySuggestions(query: string): string[] {
    const normalized = normalizeCatalogSearchText(query);
    const suggestions: string[] = [];
    const add = (value: string) => {
        if (!value) return;
        const normalizedValue = normalizeCatalogSearchText(value);
        if (normalizedValue && normalizedValue !== normalized && !suggestions.some((s) => normalizeCatalogSearchText(s) === normalizedValue)) {
            suggestions.push(value);
        }
    };

    const mlMatch = normalized.match(/\b(\d{1,4})ml\b/);
    if (mlMatch) add(`${mlMatch[1]} ml`);
    if (/\brollon\b|\broller\b/.test(normalized)) add("roll-on");
    if (/\bspray\b|\bsprayer\b|\batomizer\b|\bfinemist\b/.test(normalized)) add("fine mist spray");
    if (/\bdropper\b|\bpipette\b/.test(normalized)) add("dropper");
    if (/\bamber\b|\bbrown\b/.test(normalized)) add("amber glass bottle");
    if (/\bblack\b/.test(normalized)) add("black cap");
    if (/\bessential\b|\boil\b|\bperfume\b|\bfragrance\b/.test(normalized)) add("essential oil bottle");

    add("10 ml roll-on");
    add("18-415");
    add("clear glass bottle");

    return suggestions.slice(0, 4);
}

/** Build a catalog URL query string for a nav-level applicator category. */
export function applicatorNavHref(navValue: ApplicatorNavValue): string {
    const nav = APPLICATOR_NAV.find((n) => n.value === navValue);
    if (!nav) return "/catalog";
    const params = new URLSearchParams();
    params.set("applicators", nav.buckets.join(","));
    return `/catalog?${params.toString()}`;
}

/** Build a catalog URL from multiple nav-level applicator values. */
export function applicatorNavHrefMulti(navValues: ApplicatorNavValue[]): string {
    const allBuckets = navValues.flatMap((v) => {
        const nav = APPLICATOR_NAV.find((n) => n.value === v);
        return nav ? nav.buckets : [];
    });
    if (!allBuckets.length) return "/catalog";
    const params = new URLSearchParams();
    params.set("applicators", allBuckets.join(","));
    return `/catalog?${params.toString()}`;
}

export function applicatorBucketMatchesProductValues(bucket: ApplicatorBucket, productApplicatorTypes: string[]): boolean {
    const def = APPLICATOR_BUCKETS.find((b) => b.value === bucket);
    if (!def) return false;
    return productApplicatorTypes.some((a) => (def.productValues as readonly string[]).includes(a));
}

export const SORT_OPTIONS = [
    { value: "featured", label: "By Design Family" },
    { value: "best-match", label: "Best Match" },
    { value: "price-asc", label: "Price: Low to High" },
    { value: "price-desc", label: "Price: High to Low" },
    { value: "name-asc", label: "Name: A–Z" },
    { value: "name-desc", label: "Name: Z–A" },
    { value: "capacity-asc", label: "Capacity: Small to Large" },
    { value: "capacity-desc", label: "Capacity: Large to Small" },
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

function getMultiParam(sp: URLSearchParams, key: string): string[] {
    return sp
        .getAll(key)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);
}

function getNonNegativeNumberParam(sp: URLSearchParams, key: string): number | null {
    const raw = sp.get(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function paramsToFilters(sp: URLSearchParams): { filters: CatalogFilters; sort: SortValue; view: ViewMode } {
    const applicatorValues = getMultiParam(sp, "applicators");
    const validApplicators = applicatorValues.filter((a) =>
        APPLICATOR_BUCKETS.some((b) => b.value === a)
    ) as ApplicatorBucket[];
    const familiesParam = getMultiParam(sp, "families");
    const viewParam = sp.get("view");
    const view: ViewMode = viewParam === "line" ? "line" : "visual";
    const search = (sp.get("search") || "").trim().replace(/\s+/g, " ");
    const sortParam = sp.get("sort") as SortValue | null;
    return {
        filters: {
            category: sp.get("category") || null,
            collection: sp.get("collection") || null,
            applicators: validApplicators,
            // Accept both ?families=Cylinder,Elegant (multi) and ?family=Cylinder (singular, used by Grace)
            families: familiesParam.length > 0 ? familiesParam : getMultiParam(sp, "family"),
            colors: getMultiParam(sp, "colors"),
            capacities: getMultiParam(sp, "capacities"),
            neckThreadSizes: getMultiParam(sp, "threads"),
            componentType: sp.get("componentType") || null,
            priceMin: getNonNegativeNumberParam(sp, "priceMin"),
            priceMax: getNonNegativeNumberParam(sp, "priceMax"),
            search,
        },
        sort: sortParam || (search ? "best-match" : "featured"),
        view,
    };
}
