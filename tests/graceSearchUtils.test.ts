import { describe, expect, it } from "vitest";
import {
    buildSearchCatalogToolResult,
    detectApplicatorIntent,
    ensureVerified9mlCylinderRollOnCoverage,
    FAMILY_MIN_SIZE_ML,
    is9mlCylinderRollOnTruthQuery,
    isVerified9mlCylinderRollOnColor,
    normalizeSearchTerm,
    selectVerified9mlCylinderRollOnRepresentatives,
} from "../convex/graceSearchUtils";

describe("detectApplicatorIntent", () => {
    it("returns a single intent when only one applicator family is mentioned", () => {
        expect(detectApplicatorIntent("9ml cylinder roll-on")).toBe("rollon");
        expect(detectApplicatorIntent(normalizeSearchTerm("9ml roll-on bottle") || "")).toBe("rollon");
        expect(detectApplicatorIntent("30ml fine mist sprayer")).toBe("spray");
        expect(detectApplicatorIntent("lotion pump bottle")).toBe("pump");
    });

    it("returns null when multiple applicator types are named (e.g. 9ml roll + spray + pump)", () => {
        expect(
            detectApplicatorIntent(
                "9ml bottle roll-on fine mist sprayer and lotion pump",
            ),
        ).toBeNull();
        expect(
            detectApplicatorIntent(
                normalizeSearchTerm("9ml roll-on sprayer lotion pump") || "",
            ),
        ).toBeNull();
    });
});

describe("buildSearchCatalogToolResult", () => {
    it("keeps family minimum-size guardrails aligned with Grace's system prompt", () => {
        expect(FAMILY_MIN_SIZE_ML.Cylinder).toBe(3);
        expect(FAMILY_MIN_SIZE_ML.Empire).toBe(50);
        expect(FAMILY_MIN_SIZE_ML.Slim).toBe(30);
    });

    it("does not warn Grace away from stocked 3 ml Cylinder bottles", () => {
        const result = buildSearchCatalogToolResult(
            { searchTerm: "Do you have a 3ml Cylinder bottle?", familyLimit: "Cylinder" },
            [
                { family: "Cylinder", capacity: "3ml", capacityMl: 3, color: "Clear", canonicalColor: "Clear", applicator: "Fine Mist Sprayer", slug: "cylinder-3ml-clear-finemist" },
            ],
        );

        expect(result).not.toContain("We do NOT stock a 3ml Cylinder");
        expect(result).not.toContain("Cylinder starts at");
    });

    it("warns Grace that 30 ml Empire is not stocked", () => {
        const result = buildSearchCatalogToolResult(
            { searchTerm: "Do you have a 30ml Empire bottle?", familyLimit: "Empire" },
            [
                { family: "Empire", capacity: "50ml", capacityMl: 50, color: "Clear", canonicalColor: "Clear", applicator: "Fine Mist Sprayer", slug: "empire-50ml-clear-finemist" },
                { family: "Empire", capacity: "100ml", capacityMl: 100, color: "Clear", canonicalColor: "Clear", applicator: "Fine Mist Sprayer", slug: "empire-100ml-clear-finemist" },
            ],
        );

        expect(result).toContain("We do NOT stock a 30ml Empire");
        expect(result).toContain("Empire starts at 50ml");
    });

    it("tells Grace the verified 9 ml Cylinder roll-on colors without White or Green drift", () => {
        const result = buildSearchCatalogToolResult(
            { searchTerm: "Do you have a 9 mL Cylinder roll-on bottle? Please list every available color option." },
            [
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Clear", canonicalColor: "Clear", applicator: "Metal Roller Ball", slug: "cyl-9-clear" },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Amber", canonicalColor: "Amber", applicator: "Metal Roller Ball", slug: "cyl-9-amber" },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Cobalt Blue", canonicalColor: "Cobalt Blue", applicator: "Plastic Roller Ball", slug: "cyl-9-cobalt" },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Frosted", canonicalColor: "Frosted", applicator: "Plastic Roller Ball", slug: "cyl-9-frosted" },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Swirl", canonicalColor: "Swirl", applicator: "Metal Roller Ball", slug: "cyl-9-swirl", dataQualityFlags: ["color_derived_from_sku_swirl"] },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "White", canonicalColor: "White", applicator: "Metal Roller Ball", slug: "cyl-9-white-drift" },
                { family: "Teardrop", capacity: "9ml", capacityMl: 9, color: "Green", canonicalColor: "Green", applicator: "Glass Stopper", slug: "teardrop-9-green" },
            ],
        );

        const coverageLine = result.split("\n").find((line) => line.includes("REQUIRED COVERAGE"));

        expect(result).toContain("VERIFIED 9ML CYLINDER ROLL-ON COLORS: Amber, Clear, Cobalt Blue, Frosted, Swirl");
        expect(result).toContain("Do NOT list White or Green as 9ml Cylinder roll-on glass colors");
        expect(result).toContain("REQUIRED COVERAGE");
        expect(coverageLine).toContain("Amber, Clear, Cobalt Blue, Frosted, Swirl");
        expect(coverageLine).not.toContain("White");
        expect(coverageLine).not.toContain("Green");
        expect(result).toContain("DATA QUALITY NOTE");
    });
});

describe("9ml Cylinder roll-on product truth", () => {
    it("detects 9ml Cylinder roll-on truth questions", () => {
        expect(is9mlCylinderRollOnTruthQuery({
            searchTerm: "Do you have a 9 mL Cylinder roll-on bottle?",
        })).toBe(true);
        expect(is9mlCylinderRollOnTruthQuery({
            searchTerm: "Do you have a 9 mL bottle?",
        })).toBe(false);
    });

    it("allows only verified 9ml Cylinder roll-on glass colors", () => {
        expect(isVerified9mlCylinderRollOnColor("Amber")).toBe(true);
        expect(isVerified9mlCylinderRollOnColor("Swirl")).toBe(true);
        expect(isVerified9mlCylinderRollOnColor("White")).toBe(false);
        expect(isVerified9mlCylinderRollOnColor("Green")).toBe(false);
    });

    it("selects one representative for every verified color in stable order", () => {
        const representatives = selectVerified9mlCylinderRollOnRepresentatives([
            { graceSku: "white-drift", family: "Cylinder", capacityMl: 9, canonicalColor: "White", applicator: "Metal Roller Ball" },
            { graceSku: "swirl", family: "Cylinder", capacityMl: 9, canonicalColor: "Swirl", applicator: "Metal Roller Ball" },
            { graceSku: "clear", family: "Cylinder", capacityMl: 9, canonicalColor: "Clear", applicator: "Metal Roller Ball" },
            { graceSku: "green-other", family: "Teardrop", capacityMl: 9, canonicalColor: "Green", applicator: "Glass Stopper" },
            { graceSku: "cobalt", family: "Cylinder", capacityMl: 9, canonicalColor: "Cobalt Blue", applicator: "Plastic Roller Ball" },
            { graceSku: "frosted", family: "Cylinder", capacityMl: 9, canonicalColor: "Frosted", applicator: "Plastic Roller Ball" },
            { graceSku: "amber", family: "Cylinder", capacityMl: 9, canonicalColor: "Amber", applicator: "Metal Roller Ball" },
        ]);

        expect(representatives.map((row) => row.canonicalColor)).toEqual([
            "Amber",
            "Clear",
            "Cobalt Blue",
            "Frosted",
            "Swirl",
        ]);
    });

    it("prepends missing verified color representatives before slicing ranked rows", () => {
        const crowdedRankedRows = Array.from({ length: 25 }, (_, index) => ({
            graceSku: `ranked-${index}`,
            family: "Cylinder",
            capacityMl: 9,
            canonicalColor: index % 2 === 0 ? "Clear" : "Amber",
            applicator: "Metal Roller Ball",
        }));
        const coverageCandidates = [
            ...crowdedRankedRows,
            { graceSku: "cobalt", family: "Cylinder", capacityMl: 9, canonicalColor: "Cobalt Blue", applicator: "Plastic Roller Ball" },
            { graceSku: "frosted", family: "Cylinder", capacityMl: 9, canonicalColor: "Frosted", applicator: "Plastic Roller Ball" },
            { graceSku: "swirl", family: "Cylinder", capacityMl: 9, canonicalColor: "Swirl", applicator: "Metal Roller Ball" },
            { graceSku: "white-drift", family: "Cylinder", capacityMl: 9, canonicalColor: "White", applicator: "Metal Roller Ball" },
        ];

        const covered = ensureVerified9mlCylinderRollOnCoverage(crowdedRankedRows, coverageCandidates, 25);
        const colors = new Set(covered.map((row) => row.canonicalColor));

        expect(covered).toHaveLength(25);
        expect([...colors].sort()).toEqual(["Amber", "Clear", "Cobalt Blue", "Frosted", "Swirl"]);
        expect(colors.has("White")).toBe(false);
    });
});
