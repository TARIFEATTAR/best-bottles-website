/**
 * Grace AI — Search utilities for catalog queries.
 *
 * Extracted from grace.ts for maintainability.
 * Contains normalization, scoring, deduplication, and result formatting
 * functions used by the searchCatalog and getBottleComponents queries.
 */

// ─── Applicator aliases ─────────────────────────────────────────────────────

export const APPLICATOR_VALUE_ALIASES: Record<string, string> = {
    "metal roller": "Metal Roller Ball",
    "plastic roller": "Plastic Roller Ball",
    "metal roller ball": "Metal Roller Ball",
    "plastic roller ball": "Plastic Roller Ball",
    "antique bulb sprayer": "Vintage Bulb Sprayer",
    "antique bulb sprayer with tassel": "Vintage Bulb Sprayer with Tassel",
    "vintage bulb sprayer": "Vintage Bulb Sprayer",
    "vintage bulb sprayer with tassel": "Vintage Bulb Sprayer with Tassel",
};

// ─── Family minimum sizes ───────────────────────────────────────────────────

export const FAMILY_MIN_SIZE_ML: Record<string, number> = {
    "Boston Round": 15,
    Circle: 15,
    Cylinder: 5,
    Diva: 30,
    Elegant: 15,
    Empire: 30,
    Slim: 15,
};

export type { ShapeMatch } from "../src/lib/graceShapeIntent";
export {
    SHAPE_TO_FAMILIES,
    detectShapeIntent,
    inferCatalogCategoryFromSearchTerm,
} from "../src/lib/graceShapeIntent";
import {
    summarizeCanonicalProductCoverage,
    type CanonicalProductDataQualityFlag,
} from "../src/lib/canonicalProduct";

export const VERIFIED_9ML_CYLINDER_ROLLON_COLORS = [
    "Amber",
    "Clear",
    "Cobalt Blue",
    "Frosted",
    "Swirl",
] as const;

const VERIFIED_9ML_CYLINDER_ROLLON_COLOR_SET = new Set<string>(
    VERIFIED_9ML_CYLINDER_ROLLON_COLORS,
);

// ─── Types ──────────────────────────────────────────────────────────────────

export type SearchCandidate = {
    graceSku: string;
    slug?: string;
    family?: string | null;
    color?: string | null;
    capacityMl?: number | null;
    applicator?: string | null;
    itemName?: string | null;
};

// ─── Normalization functions ────────────────────────────────────────────────

export function normalizeSearchTerm(term: string): string {
    let t = term.toLowerCase();

    // ─── Phase 1: Use Case / Intent Mapping ─────────────────────────────────
    if (/\b(thick oil|perfume oil|body oil|attar|oud)\b/i.test(t)) {
        t = t.replace(/\b(thick oil|perfume oil|body oil|attar|oud)\b/gi, "roll-on");
    }
    if (/\b(fine mist|cologne|body spray|fragrance spray)\b/i.test(t)) {
        t = t.replace(/\b(fine mist|cologne|body spray|fragrance spray)\b/gi, "sprayer");
    }
    if (/\b(wedding favor|sample|prototype)\b/i.test(t)) {
        t = t.replace(/\b(wedding favor|sample|prototype)\b/gi, "vial");
    }
    if (/\b(smallest|small|tiny)\s+(spray|sprayer|mist)\b/i.test(t)) {
        t = t.replace(/\b(smallest|small|tiny)\s+(spray|sprayer|mist)\b/gi, "3ml spray");
    }

    return t
        .replace(/\broll[- ]?on\b/gi, "roller")
        .replace(/\broll[- ]?on\s*bottle\b/gi, "roller bottle")
        .replace(/\bsplash[- ]?on\b/gi, "reducer")
        .replace(/\blotion\s*pump\s*bottle\b/gi, "lotion pump")
        .replace(/\bdropper\s*bottle\b/gi, "dropper")
        .replace(/\b(thick|thin|best|good|nice|premium|very|high quality)\b/gi, "")
        .replace(/\bfive\b/gi, "5")
        .replace(/\bnine\b/gi, "9")
        .replace(/\bten\b/gi, "10")
        .replace(/\bthirty\b/gi, "30")
        .replace(/\bfifty\b/gi, "50")
        .replace(/\bone\s*hundred\b/gi, "100")
        .replace(/\b(\d+)\s*(ml|oz)\b/gi, "$1$2")
        .replace(/\s+/g, " ")
        .trim();
}

export function normalizeApplicatorValue(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = APPLICATOR_VALUE_ALIASES[value.trim().toLowerCase()];
    return normalized ?? value.trim();
}

// ─── Detection functions ────────────────────────────────────────────────────

export function detectCatalogColor(term: string): string | null {
    const t = term.toLowerCase();
    if (t.includes("cobalt blue")) return "Cobalt Blue";
    if (t.includes("clear")) return "Clear";
    if (t.includes("amber")) return "Amber";
    if (t.includes("frosted")) return "Frosted";
    if (t.includes("swirl")) return "Swirl";
    return null;
}

export function detectRequestedColorToken(term: string): string | null {
    const t = term.toLowerCase();
    const colorTokens = [
        "pink", "red", "green", "purple", "lavender",
        "white", "black", "blue", "cobalt blue",
        "clear", "amber", "frosted", "swirl",
    ];
    return colorTokens.find((token) => t.includes(token)) ?? null;
}

export function isVerified9mlCylinderRollOnColor(color: string | null | undefined): boolean {
    return Boolean(color && VERIFIED_9ML_CYLINDER_ROLLON_COLOR_SET.has(color));
}

/**
 * Single applicator intent for filtering/scoring. When the customer names **more than one**
 * applicator type (e.g. "roll-on, sprayer, and lotion pump"), returns null so we do not
 * narrow structured results to one applicator — critical for small sizes like 9ml where
 * Cylinder has roller, fine mist, and pump as separate SKUs.
 */
export function detectApplicatorIntent(term: string): "rollon" | "spray" | "dropper" | "pump" | "reducer" | null {
    const t = term.toLowerCase();
    const hasRollon = /\b(roll|roller|ball)\b/.test(t);
    const hasSpray = /\b(spray|sprayer|mist|atomizer)\b/.test(t);
    const hasDropper = /\bdropper\b/.test(t);
    const hasPump = /\b(lotion|pump)\b/.test(t);
    const hasReducer = /\b(reducer|splash)\b/.test(t);
    const distinctCount = [hasRollon, hasSpray, hasDropper, hasPump, hasReducer].filter(Boolean).length;
    if (distinctCount >= 2) return null;

    if (hasRollon) return "rollon";
    if (hasSpray) return "spray";
    if (hasDropper) return "dropper";
    if (hasPump) return "pump";
    if (hasReducer) return "reducer";
    return null;
}

export function is9mlCylinderRollOnTruthQuery(input: {
    searchTerm: string;
    normalizedTerm?: string | null;
    familyLimit?: string | null;
    applicatorFilter?: string | null;
}): boolean {
    const term = [input.searchTerm, input.normalizedTerm].filter(Boolean).join(" ").toLowerCase();
    const familyLimit = input.familyLimit?.toLowerCase();
    const applicatorFilter = input.applicatorFilter?.toLowerCase() ?? "";
    const has9ml = /\b9\s*ml\b|\b9ml\b/.test(term);
    const isCylinder = familyLimit === "cylinder" || /\bcylinder\b/.test(term);
    const wantsRollOn =
        /\b(roll|roller|roll-on|roll on|roller ball)\b/.test(term)
        || /\b(roll|roller|roll-on|roll on|roller ball)\b/.test(applicatorFilter);

    return has9ml && isCylinder && wantsRollOn;
}

export function is9mlCylinderRollOnRow(row: {
    family?: string | null;
    capacityMl?: number | null;
    applicator?: string | null;
    itemName?: string | null;
    slug?: string | null;
    graceSku?: string | null;
}): boolean {
    if (row.family?.toLowerCase() !== "cylinder" || row.capacityMl !== 9) return false;
    const haystack = [
        row.applicator,
        row.itemName,
        row.slug,
        row.graceSku,
    ].filter(Boolean).join(" ").toLowerCase();
    return /\b(roll|roller|roll-on|roll on|roller ball)\b/.test(haystack);
}

// ─── Deduplication ──────────────────────────────────────────────────────────

export function dedupeCatalogResults<T extends SearchCandidate>(items: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of items) {
        const key = item.graceSku || `${item.slug ?? ""}|${item.family ?? ""}|${item.color ?? ""}|${item.capacityMl ?? ""}|${item.applicator ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

/**
 * Ensures minimum representation from each required family in results.
 * Reserves N slots per family, then fills remaining slots with highest-scored items.
 */
export function diversifyByFamily<T extends SearchCandidate>(
    sortedItems: T[],
    requiredFamilies: string[],
    limit: number,
    minPerFamily = 3,
): T[] {
    if (requiredFamilies.length === 0) return sortedItems.slice(0, limit);

    const reserved: T[] = [];
    const reservedKeys = new Set<string>();
    const familyBuckets = new Map<string, T[]>();

    for (const fam of requiredFamilies) {
        familyBuckets.set(fam, []);
    }

    for (const item of sortedItems) {
        const fam = item.family ?? "";
        if (familyBuckets.has(fam)) {
            const bucket = familyBuckets.get(fam)!;
            if (bucket.length < minPerFamily) {
                bucket.push(item);
                reserved.push(item);
                reservedKeys.add(item.graceSku ?? `${item.family}|${item.capacityMl}|${item.color}`);
            }
        }
    }

    const remaining = sortedItems.filter(
        (item) => !reservedKeys.has(item.graceSku ?? `${item.family}|${item.capacityMl}|${item.color}`)
    );

    const result = [...reserved];
    for (const item of remaining) {
        if (result.length >= limit) break;
        result.push(item);
    }

    return result;
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export function scoreCatalogResult(
    result: SearchCandidate,
    meta: {
        termLower: string;
        detectedFamily: string | null;
        detectedCapMl: number | null;
        detectedColor: string | null;
        applicatorIntent: "rollon" | "spray" | "dropper" | "pump" | "reducer" | null;
        shapePrimaryFamilies?: string[];
        shapeAlsoFamilies?: string[];
    }
): number {
    let score = 0;

    if (meta.detectedFamily && result.family === meta.detectedFamily) score += 120;
    if (meta.detectedCapMl !== null && result.capacityMl === meta.detectedCapMl) score += 120;
    if (meta.detectedColor && result.color === meta.detectedColor) score += 140;

    if (meta.shapePrimaryFamilies?.includes(result.family ?? "")) score += 100;
    else if (meta.shapeAlsoFamilies?.includes(result.family ?? "")) score += 50;

    const applicator = (result.applicator ?? "").toLowerCase();
    if (meta.applicatorIntent === "rollon" && /(roller|roll)/.test(applicator)) score += 90;
    if (meta.applicatorIntent === "spray" && /(spray|atomizer|mist)/.test(applicator)) score += 90;
    if (meta.applicatorIntent === "dropper" && /dropper/.test(applicator)) score += 90;
    if (meta.applicatorIntent === "pump" && /pump/.test(applicator)) score += 90;
    if (meta.applicatorIntent === "reducer" && /reducer/.test(applicator)) score += 90;

    const haystack = [
        result.family ?? "",
        result.color ?? "",
        result.capacityMl?.toString() ?? "",
        result.applicator ?? "",
        result.itemName ?? "",
    ].join(" ").toLowerCase();
    const tokens = meta.termLower
        .split(/\s+/)
        .filter((token) => token.length > 1 && !["ml", "oz", "bottle"].includes(token));
    for (const token of tokens) {
        if (haystack.includes(token)) score += 8;
    }

    return score;
}

// ─── Empty-result hints (askGrace tool path) ───────────────────────────────

/**
 * When searchCatalog returns [], suggest a better query so Grace does not claim
 * a product is missing when the search term was too narrow (e.g. wrong family).
 */
export function emptySearchCatalogHint(rawSearchTerm: string): string {
    const normalized = normalizeSearchTerm(rawSearchTerm) || rawSearchTerm;
    const cap = normalized.match(/\b(\d+)\s*ml\b/i);
    const ml = cap ? parseInt(cap[1], 10) : null;
    const roll = /\b(roll|roller|ball)\b/i.test(normalized);
    if (ml === 9 && roll) {
        return " For 9ml roll-on bottles in the Cylinder line, retry searchCatalog with searchTerm \"9ml cylinder roller\" and familyLimit \"Cylinder\" (and categoryLimit \"Glass Bottle\" if you restricted category). Do not tell the customer 9ml roll-ons are unavailable until that search has been tried.";
    }
    const pump = /\b(lotion|treatment)\s*pump\b/i.test(normalized) || /\bpump\b/i.test(normalized);
    if (ml === 9 && pump && /\bcylinder|roll/i.test(normalized)) {
        return " For 9ml Cylinder lotion pump bottles, retry searchCatalog with searchTerm \"9ml cylinder lotion\" and familyLimit \"Cylinder\". The catalog stocks these; do not claim they are absent until this search is tried.";
    }
    return "";
}

// ─── Result formatters ──────────────────────────────────────────────────────

export function buildSearchCatalogToolResult(
    input: {
        searchTerm: string;
        familyLimit?: string;
        applicatorFilter?: string;
    },
    data: Array<{
        family?: string | null;
        color?: string | null;
        canonicalColor?: string | null;
        capacityMl?: number | null;
        capacity?: string | null;
        applicator?: string | null;
        itemName?: string | null;
        slug?: string | null;
        graceSku?: string | null;
        dataQualityFlags?: CanonicalProductDataQualityFlag[] | string[] | null;
    }>
): string {
    const warnings: string[] = [];
    const term = input.searchTerm;
    const termLower = term.toLowerCase();
    const termForCap = normalizeSearchTerm(term) || term;
    const detectedFamily =
        input.familyLimit
        ?? ["Apothecary", "Atomizer", "Bell", "Boston Round", "Circle", "Cylinder", "Diamond", "Diva", "Elegant", "Empire", "Grace", "Rectangle", "Round", "Sleek", "Slim", "Tulip", "Vial"]
            .find((family) => termLower.includes(family.toLowerCase()))
        ?? null;
    const capMatch = termForCap.match(/\b(\d+)\s*ml\b/i);
    const detectedCapMl = capMatch ? parseInt(capMatch[1]) : null;
    const requestedColor = detectRequestedColorToken(term);
    const applicatorIntent = detectApplicatorIntent(termForCap);
    const asksForColorCoverage = /\b(all|every|each|available)\b.*\bcolou?rs?\b|\bcolou?rs?\b.*\b(all|every|each|available)\b/i.test(term);
    const isCylinderContext =
        detectedFamily === "Cylinder"
        || (input.familyLimit?.toLowerCase() === "cylinder")
        || /\bcylinder\b/i.test(term)
        || /\bcylinder\b/i.test(termForCap);
    const mentionsRollOn = /roll|roller/i.test(term) || /roll|roller/i.test(termForCap);
    const is9mlCylinderRollOnContext = is9mlCylinderRollOnTruthQuery({
        searchTerm: term,
        normalizedTerm: termForCap,
        familyLimit: input.familyLimit,
        applicatorFilter: input.applicatorFilter,
    });
    const coverageRows = is9mlCylinderRollOnContext
        ? data.filter((item) =>
            is9mlCylinderRollOnRow(item)
            && isVerified9mlCylinderRollOnColor(item.canonicalColor ?? item.color)
        )
        : data;
    const coverage = summarizeCanonicalProductCoverage(coverageRows);

    if (is9mlCylinderRollOnContext) {
        warnings.push(
            `VERIFIED 9ML CYLINDER ROLL-ON COLORS: ${VERIFIED_9ML_CYLINDER_ROLLON_COLORS.join(", ")}. Swirl is a verified 9ml Cylinder roll-on glass option. Do NOT list White or Green as 9ml Cylinder roll-on glass colors; White is cap/import drift in this family, and Green belongs to separate decorative/glass-stopper products when present.`,
        );
    }

    if (detectedCapMl !== null && coverage.colors.length > 1) {
        warnings.push(
            `${asksForColorCoverage ? "REQUIRED COVERAGE" : "CATALOG COVERAGE"}: The returned ${detectedCapMl}ml result set includes these canonical color options: ${coverage.colors.join(", ")}. If the customer asks for all colors, list every color in this sentence and do not omit lower-ranked groups.`
        );
    }
    if (coverage.dataQualityFlags.includes("color_derived_from_sku_swirl")) {
        warnings.push(
            "DATA QUALITY NOTE: At least one Swirl color is derived from SKU/name evidence because the raw source color may be marked Clear. Preserve this as Swirl in customer-facing color lists and flag it for source-sheet cleanup."
        );
    }

    const has9mlRollOn = data.some((item) => {
        if (item.capacityMl !== 9) return false;
        const app = (item.applicator ?? "").toLowerCase();
        return /roller|roll/.test(app);
    });
    const wants9mlRoll = detectedCapMl === 9 && /roll|roller/i.test(termForCap);
    if (has9mlRollOn && wants9mlRoll) {
        warnings.push(
            "CONFIRMATION: These results include 9ml roll-on (roller ball) products. Summarize them positively. Do NOT say you were unable to find 9ml roll-on bottles, that the catalog returned none, or that you cannot locate them — they appear in the JSON below.",
        );
    }
    if (wants9mlRoll && !has9mlRollOn && data.length > 0) {
        warnings.push(
            "WARNING: This result set contains no 9ml roll-on bottle (wrong size or family is common). Call searchCatalog again with searchTerm \"9ml cylinder roller\" and familyLimit \"Cylinder\" before telling the customer you cannot find 9ml roll-ons.",
        );
    }

    const cyl9Roll = data.some(
        (item) =>
            item.family === "Cylinder"
            && item.capacityMl === 9
            && /roller|roll/i.test((item.applicator ?? "").toLowerCase()),
    );
    const cyl9Pump = data.some(
        (item) =>
            item.family === "Cylinder"
            && item.capacityMl === 9
            && (item.applicator ?? "").toLowerCase().includes("lotion pump"),
    );
    if (cyl9Roll || cyl9Pump) {
        const parts = [cyl9Roll && "roll-on (roller ball)", cyl9Pump && "lotion pump"].filter(Boolean);
        warnings.push(
            `FORBIDDEN: Results below include 9ml Cylinder bottle(s) with ${parts.join(" and ")}. Do NOT tell the customer we do not have 9ml Cylinder bottles with roll-on or lotion pump — that contradicts this data.`,
        );
    }

    if (detectedFamily && detectedCapMl !== null) {
        const minimum = FAMILY_MIN_SIZE_ML[detectedFamily];
        if (minimum && detectedCapMl < minimum) {
            warnings.push(
                `WARNING: We do NOT stock a ${detectedCapMl}ml ${detectedFamily}. ${detectedFamily} starts at ${minimum}ml. Do NOT say we have the requested size. You MUST explicitly mention "${minimum}ml" in your answer and pivot to that exact size or larger.`
            );
        }
    }

    if (applicatorIntent === "rollon" && detectedCapMl !== null && detectedCapMl < 5) {
        warnings.push(
            "WARNING: We do NOT stock roll-on bottles smaller than 5ml. Do NOT repeat the customer's requested sub-5ml roll-on as if it exists. Say the smallest roll-on is 5ml and pivot to actual 5ml options."
        );
    }

    if (isCylinderContext && detectedCapMl === 9 && mentionsRollOn) {
        const hasRollOnSku = data.some((item) => {
            const app = (item.applicator ?? "").toLowerCase();
            const name = (item.itemName ?? "").toLowerCase();
            return (
                /roller|roll-on|roll on/.test(app)
                || /roll-on|roller\s*ball/.test(name)
            );
        });
        if (hasRollOnSku) {
            warnings.push(
                "WARNING: 9ml Cylinder roll-on bottles ARE stocked as complete product SKUs (roller ball + cap). Do NOT say we do not typically offer pre-assembled roll-on or that the customer must only pair a plain bottle with a separate roll-on fitment."
            );
        }
    }

    if (requestedColor) {
        const exactColorMatch = data.some((item) => (item.color ?? "").toLowerCase() === requestedColor.toLowerCase());
        if (!exactColorMatch) {
            const availableColors = [...new Set(data.map((item) => item.color).filter(Boolean))] as string[];
            warnings.push(
                `WARNING: No exact match was found for requested color "${requestedColor}". Do NOT say we carry that color unless it appears in the results.`
                + (availableColors.length > 0 ? ` Available colors in these results: ${availableColors.join(", ")}.` : "")
            );
        }
    }

    if (/\bsmallest\b/i.test(term) && applicatorIntent === "spray") {
        const smallest = data
            .filter((item) => /(spray|atomizer|mist)/i.test(item.applicator ?? ""))
            .sort((a, b) => (a.capacityMl ?? 9999) - (b.capacityMl ?? 9999))[0];
        if (smallest?.capacity) {
            warnings.push(
                `WARNING: For this question, mention the EXACT smallest spray capacity from results: ${smallest.capacity}. Do not round it away or say we don't carry a smallest spray.`
            );
        }
    }

    return warnings.length > 0
        ? `${warnings.join("\n")}\n\nSEARCH RESULTS:\n${JSON.stringify(data, null, 2)}`
        : JSON.stringify(data, null, 2);
}

export function buildBottleComponentsToolResult(data: {
    bottle: {
        itemName: string;
        neckThreadSize?: string | null;
        category?: string | null;
    };
    componentTypes: string[];
    totalComponents: number;
    components: Record<string, unknown>;
}): string {
    const thread = data.bottle.neckThreadSize ?? "unknown";
    return [
        "COMPATIBILITY RULE: Physical fit is determined by matching NECK THREAD (finish). The bottle's neck thread size is the primary key — use it when explaining what closures or applicators fit.",
        `BOTTLE NECK THREAD: ${thread}. State this specification when the customer asks what fits. If thread is unknown or missing, say so and rely on COMPONENT DATA only.`,
        "COMPONENT DATA lists what we catalog for this bottle after fitment rules; for thread-only questions you may also use checkCompatibility with this thread size.",
        "",
        `BOTTLE MATCHED: ${data.bottle.itemName}`,
        `COMPONENT TYPES AVAILABLE: ${data.componentTypes.join(", ") || "none"}`,
        `TOTAL COMPATIBLE COMPONENTS: ${data.totalComponents}`,
        "",
        "COMPONENT DATA:",
        JSON.stringify(data, null, 2),
    ].join("\n");
}
