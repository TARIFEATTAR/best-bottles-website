import { describe, expect, it } from "vitest";
import {
    buildCanonicalProductGroup,
    buildCanonicalProductVariant,
    chooseCanonicalProductDescription,
    deriveCanonicalColor,
    summarizeCanonicalProductCoverage,
} from "../src/lib/canonicalProduct";

describe("canonical product model", () => {
    it("preserves raw source color while deriving Swirl from SKU evidence", () => {
        const color = deriveCanonicalColor({
            rawColor: "Clear",
            websiteSku: "GBCylSwrl9Roll",
            itemName: "9 ml clear cylinder roll-on bottle",
            slug: "cylinder-9ml-swirl-rollon",
        });

        expect(color.rawColor).toBe("Clear");
        expect(color.canonicalColor).toBe("Swirl");
        expect(color.dataQualityFlags).toContain("color_derived_from_sku_swirl");
    });

    it("normalizes Blue to Cobalt Blue without losing the raw value", () => {
        const color = deriveCanonicalColor({ rawColor: "Blue" });

        expect(color.rawColor).toBe("Blue");
        expect(color.canonicalColor).toBe("Cobalt Blue");
        expect(color.dataQualityFlags).toContain("color_normalized_blue_to_cobalt_blue");
    });

    it("creates canonical group summaries with color options and source trace", () => {
        const group = buildCanonicalProductGroup({
            _id: "group-1",
            slug: "cylinder-9ml-swirl-rollon",
            displayName: "Cylinder 9 ml Swirl Roll-On",
            family: "Cylinder",
            capacity: "9 ml",
            capacityMl: 9,
            color: "Clear",
            category: "Glass Bottle",
            bottleCollection: "Roll-On Bottles",
            neckThreadSize: "13-415",
            variantCount: 2,
            applicatorTypes: ["Metal Roller Ball"],
            primaryWebsiteSku: "GBCylSwrl9Roll",
        });

        expect(group.canonicalColor).toBe("Swirl");
        expect(group.rawColor).toBe("Clear");
        expect(group.canonicalColorOptions).toEqual(["Swirl"]);
        expect(group.capacitySearchTokens).toEqual(expect.arrayContaining(["9 ml", "9ml"]));
        expect(group.sourceTrace.modelVersion).toBeTruthy();
    });

    it("creates canonical variants with group mismatch flags when raw variant color diverges", () => {
        const variant = buildCanonicalProductVariant(
            {
                _id: "variant-1",
                graceSku: "GB-CYL-CLR-9ML-ROL",
                websiteSku: "GBCylClr9Roll",
                itemName: "Cylinder 9 ml Clear Roll-On",
                color: "Clear",
                capacity: "9 ml",
                capacityMl: 9,
                category: "Glass Bottle",
                family: "Cylinder",
                applicator: "Metal Roller Ball",
                verified: true,
            },
            {
                _id: "group-1",
                slug: "cylinder-9ml-amber-rollon",
                displayName: "Cylinder 9 ml Amber Roll-On",
                color: "Amber",
                primaryWebsiteSku: "GBCylAmb9Roll",
            },
        );

        expect(variant.rawColor).toBe("Clear");
        expect(variant.canonicalColor).toBe("Clear");
        expect(variant.dataQualityFlags).toContain("color_mismatch_group_variant");
    });

    it("does not use sprayer group copy for a roll-on variant", () => {
        const description = chooseCanonicalProductDescription({
            groupDescription: "A compact fine mist sprayer bottle for fragrance samples.",
            variantDescription: "A 9 ml roll-on bottle with roller ball applicator.",
            applicators: ["Metal Roller Ball"],
        });

        expect(description).toBe("A 9 ml roll-on bottle with roller ball applicator.");
    });

    it("summarizes complete 9 ml color coverage for Grace prompts", () => {
        const coverage = summarizeCanonicalProductCoverage([
            { family: "Cylinder", capacityMl: 9, canonicalColor: "Clear", applicator: "Metal Roller Ball", slug: "cyl-9-clear" },
            { family: "Cylinder", capacityMl: 9, canonicalColor: "Amber", applicator: "Fine Mist Sprayer", slug: "cyl-9-amber" },
            { family: "Cylinder", capacityMl: 9, canonicalColor: "Cobalt Blue", applicator: "Fine Mist Sprayer", slug: "cyl-9-cobalt" },
            { family: "Cylinder", capacityMl: 9, canonicalColor: "Frosted", applicator: "Fine Mist Sprayer", slug: "cyl-9-frosted" },
            { family: "Cylinder", capacityMl: 9, canonicalColor: "Swirl", applicator: "Metal Roller Ball", slug: "cyl-9-swirl" },
            { family: "Cylinder", capacityMl: 9, canonicalColor: "White", applicator: "Lotion Pump", slug: "cyl-9-white" },
        ]);

        expect(coverage.colors).toEqual(["Amber", "Clear", "Cobalt Blue", "Frosted", "Swirl", "White"]);
    });
});
