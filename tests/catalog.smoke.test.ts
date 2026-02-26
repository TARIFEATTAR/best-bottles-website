import { describe, expect, it } from "vitest";
import {
    EMPTY_FILTERS,
    activeFilterCount,
    classifyComponentType,
    filtersToParams,
    paramsToFilters,
    type CatalogFilters,
    type SortValue,
} from "../src/lib/catalogFilters";

describe("catalog filters smoke", () => {
    it("round-trips URL filters and sort", () => {
        const filters: CatalogFilters = {
            ...EMPTY_FILTERS,
            category: "Glass Bottle",
            collection: "Cylinder",
            families: ["Cylinder"],
            colors: ["Clear", "Amber"],
            capacities: ["100 ml (3.38 oz)"],
            neckThreadSizes: ["18-415"],
            componentType: "Sprayer",
            priceMin: 1.5,
            priceMax: 6.25,
            search: "cylinder",
        };
        const sort: SortValue = "price-asc";

        const qs = filtersToParams(filters, sort);
        const parsed = paramsToFilters(qs);

        expect(parsed.filters).toEqual(filters);
        expect(parsed.sort).toBe(sort);
    });

    it("counts active filters deterministically", () => {
        const filters: CatalogFilters = {
            ...EMPTY_FILTERS,
            category: "Component",
            families: ["Dropper", "Sprayer"],
            colors: ["Black"],
            search: "pump",
        };

        expect(activeFilterCount(filters)).toBe(5);
    });

    it("classifies representative component names", () => {
        expect(classifyComponentType("Antique Bulb Sprayer Gold", null)).toBe("Sprayer");
        expect(classifyComponentType("Lotion Pump 18-415", null)).toBe("Lotion Pump");
        expect(classifyComponentType("Premium Dropper", null)).toBe("Dropper");
    });
});
