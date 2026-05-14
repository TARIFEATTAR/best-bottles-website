/**
 * Catalog Filters — Comprehensive Unit Tests
 *
 * Tests filter serialization, URL round-trips, applicator matching,
 * component classification, and edge cases that affect real user journeys.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    APPLICATOR_BUCKETS,
    APPLICATOR_NAV,
    EMPTY_FILTERS,
    SORT_OPTIONS,
    activeFilterCount,
    applicatorBucketMatchesProductValues,
    applicatorNavHref,
    applicatorNavHrefMulti,
    catalogSearchMatches,
    catalogSearchRecoverySuggestions,
    catalogSearchResultTieBreak,
    catalogSearchScore,
    classifyComponentType,
    filtersAreEmpty,
    filtersToParams,
    paramsToFilters,
    type ApplicatorBucket,
    type CatalogFilters,
    type SortValue,
} from "../src/lib/catalogFilters";

type ProductGroupFixture = {
    slug: string;
    displayName: string;
    family?: string;
    color?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    category?: string | null;
    neckThreadSize?: string | null;
    applicatorBucket?: string | null;
};

function loadProductGroupFixtures(): ProductGroupFixture[] {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data/product_groups_by_family.json"), "utf8")) as Record<string, ProductGroupFixture[]>;
    return Object.entries(raw).flatMap(([family, groups]) => groups.map((group) => ({ ...group, family })));
}

function groupMatchesSearch(query: string, group: ProductGroupFixture): boolean {
    return catalogSearchMatches(query, [
        group.displayName,
        group.family,
        group.color,
        group.capacity,
        group.capacityMl == null ? null : `${group.capacityMl} ml`,
        group.category,
        group.neckThreadSize,
        group.slug,
        group.applicatorBucket,
    ]);
}

// ─── Constants & Data Integrity ─────────────────────────────────────────────

describe("constants integrity", () => {
    it("EMPTY_FILTERS has all required fields", () => {
        expect(EMPTY_FILTERS).toEqual({
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
        });
    });

    it("all APPLICATOR_BUCKETS have non-empty productValues", () => {
        for (const bucket of APPLICATOR_BUCKETS) {
            expect(bucket.productValues.length).toBeGreaterThan(0);
            expect(bucket.value).toBeTruthy();
            expect(bucket.label).toBeTruthy();
        }
    });

    it("APPLICATOR_NAV buckets reference valid APPLICATOR_BUCKETS values", () => {
        const validBucketValues = APPLICATOR_BUCKETS.map((b) => b.value);
        for (const nav of APPLICATOR_NAV) {
            for (const bucket of nav.buckets) {
                expect(validBucketValues).toContain(bucket);
            }
        }
    });

    it("every SORT_OPTIONS entry has a unique value", () => {
        const values = SORT_OPTIONS.map((o) => o.value);
        expect(new Set(values).size).toBe(values.length);
    });
});

// ─── filtersAreEmpty ────────────────────────────────────────────────────────

describe("filtersAreEmpty", () => {
    it("returns true for EMPTY_FILTERS", () => {
        expect(filtersAreEmpty(EMPTY_FILTERS)).toBe(true);
    });

    it("returns false when category is set", () => {
        expect(filtersAreEmpty({ ...EMPTY_FILTERS, category: "Glass Bottle" })).toBe(false);
    });

    it("returns false when search has text", () => {
        expect(filtersAreEmpty({ ...EMPTY_FILTERS, search: "cylinder" })).toBe(false);
    });

    it("returns false when one array has items", () => {
        expect(filtersAreEmpty({ ...EMPTY_FILTERS, colors: ["Clear"] })).toBe(false);
    });

    it("returns false when priceMin is set", () => {
        expect(filtersAreEmpty({ ...EMPTY_FILTERS, priceMin: 0 })).toBe(false);
    });

    it("returns false when priceMax is set", () => {
        expect(filtersAreEmpty({ ...EMPTY_FILTERS, priceMax: 100 })).toBe(false);
    });

    it("treats priceMin=0 as NOT empty (user explicitly set $0 minimum)", () => {
        // priceMin: 0 is a valid explicit filter — filtersAreEmpty checks
        // `f.priceMin === null` not just truthiness, so 0 counts as set.
        const f = { ...EMPTY_FILTERS, priceMin: 0 };
        expect(filtersAreEmpty(f)).toBe(false);
    });
});

// ─── activeFilterCount ──────────────────────────────────────────────────────

describe("activeFilterCount", () => {
    it("returns 0 for empty filters", () => {
        expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    });

    it("counts category as 1", () => {
        expect(activeFilterCount({ ...EMPTY_FILTERS, category: "Glass Bottle" })).toBe(1);
    });

    it("counts each applicator individually", () => {
        expect(
            activeFilterCount({
                ...EMPTY_FILTERS,
                applicators: ["rollon", "dropper", "finemist"] as ApplicatorBucket[],
            })
        ).toBe(3);
    });

    it("counts price range as 1 when only min set", () => {
        expect(activeFilterCount({ ...EMPTY_FILTERS, priceMin: 2.0 })).toBe(1);
    });

    it("counts price range as 1 when only max set", () => {
        expect(activeFilterCount({ ...EMPTY_FILTERS, priceMax: 10.0 })).toBe(1);
    });

    it("counts price range as 1 when both min and max set", () => {
        expect(activeFilterCount({ ...EMPTY_FILTERS, priceMin: 2.0, priceMax: 10.0 })).toBe(1);
    });

    it("counts search as 1", () => {
        expect(activeFilterCount({ ...EMPTY_FILTERS, search: "amber" })).toBe(1);
    });

    it("sums all filter types correctly", () => {
        const f: CatalogFilters = {
            category: "Glass Bottle",     // 1
            collection: "Cylinder",        // 1
            applicators: ["rollon", "dropper"] as ApplicatorBucket[], // 2
            families: ["Cylinder", "Diva"], // 2
            colors: ["Clear", "Amber", "Green"], // 3
            capacities: ["100 ml (3.38 oz)"], // 1
            neckThreadSizes: ["18-415", "20-400"], // 2
            componentType: "Sprayer",      // 1
            priceMin: 1.0,                 // 1 (combined w/ max)
            priceMax: 50.0,
            search: "dropper",             // 1
        };
        expect(activeFilterCount(f)).toBe(15);
    });
});

// ─── filtersToParams / paramsToFilters round-trip ───────────────────────────

describe("URL round-trip serialization", () => {
    it("round-trips empty filters with default sort", () => {
        const params = filtersToParams(EMPTY_FILTERS, "featured");
        const result = paramsToFilters(params);
        expect(result.filters).toEqual(EMPTY_FILTERS);
        expect(result.sort).toBe("featured");
        expect(result.view).toBe("visual");
    });

    it("round-trips fully populated filters", () => {
        const filters: CatalogFilters = {
            category: "Glass Bottle",
            collection: "Cylinder",
            applicators: ["rollon", "finemist"] as ApplicatorBucket[],
            families: ["Cylinder", "Elegant"],
            colors: ["Clear", "Amber"],
            capacities: ["30 ml (1 oz)", "100 ml (3.38 oz)"],
            neckThreadSizes: ["18-415"],
            componentType: "Sprayer",
            priceMin: 1.5,
            priceMax: 25.0,
            search: "gold",
        };
        const sort: SortValue = "price-desc";
        const params = filtersToParams(filters, sort);
        const result = paramsToFilters(params);
        expect(result.filters).toEqual(filters);
        expect(result.sort).toBe(sort);
    });

    it("round-trips line view mode", () => {
        const params = filtersToParams(EMPTY_FILTERS, "featured", "line");
        const result = paramsToFilters(params);
        expect(result.view).toBe("line");
    });

    it("defaults view to visual when not specified", () => {
        const params = new URLSearchParams();
        const result = paramsToFilters(params);
        expect(result.view).toBe("visual");
    });

    it("defaults sort to featured when not specified", () => {
        const params = new URLSearchParams();
        const result = paramsToFilters(params);
        expect(result.sort).toBe("featured");
    });

    it("omits sort=featured from URL (it's the default)", () => {
        const params = filtersToParams(EMPTY_FILTERS, "featured");
        expect(params.get("sort")).toBeNull();
    });

    it("includes sort when not featured", () => {
        const params = filtersToParams(EMPTY_FILTERS, "price-asc");
        expect(params.get("sort")).toBe("price-asc");
    });

    it("omits view=visual from URL (it's the default)", () => {
        const params = filtersToParams(EMPTY_FILTERS, "featured", "visual");
        expect(params.get("view")).toBeNull();
    });

    it("handles special characters in search", () => {
        const filters = { ...EMPTY_FILTERS, search: "100ml (3.38 oz)" };
        const params = filtersToParams(filters, "featured");
        const result = paramsToFilters(params);
        expect(result.filters.search).toBe("100ml (3.38 oz)");
    });

    it("handles price with decimal precision", () => {
        const filters = { ...EMPTY_FILTERS, priceMin: 1.99, priceMax: 99.95 };
        const params = filtersToParams(filters, "featured");
        const result = paramsToFilters(params);
        expect(result.filters.priceMin).toBe(1.99);
        expect(result.filters.priceMax).toBe(99.95);
    });
});

// ─── paramsToFilters edge cases ─────────────────────────────────────────────

describe("paramsToFilters edge cases", () => {
    it("filters out invalid applicator values", () => {
        const params = new URLSearchParams("applicators=rollon,INVALID,dropper");
        const result = paramsToFilters(params);
        expect(result.filters.applicators).toEqual(["rollon", "dropper"]);
    });

    it("accepts ?family= as alias for ?families= (Grace AI compatibility)", () => {
        const params = new URLSearchParams("family=Cylinder");
        const result = paramsToFilters(params);
        expect(result.filters.families).toEqual(["Cylinder"]);
    });

    it("prefers ?families= over ?family= when both present", () => {
        const params = new URLSearchParams("families=Elegant&family=Cylinder");
        const result = paramsToFilters(params);
        expect(result.filters.families).toEqual(["Elegant"]);
    });

    it("handles empty string values gracefully", () => {
        const params = new URLSearchParams("category=&search=&colors=");
        const result = paramsToFilters(params);
        expect(result.filters.category).toBeNull();
        expect(result.filters.search).toBe("");
        expect(result.filters.colors).toEqual([]);
    });

    it("handles completely empty URL", () => {
        const result = paramsToFilters(new URLSearchParams());
        expect(result.filters).toEqual(EMPTY_FILTERS);
        expect(result.sort).toBe("featured");
    });

    it("defaults direct search URLs to best-match sorting", () => {
        const result = paramsToFilters(new URLSearchParams("search=15ml+elegant+bottles"));
        expect(result.filters.search).toBe("15ml elegant bottles");
        expect(result.sort).toBe("best-match");
    });

    it("ignores malformed or negative price filters instead of zeroing the catalog", () => {
        const result = paramsToFilters(new URLSearchParams("priceMin=-5&priceMax=abc"));
        expect(result.filters.priceMin).toBeNull();
        expect(result.filters.priceMax).toBeNull();
    });
});

// ─── Search tolerance and recovery ──────────────────────────────────────────

describe("catalog search tolerance", () => {
    it("matches compact and spaced capacity searches", () => {
        expect(catalogSearchMatches("10ml roll-on", [
            "10 ml clear cylinder bottle",
            "Metal Roller Ball",
            "Glass Bottle",
        ])).toBe(true);
    });

    it("matches packaging synonyms buyers naturally type", () => {
        expect(catalogSearchMatches("amber bottles with caps", [
            "Brown glass bottle",
            "Black closure",
            "13-415",
        ])).toBe(true);
    });

    it("treats neck sizes with slash and hyphen variants as equivalent", () => {
        expect(catalogSearchMatches("13/415", ["13-415 clear bottle"])).toBe(true);
    });

    it("scores stronger display-name matches above weak attribute matches", () => {
        const strong = catalogSearchScore("10ml roll-on", [
            { value: "10 ml Roll-On Bottle", weight: 5 },
            { value: "Clear", weight: 1 },
        ]);
        const weak = catalogSearchScore("10ml roll-on", [
            { value: "10 ml", weight: 1 },
            { value: "Roll-On", weight: 1 },
        ]);
        expect(strong).toBeGreaterThan(weak);
    });

    it("provides actionable zero-results recovery suggestions", () => {
        expect(catalogSearchRecoverySuggestions("amber 10ml roller bottle")).toEqual(
            expect.arrayContaining(["10 ml", "roll-on", "amber glass bottle"])
        );
    });

    it("matches May 4 stakeholder zero-result regression searches against known local product groups", () => {
        const groups = loadProductGroupFixtures();
        const bulbHits = groups.filter((group) => groupMatchesSearch("bulb sprayers", group));
        const rollOnHits = groups.filter((group) => groupMatchesSearch("roll on bottles", group));
        const elegantHits = groups.filter((group) => groupMatchesSearch("15ml elegant bottles", group));

        expect(bulbHits.map((group) => group.slug)).toContain("empire-50ml-clear-18-415-antiquespray");
        expect(rollOnHits.map((group) => group.slug)).toContain("elegant-15ml-clear-13-415-rollon");
        expect(elegantHits.map((group) => group.slug)).toEqual(
            expect.arrayContaining([
                "elegant-15ml-clear-13-415",
                "elegant-15ml-clear-13-415-rollon",
            ]),
        );
    });

    it("uses capacity and stable labels as search-result tie breakers", () => {
        const groups = loadProductGroupFixtures()
            .filter((group) => groupMatchesSearch("roll on bottles", group))
            .sort((a, b) => catalogSearchResultTieBreak(a, b));
        const firstCapacities = groups.slice(0, 10).map((group) => group.capacityMl ?? Infinity);

        expect(groups.length).toBeGreaterThan(1);
        expect(firstCapacities[0]).toBe(5);
        expect(firstCapacities.every((capacity, index) => index === 0 || capacity >= firstCapacities[index - 1])).toBe(true);
    });
});

// ─── classifyComponentType ──────────────────────────────────────────────────

describe("classifyComponentType", () => {
    it("classifies sprayers", () => {
        expect(classifyComponentType("Antique Bulb Sprayer Gold", null)).toBe("Sprayer");
        expect(classifyComponentType("Fine Mist Sprayer 18-415 Gold", null)).toBe("Sprayer");
        expect(classifyComponentType("Vintage Bulb Sprayer with Tassel", null)).toBe("Sprayer");
    });

    it("classifies atomizers as sprayers", () => {
        expect(classifyComponentType("Perfume Atomizer Silver", null)).toBe("Sprayer");
    });

    it("classifies droppers", () => {
        expect(classifyComponentType("Premium Dropper 18-415 Gold", null)).toBe("Dropper");
        expect(classifyComponentType("Glass Dropper Assembly", null)).toBe("Dropper");
    });

    it("classifies lotion pumps", () => {
        expect(classifyComponentType("Lotion Pump 24-410 Black", null)).toBe("Lotion Pump");
    });

    it("classifies roll-ons", () => {
        expect(classifyComponentType("Metal Roll-On 18-415", null)).toBe("Roll-On");
        expect(classifyComponentType("Plastic Roll On Ball", null)).toBe("Roll-On");
    });

    it("classifies rollers", () => {
        expect(classifyComponentType("Metal Roller Ball 18mm", null)).toBe("Roller");
    });

    it("classifies reducers", () => {
        expect(classifyComponentType("Reducer 18-415 White", null)).toBe("Reducer");
    });

    it("classifies caps", () => {
        expect(classifyComponentType("Smooth Cap 18-415 Gold", null)).toBe("Cap");
        expect(classifyComponentType("Snap Closure Black", null)).toBe("Cap");
    });

    it("falls back to family name when display name is ambiguous", () => {
        expect(classifyComponentType("Premium Gold Assembly", "Sprayer")).toBe("Sprayer");
        expect(classifyComponentType("Premium Assembly", "Dropper")).toBe("Dropper");
        expect(classifyComponentType("Premium Assembly", "Cap")).toBe("Cap");
    });

    it("returns null for unclassifiable products", () => {
        expect(classifyComponentType("Glass Bottle 30ml Clear", null)).toBeNull();
        expect(classifyComponentType("Unknown Widget", null)).toBeNull();
    });

    it("is case-insensitive for display name", () => {
        expect(classifyComponentType("FINE MIST SPRAYER GOLD", null)).toBe("Sprayer");
        expect(classifyComponentType("premium DROPPER black", null)).toBe("Dropper");
    });
});

// ─── applicatorBucketMatchesProductValues ────────────────────────────────────

describe("applicatorBucketMatchesProductValues", () => {
    it("matches rollon bucket to Metal Roller Ball", () => {
        expect(applicatorBucketMatchesProductValues("rollon", ["Metal Roller Ball"])).toBe(true);
    });

    it("matches rollon bucket to Plastic Roller Ball", () => {
        expect(applicatorBucketMatchesProductValues("rollon", ["Plastic Roller Ball"])).toBe(true);
    });

    it("matches finemist bucket to Fine Mist Sprayer", () => {
        expect(applicatorBucketMatchesProductValues("finemist", ["Fine Mist Sprayer"])).toBe(true);
    });

    it("matches finemist bucket to Atomizer", () => {
        expect(applicatorBucketMatchesProductValues("finemist", ["Atomizer"])).toBe(true);
    });

    it("does NOT match rollon to Dropper", () => {
        expect(applicatorBucketMatchesProductValues("rollon", ["Dropper"])).toBe(false);
    });

    it("matches when product has multiple applicator types", () => {
        expect(applicatorBucketMatchesProductValues("rollon", ["Dropper", "Metal Roller Ball", "Cap"])).toBe(true);
    });

    it("returns false for unknown bucket value", () => {
        expect(applicatorBucketMatchesProductValues("unknown" as ApplicatorBucket, ["Dropper"])).toBe(false);
    });

    it("returns false for empty product values array", () => {
        expect(applicatorBucketMatchesProductValues("rollon", [])).toBe(false);
    });

    it("matches vintage bulb spray variants", () => {
        expect(applicatorBucketMatchesProductValues("antiquespray", ["Vintage Bulb Sprayer"])).toBe(true);
        expect(applicatorBucketMatchesProductValues("antiquespray", ["Antique Bulb Sprayer"])).toBe(true);
    });

    it("matches vintage bulb spray with tassel separately", () => {
        expect(applicatorBucketMatchesProductValues("antiquespray-tassel", ["Vintage Bulb Sprayer with Tassel"])).toBe(true);
        // Tassel variant should NOT match the non-tassel bucket
        expect(applicatorBucketMatchesProductValues("antiquespray", ["Vintage Bulb Sprayer with Tassel"])).toBe(false);
    });
});

// ─── applicatorNavHref ──────────────────────────────────────────────────────

describe("applicatorNavHref", () => {
    it("builds roll-on URL with single bucket", () => {
        const href = applicatorNavHref("rollon");
        expect(href).toBe("/catalog?applicators=rollon");
    });

    it("builds spray URL with TWO buckets (finemist + perfumespray)", () => {
        const href = applicatorNavHref("spray");
        expect(href).toBe("/catalog?applicators=finemist%2Cperfumespray");
    });

    it("falls back to /catalog for unknown nav value", () => {
        const href = applicatorNavHref("unknown" as any);
        expect(href).toBe("/catalog");
    });
});

describe("applicatorNavHrefMulti", () => {
    it("combines multiple nav values", () => {
        const href = applicatorNavHrefMulti(["rollon", "dropper"]);
        expect(href).toContain("applicators=");
        const params = new URLSearchParams(href.split("?")[1]);
        const applicators = params.get("applicators")!.split(",");
        expect(applicators).toContain("rollon");
        expect(applicators).toContain("dropper");
    });

    it("returns /catalog for empty array", () => {
        expect(applicatorNavHrefMulti([])).toBe("/catalog");
    });

    it("deduplicates spray sub-types correctly", () => {
        const href = applicatorNavHrefMulti(["spray"]);
        const params = new URLSearchParams(href.split("?")[1]);
        const applicators = params.get("applicators")!.split(",");
        expect(applicators).toEqual(["finemist", "perfumespray"]);
    });
});

// ─── UX-critical: user journey filter scenarios ─────────────────────────────

describe("UX: real user journey filter scenarios", () => {
    it("first-time visitor clicking 'Bottles' in nav gets Glass Bottle category", () => {
        // Simulates: User clicks "Bottles" in navbar → /catalog?category=Glass+Bottle
        const params = new URLSearchParams("category=Glass+Bottle");
        const result = paramsToFilters(params);
        expect(result.filters.category).toBe("Glass Bottle");
        expect(activeFilterCount(result.filters)).toBe(1);
    });

    it("user searching for 'amber dropper 30ml' gets search filter", () => {
        const params = new URLSearchParams("search=amber+dropper+30ml");
        const result = paramsToFilters(params);
        expect(result.filters.search).toBe("amber dropper 30ml");
        expect(activeFilterCount(result.filters)).toBe(1);
    });

    it("user applying multiple filters builds correct URL", () => {
        // User selects: Glass Bottle category, Cylinder family, Clear color, sorted by price
        const filters: CatalogFilters = {
            ...EMPTY_FILTERS,
            category: "Glass Bottle",
            families: ["Cylinder"],
            colors: ["Clear"],
        };
        const params = filtersToParams(filters, "price-asc");
        expect(params.get("category")).toBe("Glass Bottle");
        expect(params.get("families")).toBe("Cylinder");
        expect(params.get("colors")).toBe("Clear");
        expect(params.get("sort")).toBe("price-asc");
    });

    it("clearing all filters returns to empty state", () => {
        const params = filtersToParams(EMPTY_FILTERS, "featured");
        const result = paramsToFilters(params);
        expect(filtersAreEmpty(result.filters)).toBe(true);
    });

    it("Grace AI sending family filter via ?family= works", () => {
        // Grace AI uses ?family=Elegant (singular) instead of ?families=Elegant
        const params = new URLSearchParams("family=Elegant");
        const result = paramsToFilters(params);
        expect(result.filters.families).toEqual(["Elegant"]);
    });

    it("user bookmarking a filtered catalog URL preserves state", () => {
        // User bookmarks: /catalog?category=Component&applicators=rollon,dropper&sort=price-asc&view=line
        const bookmarkedUrl = "category=Component&applicators=rollon,dropper&sort=price-asc&view=line";
        const params = new URLSearchParams(bookmarkedUrl);
        const result = paramsToFilters(params);

        expect(result.filters.category).toBe("Component");
        expect(result.filters.applicators).toEqual(["rollon", "dropper"]);
        expect(result.sort).toBe("price-asc");
        expect(result.view).toBe("line");
    });

    it("thread size filter survives round-trip with special characters", () => {
        // Thread sizes like "18-415" contain hyphens
        const filters = { ...EMPTY_FILTERS, neckThreadSizes: ["18-415", "20-400", "24-410"] };
        const params = filtersToParams(filters, "featured");
        const result = paramsToFilters(params);
        expect(result.filters.neckThreadSizes).toEqual(["18-415", "20-400", "24-410"]);
    });
});
