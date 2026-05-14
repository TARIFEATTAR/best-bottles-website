import {
    APPLICATOR_BUCKETS,
    applicatorBucketMatchesProductValues,
    catalogSearchMatches,
} from "../../catalogFilters";
import { CATEGORY_ORDER, FAMILY_ORDER } from "./config";
import type { CatalogPdfOptions, PrintableCatalogGroup, PrintableProduct } from "./types";

function normalized(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase();
}

function includesAny(value: string | null | undefined, filters: string[]): boolean {
    if (!filters.length) return true;
    const target = normalized(value);
    return filters.some((filter) => target === normalized(filter));
}

function textMatches(haystack: Array<string | null | undefined>, search: string): boolean {
    if (!search) return true;
    return catalogSearchMatches(search, haystack);
}

function applicatorMatches(values: string[], filters: string[]): boolean {
    if (!filters.length) return true;
    const exactValues = values.map(normalized);
    return filters.some((filter) => {
        const exact = normalized(filter);
        if (exactValues.includes(exact)) return true;
        const bucket = APPLICATOR_BUCKETS.find((item) => item.value === filter);
        return bucket
            ? applicatorBucketMatchesProductValues(bucket.value, values)
            : false;
    });
}

function brandMatches(value: string | null | undefined, filters: string[]): boolean {
    if (!filters.length) return true;
    const aliases = new Set([normalized(value), "best bottles", "nemat international"]);
    return filters.some((filter) => aliases.has(normalized(filter)));
}

function orderIndex(list: string[], value: string | null | undefined): number {
    const index = list.findIndex((item) => normalized(item) === normalized(value));
    return index === -1 ? list.length + 1 : index;
}

export function filterCatalogGroups(
    groups: PrintableCatalogGroup[],
    options: CatalogPdfOptions,
): PrintableCatalogGroup[] {
    return groups
        .filter((group) => includesAny(group.category, options.category))
        .filter((group) => includesAny(group.collection, options.collection))
        .filter((group) => includesAny(group.family, options.family))
        .filter((group) => brandMatches(group.brand, options.brand))
        .filter((group) => applicatorMatches(group.applicatorTypes, options.applicators))
        .filter((group) =>
            textMatches(
                [
                    group.displayName,
                    group.family,
                    group.collection,
                    group.category,
                    group.color,
                    group.rawColor,
                    group.canonicalColor,
                    group.canonicalColorOptions.join(" "),
                    group.capacity,
                    group.primaryGraceSku,
                    group.primaryWebsiteSku,
                    group.description,
                ],
                options.search,
            ),
        )
        .sort(compareCatalogGroups)
        .slice(0, options.limit);
}

export function filterProducts(
    products: PrintableProduct[],
    options: CatalogPdfOptions,
): PrintableProduct[] {
    return products
        .filter((product) => includesAny(product.category, options.category))
        .filter((product) => includesAny(product.collection, options.collection))
        .filter((product) => includesAny(product.family, options.family))
        .filter((product) => brandMatches(product.brand, options.brand))
        .filter((product) => applicatorMatches(product.applicator ? [product.applicator] : [], options.applicators))
        .filter((product) =>
            textMatches(
                [
                    product.itemName,
                    product.family,
                    product.collection,
                    product.category,
                    product.color,
                    product.rawColor,
                    product.canonicalColor,
                    product.capacity,
                    product.graceSku,
                    product.websiteSku,
                    product.description,
                ],
                options.search,
            ),
        )
        .sort(compareProducts)
        .slice(0, options.limit);
}

export function compareCatalogGroups(a: PrintableCatalogGroup, b: PrintableCatalogGroup): number {
    return (
        orderIndex(CATEGORY_ORDER, a.category) - orderIndex(CATEGORY_ORDER, b.category) ||
        orderIndex(FAMILY_ORDER, a.family) - orderIndex(FAMILY_ORDER, b.family) ||
        (a.capacityMl ?? 9999) - (b.capacityMl ?? 9999) ||
        normalized(a.color).localeCompare(normalized(b.color)) ||
        normalized(a.displayName).localeCompare(normalized(b.displayName))
    );
}

export function compareProducts(a: PrintableProduct, b: PrintableProduct): number {
    return (
        orderIndex(CATEGORY_ORDER, a.category) - orderIndex(CATEGORY_ORDER, b.category) ||
        orderIndex(FAMILY_ORDER, a.family) - orderIndex(FAMILY_ORDER, b.family) ||
        (a.capacityMl ?? 9999) - (b.capacityMl ?? 9999) ||
        normalized(a.color).localeCompare(normalized(b.color)) ||
        normalized(a.itemName).localeCompare(normalized(b.itemName))
    );
}

export function countFacet<T>(
    records: T[],
    selector: (record: T) => string | null | undefined,
): Array<{ label: string; count: number }> {
    const counts = new Map<string, number>();
    for (const record of records) {
        const label = selector(record);
        if (!label) continue;
        counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
