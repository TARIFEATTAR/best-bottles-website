/**
 * UX Intuitiveness Tests
 *
 * Tests navigation consistency, user journey completeness, and data
 * coherence that determine whether the app feels intuitive to users.
 *
 * These are structural tests — they verify the "contract" between
 * code modules that users experience as intuitive (or broken) flows.
 */

import { describe, expect, it } from "vitest";
import {
    APPLICATOR_BUCKETS,
    APPLICATOR_NAV,
    EMPTY_FILTERS,
    SORT_OPTIONS,
    activeFilterCount,
    applicatorNavHref,
    classifyComponentType,
    filtersToParams,
    paramsToFilters,
    type ApplicatorBucket,
} from "../src/lib/catalogFilters";

// ─── Navigation Completeness ────────────────────────────────────────────────

describe("UX: Navigation structure", () => {
    it("every nav-level applicator links to a valid catalog URL", () => {
        for (const nav of APPLICATOR_NAV) {
            const href = applicatorNavHref(nav.value);
            expect(href).toMatch(/^\/catalog\?applicators=/);
            // Parse the URL and verify filters round-trip
            const params = new URLSearchParams(href.split("?")[1]);
            const result = paramsToFilters(params);
            expect(result.filters.applicators.length).toBeGreaterThan(0);
        }
    });

    it("combined spray nav maps to both finemist and perfumespray (not just one)", () => {
        // Users clicking "Fine Mist & Spray" should see BOTH sub-types
        const nav = APPLICATOR_NAV.find((n) => n.value === "spray");
        expect(nav).toBeDefined();
        expect(nav!.buckets).toContain("finemist");
        expect(nav!.buckets).toContain("perfumespray");
        expect(nav!.buckets.length).toBe(2);
    });

    it("all 5 nav applicator categories are present", () => {
        const values = APPLICATOR_NAV.map((n) => n.value);
        expect(values).toContain("rollon");
        expect(values).toContain("spray");
        expect(values).toContain("dropper");
        expect(values).toContain("lotionpump");
        expect(values).toContain("reducer");
    });

    it("every nav category has a user-friendly subtitle for explorers", () => {
        for (const nav of APPLICATOR_NAV) {
            expect(nav.subtitle).toBeTruthy();
            expect(nav.subtitle.length).toBeGreaterThan(5);
        }
    });
});

// ─── Sort Options Completeness ──────────────────────────────────────────────

describe("UX: Sort options", () => {
    it("has a capacity sort option (requested by stakeholder)", () => {
        const hasCapacity = SORT_OPTIONS.some(
            (o) => o.value === "capacity-asc" || o.value === "capacity-desc"
        );
        expect(hasCapacity).toBe(true);
    });

    it("has both ascending and descending capacity sorts", () => {
        expect(SORT_OPTIONS.some((o) => o.value === "capacity-asc")).toBe(true);
        expect(SORT_OPTIONS.some((o) => o.value === "capacity-desc")).toBe(true);
    });

    it("has price sort options for comparison shopping", () => {
        expect(SORT_OPTIONS.some((o) => o.value === "price-asc")).toBe(true);
        expect(SORT_OPTIONS.some((o) => o.value === "price-desc")).toBe(true);
    });

    it("has a default 'featured' sort for first-time visitors", () => {
        expect(SORT_OPTIONS[0].value).toBe("featured");
    });

    it("sort labels are user-friendly (not developer jargon)", () => {
        for (const option of SORT_OPTIONS) {
            // Labels should NOT contain camelCase, underscores, or code-speak
            expect(option.label).not.toMatch(/_/);
            expect(option.label).not.toMatch(/[a-z][A-Z]/); // no camelCase
            expect(option.label.length).toBeGreaterThan(3);
        }
    });
});

// ─── Filter State Management (URL as source of truth) ──────────────────────

describe("UX: Filter state consistency (shareability)", () => {
    it("a filtered catalog URL can be shared and reproduced exactly", () => {
        // User applies filters, copies URL, sends to colleague → should get same view
        const originalFilters = {
            ...EMPTY_FILTERS,
            category: "Glass Bottle",
            families: ["Cylinder", "Diva"],
            colors: ["Clear", "Amber"],
            applicators: ["rollon", "finemist"] as ApplicatorBucket[],
        };
        const params = filtersToParams(originalFilters, "price-asc", "line");
        const urlString = params.toString();

        // Colleague opens the URL
        const colleagueParams = new URLSearchParams(urlString);
        const colleagueResult = paramsToFilters(colleagueParams);

        expect(colleagueResult.filters).toEqual(originalFilters);
        expect(colleagueResult.sort).toBe("price-asc");
        expect(colleagueResult.view).toBe("line");
    });

    it("filter badge count matches number of active filters visible to user", () => {
        // The toolbar badge should show the exact count users expect
        const filters = {
            ...EMPTY_FILTERS,
            category: "Component",
            colors: ["Black", "Gold"],
            search: "sprayer",
        };
        // User sees: 1 category chip + 2 color chips + 1 search term = 4
        expect(activeFilterCount(filters)).toBe(4);
    });

    it("price range counts as ONE filter (not two) in badge", () => {
        // Users think of "$2-$10" as one filter, not two
        const filters = { ...EMPTY_FILTERS, priceMin: 2, priceMax: 10 };
        expect(activeFilterCount(filters)).toBe(1);
    });
});

// ─── Component Classification Accuracy ──────────────────────────────────────

describe("UX: Component type classification (affects catalog filtering)", () => {
    it("all common product names are classified (no null for real products)", () => {
        const realProducts = [
            { name: "Fine Mist Sprayer 18-415 Gold", expected: "Sprayer" },
            { name: "Premium Dropper 18-415 Black", expected: "Dropper" },
            { name: "Lotion Pump 24-410 Silver", expected: "Lotion Pump" },
            { name: "Metal Roll-On Ball 18-415", expected: "Roll-On" },
            { name: "Reducer 18-415 Natural", expected: "Reducer" },
            { name: "Smooth Cap 18-415 Black", expected: "Cap" },
            { name: "Vintage Bulb Sprayer Gold", expected: "Sprayer" },
            { name: "Atomizer 18-415 Silver", expected: "Sprayer" },
        ];

        for (const { name, expected } of realProducts) {
            const result = classifyComponentType(name, null);
            expect(result, `"${name}" should classify as "${expected}"`).toBe(expected);
        }
    });

    it("bottles are NOT classified as components (returns null)", () => {
        const bottles = [
            "Cylinder 30ml Clear Glass Bottle",
            "Elegant 50ml Frosted",
            "Boston Round 100ml Amber",
            "Diva 15ml Cobalt Blue",
        ];
        for (const name of bottles) {
            expect(classifyComponentType(name, null), `"${name}" should be null`).toBeNull();
        }
    });
});

// ─── Applicator Bucket Coverage ─────────────────────────────────────────────

describe("UX: Applicator bucket coverage (no orphaned products)", () => {
    it("every bucket maps to at least one product value", () => {
        for (const bucket of APPLICATOR_BUCKETS) {
            expect(
                bucket.productValues.length,
                `Bucket "${bucket.label}" has no product values`
            ).toBeGreaterThan(0);
        }
    });

    it("spray-related buckets don't overlap (user doesn't see duplicates)", () => {
        const finemist = APPLICATOR_BUCKETS.find((b) => b.value === "finemist")!;
        const perfumespray = APPLICATOR_BUCKETS.find((b) => b.value === "perfumespray")!;
        const antiquespray = APPLICATOR_BUCKETS.find((b) => b.value === "antiquespray")!;
        const tasseled = APPLICATOR_BUCKETS.find((b) => b.value === "antiquespray-tassel")!;

        // No product value should appear in more than one spray bucket
        const allSprayValues = [
            ...finemist.productValues,
            ...perfumespray.productValues,
            ...antiquespray.productValues,
            ...tasseled.productValues,
        ];
        const unique = new Set(allSprayValues);
        expect(unique.size).toBe(allSprayValues.length);
    });

    it("vintage bulb spray with/without tassel are separate buckets", () => {
        // User should be able to filter specifically for tasseled vintage sprays
        const plain = APPLICATOR_BUCKETS.find((b) => b.value === "antiquespray")!;
        const tassel = APPLICATOR_BUCKETS.find((b) => b.value === "antiquespray-tassel")!;

        expect(plain).toBeDefined();
        expect(tassel).toBeDefined();

        // They should have no overlapping product values
        const plainValues = new Set(plain.productValues as readonly string[]);
        for (const tv of tassel.productValues) {
            expect(plainValues.has(tv)).toBe(false);
        }
    });
});

// ─── URL Structure for SEO & Deep Linking ───────────────────────────────────

describe("UX: URL structure and deep linking", () => {
    it("catalog URLs are human-readable (not encoded IDs)", () => {
        const params = filtersToParams(
            { ...EMPTY_FILTERS, category: "Glass Bottle", families: ["Cylinder"] },
            "featured"
        );
        const url = `/catalog?${params.toString()}`;
        expect(url).toContain("category=Glass");
        expect(url).toContain("families=Cylinder");
        expect(url).not.toContain("categoryId=");
    });

    it("thread sizes use readable key name 'threads' not 'neckThreadSizes'", () => {
        const params = filtersToParams(
            { ...EMPTY_FILTERS, neckThreadSizes: ["18-415"] },
            "featured"
        );
        expect(params.get("threads")).toBe("18-415");
        expect(params.get("neckThreadSizes")).toBeNull();
    });

    it("default sort and view are omitted from URL (cleaner share links)", () => {
        const params = filtersToParams(EMPTY_FILTERS, "featured", "visual");
        expect(params.get("sort")).toBeNull();
        expect(params.get("view")).toBeNull();
        // URL should be minimal
        expect(params.toString()).toBe("");
    });
});

// ─── Accessibility of Data Constants ────────────────────────────────────────

describe("UX: Accessibility of labels", () => {
    it("applicator nav labels are screen-reader friendly (no abbreviations)", () => {
        for (const nav of APPLICATOR_NAV) {
            expect(nav.label.length).toBeGreaterThan(3);
            expect(nav.label).not.toMatch(/^[A-Z]{2,}$/); // no all-caps abbreviations
        }
    });

    it("sort option labels describe direction clearly", () => {
        const priceAsc = SORT_OPTIONS.find((o) => o.value === "price-asc");
        const priceDesc = SORT_OPTIONS.find((o) => o.value === "price-desc");
        expect(priceAsc?.label).toContain("Low");
        expect(priceDesc?.label).toContain("High");
    });

    it("applicator bucket labels are singular noun phrases", () => {
        for (const bucket of APPLICATOR_BUCKETS) {
            // Should be "Roll-On" not "Roll-Ons", "Dropper" not "Droppers"
            // Singular labels work better in filter chips: "× Roll-On"
            expect(bucket.label).not.toMatch(/s$/);
        }
    });
});

// ─── Edge Cases That Break UX ──────────────────────────────────────────────

describe("UX: Edge cases that break user experience", () => {
    it("handles URL with trailing commas in array params", () => {
        // Users sometimes manually edit URLs
        const params = new URLSearchParams("colors=Clear,Amber,&families=Cylinder,");
        const result = paramsToFilters(params);
        // .filter(Boolean) should remove empty strings from trailing commas
        expect(result.filters.colors).toEqual(["Clear", "Amber"]);
        expect(result.filters.families).toEqual(["Cylinder"]);
    });

    it("ignores negative price values gracefully", () => {
        const params = new URLSearchParams("priceMin=-5&priceMax=10");
        const result = paramsToFilters(params);
        expect(result.filters.priceMin).toBeNull();
        expect(result.filters.priceMax).toBe(10);
    });

    it("ignores NaN price values instead of applying an impossible filter", () => {
        const params = new URLSearchParams("priceMin=abc&priceMax=xyz");
        const result = paramsToFilters(params);
        expect(result.filters.priceMin).toBeNull();
        expect(result.filters.priceMax).toBeNull();
    });

    it("handles very long search queries without crashing", () => {
        const longSearch = "a".repeat(500);
        const filters = { ...EMPTY_FILTERS, search: longSearch };
        const params = filtersToParams(filters, "featured");
        const result = paramsToFilters(params);
        expect(result.filters.search).toBe(longSearch);
    });

    it("handles emoji in search query", () => {
        const filters = { ...EMPTY_FILTERS, search: "🧴 bottle" };
        const params = filtersToParams(filters, "featured");
        const result = paramsToFilters(params);
        expect(result.filters.search).toBe("🧴 bottle");
    });
});
