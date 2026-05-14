import { describe, expect, it } from "vitest";
import { filterCatalogGroups } from "../src/lib/pdf/catalog/filters";
import { parseCatalogPdfOptions } from "../src/lib/pdf/catalog/query";
import type { PrintableCatalogGroup } from "../src/lib/pdf/catalog/types";

function group(overrides: Partial<PrintableCatalogGroup>): PrintableCatalogGroup {
    return {
        id: "group-1",
        slug: "sample",
        displayName: "Sample Bottle",
        family: "Cylinder",
        capacity: "10 ml",
        capacityMl: 10,
        color: "Clear",
        rawColor: "Clear",
        canonicalColor: "Clear",
        canonicalColorOptions: ["Clear"],
        category: "Glass Bottle",
        collection: "Essential Oil Bottles",
        brand: "Best Bottles",
        neckThreadSize: "18-415",
        variantCount: 4,
        priceRangeMin: 1.25,
        priceRangeMax: 2.5,
        heroImageUrl: null,
        applicatorTypes: ["Fine Mist Sprayer"],
        description: null,
        primaryGraceSku: "BB-GB-000-0001",
        primaryWebsiteSku: "GB001",
        dataQualityFlags: [],
        ...overrides,
    };
}

describe("catalog PDF options", () => {
    it("parses page, mode, filters, and download defaults", () => {
        const options = parseCatalogPdfOptions(
            new URLSearchParams(
                "mode=line-sheet&pageSize=a4&orientation=landscape&category=Glass%20Bottle&families=Cylinder,Empire&applicators=finemist&pricing=false&inline=true",
            ),
        );

        expect(options.mode).toBe("line-sheet");
        expect(options.pagePreset).toBe("a4");
        expect(options.orientation).toBe("landscape");
        expect(options.category).toEqual(["Glass Bottle"]);
        expect(options.family).toEqual(["Cylinder", "Empire"]);
        expect(options.applicators).toEqual(["finemist"]);
        expect(options.includePricing).toBe(false);
        expect(options.inline).toBe(true);
    });
});

describe("catalog PDF filters", () => {
    it("matches applicator bucket filters against product applicator labels", () => {
        const options = parseCatalogPdfOptions(new URLSearchParams("applicators=finemist"));
        const results = filterCatalogGroups(
            [
                group({ id: "a", applicatorTypes: ["Fine Mist Sprayer"] }),
                group({ id: "b", applicatorTypes: ["Dropper"] }),
            ],
            options,
        );

        expect(results.map((item) => item.id)).toEqual(["a"]);
    });

    it("applies category, family, collection, and search filters together", () => {
        const options = parseCatalogPdfOptions(
            new URLSearchParams("category=Glass%20Bottle&family=Empire&collection=Luxury&search=amber"),
        );
        const results = filterCatalogGroups(
            [
                group({
                    id: "a",
                    displayName: "Empire 30 ml Amber",
                    family: "Empire",
                    collection: "Luxury",
                    color: "Amber",
                }),
                group({
                    id: "b",
                    displayName: "Cylinder 10 ml Clear",
                    family: "Cylinder",
                    collection: "Essential Oil Bottles",
                }),
            ],
            options,
        );

        expect(results.map((item) => item.id)).toEqual(["a"]);
    });

    it("accepts the Nemat parent brand alias for current Best Bottles catalog data", () => {
        const options = parseCatalogPdfOptions(new URLSearchParams("brand=Nemat%20International"));
        const results = filterCatalogGroups([group({ id: "a", brand: "Best Bottles" })], options);

        expect(results.map((item) => item.id)).toEqual(["a"]);
    });

    it("uses catalog search normalization so compact 9ml matches spaced 9 ml PDF data", () => {
        const options = parseCatalogPdfOptions(new URLSearchParams("search=9ml"));
        const results = filterCatalogGroups([
            group({
                id: "a",
                displayName: "Cylinder 9 ml Swirl",
                capacity: "9 ml",
                capacityMl: 9,
                color: "Swirl",
                rawColor: "Clear",
                canonicalColor: "Swirl",
                canonicalColorOptions: ["Swirl"],
                primaryWebsiteSku: "GBCylSwrl9Roll",
            }),
            group({
                id: "b",
                displayName: "Cylinder 15 ml Clear",
                capacity: "15 ml",
                capacityMl: 15,
            }),
        ], options);

        expect(results.map((item) => item.id)).toEqual(["a"]);
    });
});
