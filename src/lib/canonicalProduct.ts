export const CANONICAL_PRODUCT_MODEL_VERSION = "2026-05-14.v1";

export type CanonicalSourceSystem =
    | "convex.productGroups"
    | "convex.products"
    | "shopify"
    | "pdf"
    | "catalog-ui"
    | "grace";

export type CanonicalProductDataQualityFlag =
    | "color_raw_missing"
    | "color_normalized_blue_to_cobalt_blue"
    | "color_derived_from_sku_swirl"
    | "color_derived_from_text"
    | "color_mismatch_group_variant"
    | "capacity_label_normalized"
    | "description_applicator_mismatch"
    | "shopify_variant_missing";

export interface CanonicalSourceTrace {
    modelVersion: string;
    sourceSystem: CanonicalSourceSystem;
    sourceId: string | null;
    productId?: string | null;
    graceSku?: string | null;
    websiteSku?: string | null;
    shopifyProductId?: string | null;
    shopifyVariantId?: string | null;
    importSource?: string | null;
}

export interface CanonicalProductGroupInput {
    _id?: unknown;
    id?: unknown;
    slug?: string | null;
    displayName?: string | null;
    family?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    color?: string | null;
    category?: string | null;
    bottleCollection?: string | null;
    collection?: string | null;
    neckThreadSize?: string | null;
    variantCount?: number | null;
    priceRangeMin?: number | null;
    priceRangeMax?: number | null;
    shopifyProductId?: string | null;
    heroImageUrl?: string | null;
    applicatorTypes?: string[] | null;
    primaryGraceSku?: string | null;
    primaryWebsiteSku?: string | null;
    groupDescription?: string | null;
    paperDollFamilyKey?: string | null;
}

export interface CanonicalProductVariantInput {
    _id?: unknown;
    id?: unknown;
    productId?: string | null;
    websiteSku?: string | null;
    graceSku?: string | null;
    itemName?: string | null;
    itemDescription?: string | null;
    graceDescription?: string | null;
    category?: string | null;
    family?: string | null;
    shape?: string | null;
    color?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    capacityOz?: number | null;
    applicator?: string | null;
    capColor?: string | null;
    trimColor?: string | null;
    capStyle?: string | null;
    capHeight?: string | null;
    ballMaterial?: string | null;
    neckThreadSize?: string | null;
    heightWithCap?: string | null;
    heightWithoutCap?: string | null;
    diameter?: string | null;
    bottleWeightG?: number | null;
    caseQuantity?: number | null;
    caseWeightG?: number | null;
    qbPrice?: number | null;
    webPrice1pc?: number | null;
    webPrice10pc?: number | null;
    webPrice12pc?: number | null;
    stockStatus?: string | null;
    imageUrl?: string | null;
    imageUrlCapOff?: string | null;
    productUrl?: string | null;
    dataGrade?: string | null;
    bottleCollection?: string | null;
    collection?: string | null;
    useCaseDescription?: string | null;
    fitmentStatus?: string | null;
    components?: unknown;
    assemblyType?: string | null;
    componentGroup?: string | null;
    verified?: boolean | null;
    importSource?: string | null;
    productGroupId?: unknown;
    shopifyVariantId?: string | null;
    shopifyInventoryItemId?: string | null;
}

export interface CanonicalProductGroup {
    id: string;
    slug: string;
    displayName: string;
    family: string | null;
    capacity: string | null;
    capacityMl: number | null;
    capacitySearchTokens: string[];
    rawColor: string | null;
    canonicalColor: string | null;
    canonicalColorOptions: string[];
    category: string;
    collection: string | null;
    neckThreadSize: string | null;
    variantCount: number;
    priceRangeMin: number | null;
    priceRangeMax: number | null;
    shopifyProductId: string | null;
    heroImageUrl: string | null;
    applicatorTypes: string[];
    primaryGraceSku: string | null;
    primaryWebsiteSku: string | null;
    description: string | null;
    availabilitySummary: string | null;
    compatibilitySummary: string | null;
    dataQualityFlags: CanonicalProductDataQualityFlag[];
    sourceTrace: CanonicalSourceTrace;
}

export interface CanonicalProductVariant {
    id: string;
    productId: string | null;
    graceSku: string;
    websiteSku: string;
    itemName: string;
    groupId: string | null;
    groupSlug: string | null;
    family: string | null;
    shape: string | null;
    category: string;
    collection: string | null;
    capacity: string | null;
    capacityMl: number | null;
    capacityOz: number | null;
    capacitySearchTokens: string[];
    rawColor: string | null;
    canonicalColor: string | null;
    applicator: string | null;
    capColor: string | null;
    trimColor: string | null;
    capStyle: string | null;
    capHeight: string | null;
    ballMaterial: string | null;
    neckThreadSize: string | null;
    heightWithCap: string | null;
    heightWithoutCap: string | null;
    diameter: string | null;
    bottleWeightG: number | null;
    caseQuantity: number | null;
    caseWeightG: number | null;
    qbPrice: number | null;
    webPrice1pc: number | null;
    webPrice10pc: number | null;
    webPrice12pc: number | null;
    stockStatus: string | null;
    imageUrl: string | null;
    imageUrlCapOff: string | null;
    productUrl: string | null;
    description: string | null;
    fitmentStatus: string | null;
    assemblyType: string | null;
    componentGroup: string | null;
    verified: boolean;
    shopifyVariantId: string | null;
    shopifyInventoryItemId: string | null;
    dataQualityFlags: CanonicalProductDataQualityFlag[];
    sourceTrace: CanonicalSourceTrace;
}

export interface CanonicalCoverageSummary {
    modelVersion: string;
    totalResults: number;
    groupCount: number;
    families: string[];
    colors: string[];
    applicators: string[];
    capacitiesMl: number[];
    dataQualityFlags: CanonicalProductDataQualityFlag[];
}

type ColorDerivationInput = {
    rawColor?: string | null;
    displayName?: string | null;
    itemName?: string | null;
    websiteSku?: string | null;
    graceSku?: string | null;
    slug?: string | null;
};

type DescriptionInput = {
    groupDescription?: string | null;
    variantDescription?: string | null;
    graceDescription?: string | null;
    applicators?: Array<string | null | undefined> | null;
};

function sourceId(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
}

function cleanString(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function finiteNumber(value: number | null | undefined): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values.filter((value): value is string => Boolean(cleanString(value)))))
        .sort((a, b) => a.localeCompare(b));
}

function uniqueFlags(values: Array<CanonicalProductDataQualityFlag | null | undefined>): CanonicalProductDataQualityFlag[] {
    return Array.from(new Set(values.filter((value): value is CanonicalProductDataQualityFlag => Boolean(value))));
}

export function normalizeCapacityLabel(value: string | null | undefined): string | null {
    const raw = cleanString(value);
    if (!raw) return null;
    return raw
        .replace(/\s*(ml|oz)\b/gi, (_, unit: string) => ` ${unit.toLowerCase()}`)
        .replace(/\s+/g, " ")
        .trim();
}

export function capacitySearchTokens(capacity: string | null | undefined, capacityMl: number | null | undefined): string[] {
    const tokens = new Set<string>();
    const normalized = normalizeCapacityLabel(capacity);
    if (normalized) {
        tokens.add(normalized);
        tokens.add(normalized.replace(/\s+/g, ""));
    }
    if (capacityMl !== null && capacityMl !== undefined && Number.isFinite(capacityMl)) {
        tokens.add(`${capacityMl} ml`);
        tokens.add(`${capacityMl}ml`);
    }
    return Array.from(tokens);
}

function normalizeRawColor(rawColor: string | null): {
    canonicalColor: string | null;
    flags: CanonicalProductDataQualityFlag[];
} {
    if (!rawColor) return { canonicalColor: null, flags: ["color_raw_missing"] };
    const value = rawColor.trim().toLowerCase();
    if (!value) return { canonicalColor: null, flags: ["color_raw_missing"] };
    if (/\bsw(i|y)?rl\b|\bswirl\b/.test(value)) return { canonicalColor: "Swirl", flags: [] };
    if (/\bcobalt\b/.test(value)) return { canonicalColor: "Cobalt Blue", flags: [] };
    if (value === "blue") return { canonicalColor: "Cobalt Blue", flags: ["color_normalized_blue_to_cobalt_blue"] };
    if (/\bfrost/.test(value)) return { canonicalColor: "Frosted", flags: [] };
    if (/\bamber\b|\bbrown\b/.test(value)) return { canonicalColor: "Amber", flags: [] };
    if (/\bclear\b/.test(value)) return { canonicalColor: "Clear", flags: [] };
    if (/\bwhite\b/.test(value)) return { canonicalColor: "White", flags: [] };
    if (/\bgreen\b/.test(value)) return { canonicalColor: "Green", flags: [] };
    if (/\bblack\b/.test(value)) return { canonicalColor: "Black", flags: [] };
    return { canonicalColor: rawColor.trim(), flags: [] };
}

export function deriveCanonicalColor(input: ColorDerivationInput): {
    rawColor: string | null;
    canonicalColor: string | null;
    dataQualityFlags: CanonicalProductDataQualityFlag[];
} {
    const rawColor = cleanString(input.rawColor);
    const normalized = normalizeRawColor(rawColor);
    const evidence = [
        input.displayName,
        input.itemName,
        input.websiteSku,
        input.graceSku,
        input.slug,
    ].filter(Boolean).join(" ").toLowerCase();

    if (/\bswirl\b|\bswrl\b|swrl/.test(evidence) && normalized.canonicalColor !== "Swirl") {
        return {
            rawColor,
            canonicalColor: "Swirl",
            dataQualityFlags: uniqueFlags([...normalized.flags, "color_derived_from_sku_swirl"]),
        };
    }

    if (!normalized.canonicalColor) {
        const inferred =
            /\bcobalt\b/.test(evidence) ? "Cobalt Blue"
                : /\bblue\b/.test(evidence) ? "Cobalt Blue"
                    : /\bfrost/.test(evidence) ? "Frosted"
                        : /\bamber\b|\bbrown\b/.test(evidence) ? "Amber"
                            : /\bclear\b/.test(evidence) ? "Clear"
                                : /\bwhite\b/.test(evidence) ? "White"
                                    : /\bgreen\b/.test(evidence) ? "Green"
                                        : null;
        if (inferred) {
            return {
                rawColor,
                canonicalColor: inferred,
                dataQualityFlags: uniqueFlags([...normalized.flags, "color_derived_from_text"]),
            };
        }
    }

    return {
        rawColor,
        canonicalColor: normalized.canonicalColor,
        dataQualityFlags: normalized.flags,
    };
}

export function descriptionConflictsWithApplicators(
    description: string | null | undefined,
    applicators: Array<string | null | undefined> | null | undefined,
): boolean {
    const text = cleanString(description)?.toLowerCase();
    const apps = uniqueSorted(applicators ?? []).join(" ").toLowerCase();
    if (!text || !apps) return false;

    const saysSpray = /\b(spray|sprayer|mist|atomizer)\b/.test(text);
    const saysRoll = /\b(roll[- ]?on|roller|rollerball|roller ball)\b/.test(text);
    const saysPump = /\b(lotion|treatment)\s+pump\b|\bpump\b/.test(text);
    const hasSpray = /\b(spray|sprayer|mist|atomizer)\b/.test(apps);
    const hasRoll = /\b(roll|roller)\b/.test(apps);
    const hasPump = /\bpump\b/.test(apps);

    return (saysSpray && !hasSpray) || (saysRoll && !hasRoll) || (saysPump && !hasPump);
}

export function chooseCanonicalProductDescription(input: DescriptionInput): string | null {
    const variantDescription = cleanString(input.variantDescription) ?? cleanString(input.graceDescription);
    const groupDescription = cleanString(input.groupDescription);
    if (!groupDescription) return variantDescription;
    if (descriptionConflictsWithApplicators(groupDescription, input.applicators)) {
        return variantDescription ?? groupDescription;
    }
    return groupDescription;
}

export function buildCanonicalProductVariant(
    raw: CanonicalProductVariantInput,
    group?: CanonicalProductGroupInput | null,
    sourceSystem: CanonicalSourceSystem = "convex.products",
): CanonicalProductVariant {
    const color = deriveCanonicalColor({
        rawColor: raw.color,
        displayName: group?.displayName,
        itemName: raw.itemName,
        websiteSku: raw.websiteSku,
        graceSku: raw.graceSku,
        slug: group?.slug,
    });
    const groupColor = group
        ? deriveCanonicalColor({
            rawColor: group.color,
            displayName: group.displayName,
            slug: group.slug,
            websiteSku: raw.websiteSku,
            graceSku: raw.graceSku,
        }).canonicalColor
        : null;
    const flags: CanonicalProductDataQualityFlag[] = [...color.dataQualityFlags];
    if (groupColor && color.canonicalColor && groupColor !== color.canonicalColor) {
        flags.push("color_mismatch_group_variant");
    }
    if (raw.shopifyVariantId == null) flags.push("shopify_variant_missing");
    if (descriptionConflictsWithApplicators(raw.itemDescription ?? raw.graceDescription, [raw.applicator])) {
        flags.push("description_applicator_mismatch");
    }

    const capacity = normalizeCapacityLabel(raw.capacity);
    if (capacity && raw.capacity && capacity !== raw.capacity) flags.push("capacity_label_normalized");

    return {
        id: sourceId(raw._id ?? raw.id) ?? "",
        productId: cleanString(raw.productId),
        graceSku: cleanString(raw.graceSku) ?? "",
        websiteSku: cleanString(raw.websiteSku) ?? "",
        itemName: cleanString(raw.itemName) ?? "Untitled SKU",
        groupId: sourceId(raw.productGroupId ?? group?._id ?? group?.id),
        groupSlug: cleanString(group?.slug),
        family: cleanString(raw.family ?? group?.family),
        shape: cleanString(raw.shape),
        category: cleanString(raw.category ?? group?.category) ?? "Other",
        collection: cleanString(raw.bottleCollection ?? raw.collection ?? group?.bottleCollection ?? group?.collection),
        capacity,
        capacityMl: finiteNumber(raw.capacityMl ?? group?.capacityMl),
        capacityOz: finiteNumber(raw.capacityOz),
        capacitySearchTokens: capacitySearchTokens(raw.capacity ?? group?.capacity, raw.capacityMl ?? group?.capacityMl),
        rawColor: color.rawColor,
        canonicalColor: color.canonicalColor,
        applicator: cleanString(raw.applicator),
        capColor: cleanString(raw.capColor),
        trimColor: cleanString(raw.trimColor),
        capStyle: cleanString(raw.capStyle),
        capHeight: cleanString(raw.capHeight),
        ballMaterial: cleanString(raw.ballMaterial),
        neckThreadSize: cleanString(raw.neckThreadSize ?? group?.neckThreadSize),
        heightWithCap: cleanString(raw.heightWithCap),
        heightWithoutCap: cleanString(raw.heightWithoutCap),
        diameter: cleanString(raw.diameter),
        bottleWeightG: finiteNumber(raw.bottleWeightG),
        caseQuantity: finiteNumber(raw.caseQuantity),
        caseWeightG: finiteNumber(raw.caseWeightG),
        qbPrice: finiteNumber(raw.qbPrice),
        webPrice1pc: finiteNumber(raw.webPrice1pc),
        webPrice10pc: finiteNumber(raw.webPrice10pc),
        webPrice12pc: finiteNumber(raw.webPrice12pc),
        stockStatus: cleanString(raw.stockStatus),
        imageUrl: cleanString(raw.imageUrl),
        imageUrlCapOff: cleanString(raw.imageUrlCapOff),
        productUrl: cleanString(raw.productUrl),
        description: chooseCanonicalProductDescription({
            groupDescription: group?.groupDescription,
            variantDescription: raw.itemDescription,
            graceDescription: raw.graceDescription,
            applicators: raw.applicator ? [raw.applicator] : group?.applicatorTypes,
        }),
        fitmentStatus: cleanString(raw.fitmentStatus),
        assemblyType: cleanString(raw.assemblyType),
        componentGroup: cleanString(raw.componentGroup),
        verified: Boolean(raw.verified),
        shopifyVariantId: cleanString(raw.shopifyVariantId),
        shopifyInventoryItemId: cleanString(raw.shopifyInventoryItemId),
        dataQualityFlags: uniqueFlags(flags),
        sourceTrace: {
            modelVersion: CANONICAL_PRODUCT_MODEL_VERSION,
            sourceSystem,
            sourceId: sourceId(raw._id ?? raw.id),
            productId: cleanString(raw.productId),
            graceSku: cleanString(raw.graceSku),
            websiteSku: cleanString(raw.websiteSku),
            shopifyVariantId: cleanString(raw.shopifyVariantId),
            importSource: cleanString(raw.importSource),
        },
    };
}

export function buildCanonicalProductGroup(
    raw: CanonicalProductGroupInput,
    variants: CanonicalProductVariantInput[] = [],
    sourceSystem: CanonicalSourceSystem = "convex.productGroups",
): CanonicalProductGroup {
    const color = deriveCanonicalColor({
        rawColor: raw.color,
        displayName: raw.displayName,
        slug: raw.slug,
        websiteSku: raw.primaryWebsiteSku,
        graceSku: raw.primaryGraceSku,
    });
    const canonicalVariants = variants.map((variant) => buildCanonicalProductVariant(variant, raw));
    const flags: CanonicalProductDataQualityFlag[] = [...color.dataQualityFlags];
    const applicators = Array.isArray(raw.applicatorTypes) ? raw.applicatorTypes.filter(Boolean) : [];
    if (descriptionConflictsWithApplicators(raw.groupDescription, applicators)) {
        flags.push("description_applicator_mismatch");
    }
    for (const variant of canonicalVariants) {
        flags.push(...variant.dataQualityFlags);
    }
    const capacity = normalizeCapacityLabel(raw.capacity);
    if (capacity && raw.capacity && capacity !== raw.capacity) flags.push("capacity_label_normalized");

    const colors = uniqueSorted([
        color.canonicalColor,
        ...canonicalVariants.map((variant) => variant.canonicalColor),
    ]);
    const availabilitySummary = variants.length > 0
        ? `${variants.length} variants represented`
        : raw.variantCount != null
            ? `${raw.variantCount} variants represented`
            : null;
    const compatibilitySummary = raw.neckThreadSize
        ? `Compatibility requires verified ${raw.neckThreadSize} neck-thread fitment.`
        : null;

    return {
        id: sourceId(raw._id ?? raw.id) ?? "",
        slug: cleanString(raw.slug) ?? "",
        displayName: cleanString(raw.displayName) ?? "Untitled Product",
        family: cleanString(raw.family),
        capacity,
        capacityMl: finiteNumber(raw.capacityMl),
        capacitySearchTokens: capacitySearchTokens(raw.capacity, raw.capacityMl),
        rawColor: color.rawColor,
        canonicalColor: color.canonicalColor,
        canonicalColorOptions: colors,
        category: cleanString(raw.category) ?? "Other",
        collection: cleanString(raw.bottleCollection ?? raw.collection),
        neckThreadSize: cleanString(raw.neckThreadSize),
        variantCount: finiteNumber(raw.variantCount) ?? variants.length,
        priceRangeMin: finiteNumber(raw.priceRangeMin),
        priceRangeMax: finiteNumber(raw.priceRangeMax),
        shopifyProductId: cleanString(raw.shopifyProductId),
        heroImageUrl: cleanString(raw.heroImageUrl),
        applicatorTypes: uniqueSorted(applicators),
        primaryGraceSku: cleanString(raw.primaryGraceSku),
        primaryWebsiteSku: cleanString(raw.primaryWebsiteSku),
        description: chooseCanonicalProductDescription({
            groupDescription: raw.groupDescription,
            applicators,
        }),
        availabilitySummary,
        compatibilitySummary,
        dataQualityFlags: uniqueFlags(flags),
        sourceTrace: {
            modelVersion: CANONICAL_PRODUCT_MODEL_VERSION,
            sourceSystem,
            sourceId: sourceId(raw._id ?? raw.id),
            graceSku: cleanString(raw.primaryGraceSku),
            websiteSku: cleanString(raw.primaryWebsiteSku),
            shopifyProductId: cleanString(raw.shopifyProductId),
        },
    };
}

export function summarizeCanonicalProductCoverage(
    rows: Array<{
        family?: string | null;
        canonicalColor?: string | null;
        color?: string | null;
        applicator?: string | null;
        capacityMl?: number | null;
        slug?: string | null;
        dataQualityFlags?: CanonicalProductDataQualityFlag[] | string[] | null;
    }>,
): CanonicalCoverageSummary {
    const groups = new Set<string>();
    const flags: CanonicalProductDataQualityFlag[] = [];
    for (const row of rows) {
        groups.add(row.slug ?? `${row.family ?? ""}|${row.capacityMl ?? ""}|${row.canonicalColor ?? row.color ?? ""}`);
        for (const flag of row.dataQualityFlags ?? []) {
            flags.push(flag as CanonicalProductDataQualityFlag);
        }
    }

    return {
        modelVersion: CANONICAL_PRODUCT_MODEL_VERSION,
        totalResults: rows.length,
        groupCount: groups.size,
        families: uniqueSorted(rows.map((row) => row.family)),
        colors: uniqueSorted(rows.map((row) => row.canonicalColor ?? row.color)),
        applicators: uniqueSorted(rows.map((row) => row.applicator)),
        capacitiesMl: Array.from(new Set(rows
            .map((row) => row.capacityMl)
            .filter((value): value is number => typeof value === "number" && Number.isFinite(value))))
            .sort((a, b) => a - b),
        dataQualityFlags: uniqueFlags(flags),
    };
}
