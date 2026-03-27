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

export function detectApplicatorIntent(term: string): "rollon" | "spray" | "dropper" | "pump" | "reducer" | null {
    const t = term.toLowerCase();
    if (/\b(roll|roller|ball)\b/.test(t)) return "rollon";
    if (/\b(spray|sprayer|mist|atomizer)\b/.test(t)) return "spray";
    if (/\bdropper\b/.test(t)) return "dropper";
    if (/\b(lotion|pump)\b/.test(t)) return "pump";
    if (/\b(reducer|splash)\b/.test(t)) return "reducer";
    return null;
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

// ─── Scoring ────────────────────────────────────────────────────────────────

export function scoreCatalogResult(
    result: SearchCandidate,
    meta: {
        termLower: string;
        detectedFamily: string | null;
        detectedCapMl: number | null;
        detectedColor: string | null;
        applicatorIntent: "rollon" | "spray" | "dropper" | "pump" | "reducer" | null;
    }
): number {
    let score = 0;

    if (meta.detectedFamily && result.family === meta.detectedFamily) score += 120;
    if (meta.detectedCapMl !== null && result.capacityMl === meta.detectedCapMl) score += 120;
    if (meta.detectedColor && result.color === meta.detectedColor) score += 140;

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
        capacityMl?: number | null;
        capacity?: string | null;
        applicator?: string | null;
    }>
): string {
    const warnings: string[] = [];
    const term = input.searchTerm;
    const termLower = term.toLowerCase();
    const detectedFamily =
        input.familyLimit
        ?? ["Apothecary", "Atomizer", "Bell", "Boston Round", "Circle", "Cylinder", "Diamond", "Diva", "Elegant", "Empire", "Grace", "Rectangle", "Round", "Sleek", "Slim", "Tulip", "Vial"]
            .find((family) => termLower.includes(family.toLowerCase()))
        ?? null;
    const capMatch = term.match(/\b(\d+)\s*ml\b/i);
    const detectedCapMl = capMatch ? parseInt(capMatch[1]) : null;
    const requestedColor = detectRequestedColorToken(term);
    const applicatorIntent = detectApplicatorIntent(term);

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
    };
    componentTypes: string[];
    totalComponents: number;
    components: Record<string, unknown>;
}): string {
    const thread = data.bottle.neckThreadSize ?? "unknown";
    return [
        `BOTTLE MATCHED: ${data.bottle.itemName}`,
        `BOTTLE THREAD SIZE: ${thread}. If the customer asks what fits, mention this thread size explicitly in your answer.`,
        `COMPONENT TYPES AVAILABLE: ${data.componentTypes.join(", ") || "none"}`,
        `TOTAL COMPATIBLE COMPONENTS: ${data.totalComponents}`,
        "",
        "COMPONENT DATA:",
        JSON.stringify(data, null, 2),
    ].join("\n");
}
