import { describe, expect, it } from "vitest";
import {
    buildSearchCatalogToolResult,
    detectApplicatorIntent,
    normalizeSearchTerm,
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
    it("tells Grace not to omit complete 9 ml color coverage", () => {
        const result = buildSearchCatalogToolResult(
            { searchTerm: "Do you have a 9 mL bottle? Please list every available color option." },
            [
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Clear", canonicalColor: "Clear", applicator: "Metal Roller Ball", slug: "cyl-9-clear" },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Amber", canonicalColor: "Amber", applicator: "Fine Mist Sprayer", slug: "cyl-9-amber" },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Cobalt Blue", canonicalColor: "Cobalt Blue", applicator: "Fine Mist Sprayer", slug: "cyl-9-cobalt" },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Frosted", canonicalColor: "Frosted", applicator: "Fine Mist Sprayer", slug: "cyl-9-frosted" },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "Swirl", canonicalColor: "Swirl", applicator: "Metal Roller Ball", slug: "cyl-9-swirl", dataQualityFlags: ["color_derived_from_sku_swirl"] },
                { family: "Cylinder", capacity: "9ml", capacityMl: 9, color: "White", canonicalColor: "White", applicator: "Lotion Pump", slug: "cyl-9-white" },
            ],
        );

        expect(result).toContain("REQUIRED COVERAGE");
        expect(result).toContain("Amber, Clear, Cobalt Blue, Frosted, Swirl, White");
        expect(result).toContain("DATA QUALITY NOTE");
    });
});
