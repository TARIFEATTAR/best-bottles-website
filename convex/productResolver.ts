import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const KNOWN_FAMILIES = [
    "Apothecary",
    "Atomizer",
    "Bell",
    "Boston Round",
    "Circle",
    "Cream Jar",
    "Cylinder",
    "Decorative",
    "Diamond",
    "Diva",
    "Elegant",
    "Empire",
    "Flair",
    "Grace",
    "Lotion Bottle",
    "Plastic Bottle",
    "Rectangle",
    "Round",
    "Royal",
    "Sleek",
    "Slim",
    "Square",
    "Tulip",
    "Vial",
] as const;

const COLOR_ALIASES: Record<string, string> = {
    amber: "Amber",
    black: "Black",
    blue: "Blue",
    clear: "Clear",
    cobalt: "Cobalt Blue",
    "cobalt blue": "Cobalt Blue",
    copper: "Copper",
    frosted: "Frosted",
    gold: "Gold",
    green: "Green",
    pink: "Pink",
    red: "Red",
    silver: "Silver",
    swirl: "Swirl",
    white: "White",
};

const APPLICATOR_VALUE_ALIASES: Record<string, string> = {
    "metal roller": "Metal Roller Ball",
    "plastic roller": "Plastic Roller Ball",
    "metal roller ball": "Metal Roller Ball",
    "plastic roller ball": "Plastic Roller Ball",
    "antique bulb sprayer": "Vintage Bulb Sprayer",
    "antique bulb sprayer with tassel": "Vintage Bulb Sprayer with Tassel",
    "vintage bulb sprayer": "Vintage Bulb Sprayer",
    "vintage bulb sprayer with tassel": "Vintage Bulb Sprayer with Tassel",
};

const APPLICATOR_BUCKETS: Record<string, string> = {
    "Metal Roller Ball": "rollon",
    "Plastic Roller Ball": "rollon",
    "Fine Mist Sprayer": "spray",
    "Perfume Spray Pump": "spray",
    "Atomizer": "spray",
    "Vintage Bulb Sprayer": "spray",
    "Vintage Bulb Sprayer with Tassel": "spray",
    "Dropper": "dropper",
    "Reducer": "reducer",
    "Lotion Pump": "lotionpump",
    "Cap/Closure": "capclosure",
    "Glass Rod": "glasswand",
    "Applicator Cap": "glasswand",
    "Glass Stopper": "glassapplicator",
};

const APPLICATOR_QUERY_HINTS: Array<{ pattern: RegExp; values: string[]; bucket: string }> = [
    { pattern: /\b(roll[- ]?on|roller|rollerball|roller ball)\b/i, values: ["Metal Roller Ball", "Plastic Roller Ball"], bucket: "rollon" },
    { pattern: /\b(fine mist|sprayer|spray|atomizer|mist)\b/i, values: ["Fine Mist Sprayer", "Perfume Spray Pump", "Atomizer", "Vintage Bulb Sprayer", "Vintage Bulb Sprayer with Tassel"], bucket: "spray" },
    { pattern: /\b(antique bulb|vintage bulb|bulb sprayer|bulb spray)\b/i, values: ["Vintage Bulb Sprayer", "Vintage Bulb Sprayer with Tassel"], bucket: "spray" },
    { pattern: /\b(dropper|pipette)\b/i, values: ["Dropper"], bucket: "dropper" },
    { pattern: /\b(reducer|splash[- ]?on|splash on|orifice)\b/i, values: ["Reducer"], bucket: "reducer" },
    { pattern: /\b(lotion pump|treatment pump|pump bottle|pump)\b/i, values: ["Lotion Pump"], bucket: "lotionpump" },
    { pattern: /\b(cap|closure|lid)\b/i, values: ["Cap/Closure"], bucket: "capclosure" },
];

type ProductGroupDoc = Doc<"productGroups">;
type ProductDoc = Doc<"products">;

export interface ResolverProductCard {
    graceSku: string;
    itemName: string;
    category?: string;
    family?: string | null;
    capacity?: string | null;
    capacityMl?: number | null;
    color?: string | null;
    applicator?: string | null;
    capColor?: string | null;
    neckThreadSize?: string | null;
    webPrice1pc?: number | null;
    webPrice12pc?: number | null;
    caseQuantity?: number | null;
    stockStatus?: string | null;
    slug?: string;
}

export interface ResolverQueryParse {
    family: string | null;
    capacityMl: number | null;
    color: string | null;
    neckThreadSize: string | null;
    category: string | null;
    applicatorValues: string[];
    applicatorBucket: string | null;
    tokens: string[];
}

export interface ResolvedProductGroup {
    groupId: ProductGroupDoc["_id"];
    slug: string;
    displayName: string;
    family: string;
    capacity: string | null;
    capacityMl: number | null;
    color: string | null;
    category: string;
    neckThreadSize: string | null;
    applicatorTypes: string[];
    primaryGraceSku: string | null;
    primaryWebsiteSku: string | null;
    variantCount: number;
    score: number;
    confidence: number;
    matchReasons: string[];
}

export interface ResolveProductRequestResult {
    query: {
        raw: string;
        normalized: string;
        parsed: ResolverQueryParse;
    };
    resolutionMode: "exact_group" | "ranked_groups" | "variant_fallback" | "no_match";
    confidence: number;
    bestGroup: ResolvedProductGroup | null;
    groups: ResolvedProductGroup[];
    representativeVariants: ResolverProductCard[];
    bestGroupVariants: ResolverProductCard[];
}

export interface ResolveProductRequestArgs {
    searchTerm: string;
    familyLimit?: string;
    categoryLimit?: string;
    applicatorFilter?: string;
    limit?: number;
}

export function normalizeApplicatorValue(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return APPLICATOR_VALUE_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export function normalizeSearchTerm(term: string): string {
    let t = term.toLowerCase();

    // Thick perfume oils should bias toward dabber / reducer / apothecary formats,
    // not rollers. We keep these terms as packaging cues instead of mapping them
    // to roll-on.
    if (/\b(thick oil|perfume oil|body oil|attar|oud)\b/i.test(t)) {
        t = t.replace(/\b(thick oil|perfume oil|body oil|attar|oud)\b/gi, "apothecary reducer dropper");
    }
    if (/\b(fine mist|cologne|body spray|fragrance spray)\b/i.test(t)) {
        t = t.replace(/\b(fine mist|cologne|body spray|fragrance spray)\b/gi, "sprayer");
    }
    if (/\bbeard oil\b/i.test(t)) {
        t = t.replace(/\bbeard oil\b/gi, "dropper reducer");
    }
    if (/\b(wedding favor|sample|prototype)\b/i.test(t)) {
        t = t.replace(/\b(wedding favor|sample|prototype)\b/gi, "vial");
    }

    return t
        .replace(/\broll[- ]?on\b/gi, "roller")
        .replace(/\broll[- ]?on\s*bottle\b/gi, "roller bottle")
        .replace(/\bsplash[- ]?on\b/gi, "reducer")
        .replace(/\bsplash\s*bottle\b/gi, "reducer bottle")
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

function normalizeSearchText(rawValue: string): string {
    return rawValue
        .toLowerCase()
        .replace(/(\d+)\s*ml\b/g, "$1ml")
        .replace(/\broll[\s-]?on\b/g, "roll-on")
        .replace(/[^a-z0-9-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenizeSearchText(rawValue: string): string[] {
    const stopWords = new Set([
        "a",
        "an",
        "and",
        "bottle",
        "bottles",
        "browse",
        "can",
        "find",
        "for",
        "me",
        "open",
        "please",
        "show",
        "take",
        "the",
        "to",
        "you",
        "with",
    ]);

    return normalizeSearchText(rawValue)
        .split(" ")
        .filter((token) => token && !stopWords.has(token));
}

function buildProductCard(product: ProductDoc, slug?: string): ResolverProductCard {
    return {
        graceSku: product.graceSku,
        itemName: product.itemName,
        category: product.category,
        family: product.family,
        capacity: product.capacity,
        capacityMl: product.capacityMl,
        color: product.color,
        applicator: product.applicator,
        capColor: product.capColor,
        neckThreadSize: product.neckThreadSize,
        webPrice1pc: product.webPrice1pc,
        webPrice12pc: product.webPrice12pc,
        caseQuantity: product.caseQuantity,
        stockStatus: product.stockStatus,
        slug,
    };
}

function extractQueryParse(args: ResolveProductRequestArgs): ResolverQueryParse {
    const rawLower = args.searchTerm.toLowerCase();
    const normalized = normalizeSearchTerm(args.searchTerm);

    const family = args.familyLimit
        ?? KNOWN_FAMILIES.find((candidate) => rawLower.includes(candidate.toLowerCase()))
        ?? null;

    const capacityMatch = args.searchTerm.match(/\b(\d+)\s*ml\b/i);
    const capacityMl = capacityMatch ? parseInt(capacityMatch[1], 10) : null;

    let color: string | null = null;
    const colorEntries = Object.entries(COLOR_ALIASES).sort((a, b) => b[0].length - a[0].length);
    for (const [token, canonical] of colorEntries) {
        if (rawLower.includes(token)) {
            color = canonical;
            break;
        }
    }

    const threadMatch = args.searchTerm.match(/\b(\d{2}-\d{3})\b/);
    const neckThreadSize = threadMatch?.[1] ?? null;

    let category = args.categoryLimit ?? null;
    if (!category) {
        if (/\b(atomizer|atomiser)\b/i.test(args.searchTerm)) category = "Metal Atomizer";
        else if (/\b(jar|cream jar)\b/i.test(args.searchTerm)) category = "Specialty";
        else if (/\b(component|closure|cap|sprayer|dropper|reducer|pump|fitment)\b/i.test(args.searchTerm)) category = "Component";
        else if (/\b(aluminum|aluminium)\b/i.test(args.searchTerm)) category = "Aluminum Bottle";
        else if (/\b(plastic bottle)\b/i.test(args.searchTerm)) category = "Plastic Bottle";
        else category = "Glass Bottle";
    }

    const allowedApplicators = new Set<string>();
    let applicatorBucket: string | null = null;

    if (args.applicatorFilter) {
        for (const value of args.applicatorFilter.split(",")) {
            const normalizedValue = normalizeApplicatorValue(value);
            if (normalizedValue) {
                allowedApplicators.add(normalizedValue);
                applicatorBucket = applicatorBucket ?? APPLICATOR_BUCKETS[normalizedValue] ?? null;
            }
        }
    } else {
        for (const hint of APPLICATOR_QUERY_HINTS) {
            if (hint.pattern.test(args.searchTerm)) {
                for (const value of hint.values) {
                    allowedApplicators.add(value);
                }
                applicatorBucket = hint.bucket;
                break;
            }
        }
    }

    return {
        family,
        capacityMl,
        color,
        neckThreadSize,
        category,
        applicatorValues: [...allowedApplicators],
        applicatorBucket,
        tokens: tokenizeSearchText(normalized),
    };
}

function groupMatchesApplicator(group: ProductGroupDoc, parsed: ResolverQueryParse): boolean {
    if (parsed.applicatorValues.length === 0) return true;
    const normalizedApplicators = (group.applicatorTypes ?? [])
        .map((value) => normalizeApplicatorValue(value))
        .filter((value): value is string => Boolean(value));

    return normalizedApplicators.some((value) => parsed.applicatorValues.includes(value));
}

function canonicalizeColor(color: string | null | undefined): string | null {
    if (!color) return null;
    return COLOR_ALIASES[color.toLowerCase()] ?? color;
}

function computeGroupScore(
    group: ProductGroupDoc,
    parsed: ResolverQueryParse,
    normalizedQuery: string
): { score: number; confidence: number; matchReasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    const normalizedDisplay = normalizeSearchText(group.displayName);
    const haystack = normalizeSearchText(
        [
            group.displayName,
            group.family,
            group.capacity,
            group.color,
            group.neckThreadSize,
            ...(group.applicatorTypes ?? []),
            group.groupDescription ?? "",
            group.slug,
        ]
            .filter(Boolean)
            .join(" ")
    );

    if (normalizedDisplay === normalizeSearchText(normalizedQuery)) {
        score += 60;
        reasons.push("exact display-name match");
    } else if (normalizedDisplay.includes(normalizeSearchText(normalizedQuery))) {
        score += 35;
        reasons.push("display-name contains query");
    }

    if (parsed.family && group.family === parsed.family) {
        score += 24;
        reasons.push("family match");
    }
    if (parsed.capacityMl != null && group.capacityMl === parsed.capacityMl) {
        score += 22;
        reasons.push("capacity match");
    }
    if (parsed.color && canonicalizeColor(group.color) === parsed.color) {
        score += 16;
        reasons.push("color match");
    }
    if (parsed.neckThreadSize && group.neckThreadSize === parsed.neckThreadSize) {
        score += 14;
        reasons.push("thread match");
    }
    if (parsed.category && group.category === parsed.category) {
        score += 10;
        reasons.push("category match");
    }
    if (parsed.applicatorValues.length > 0 && groupMatchesApplicator(group, parsed)) {
        score += 20;
        reasons.push("applicator match");
    }

    const tokenMatches = parsed.tokens.filter((token) => haystack.includes(token)).length;
    if (parsed.tokens.length > 0) {
        const coverage = tokenMatches / parsed.tokens.length;
        score += Math.round(coverage * 20);
        if (coverage >= 0.8) reasons.push("high token coverage");
        else if (coverage >= 0.5) reasons.push("partial token coverage");
    }

    const confidence = Math.max(0, Math.min(1, score / 100));
    return { score, confidence, matchReasons: reasons };
}

function mapGroup(group: ProductGroupDoc, score: number, confidence: number, matchReasons: string[]): ResolvedProductGroup {
    return {
        groupId: group._id,
        slug: group.slug,
        displayName: group.displayName,
        family: group.family,
        capacity: group.capacity,
        capacityMl: group.capacityMl,
        color: group.color,
        category: group.category,
        neckThreadSize: group.neckThreadSize,
        applicatorTypes: group.applicatorTypes ?? [],
        primaryGraceSku: group.primaryGraceSku ?? null,
        primaryWebsiteSku: group.primaryWebsiteSku ?? null,
        variantCount: group.variantCount,
        score,
        confidence,
        matchReasons,
    };
}

function sharesParsedIdentity(
    candidate: ResolvedProductGroup,
    best: ResolvedProductGroup,
    parsed: ResolverQueryParse
): boolean {
    if (candidate.family !== best.family) return false;
    if (parsed.capacityMl != null && candidate.capacityMl !== best.capacityMl) return false;
    if (parsed.color && canonicalizeColor(candidate.color) !== canonicalizeColor(best.color)) return false;
    return true;
}

function buildRepresentativeVariants(
    groups: ResolvedProductGroup[],
    variantsByGroup: Map<string, ProductDoc[]>,
    limit: number
): ResolverProductCard[] {
    const cards: ResolverProductCard[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
        const variants = variantsByGroup.get(group.slug) ?? [];
        const bestVariant = variants[0];
        if (!bestVariant || seen.has(bestVariant.graceSku)) continue;
        cards.push(buildProductCard(bestVariant, group.slug));
        seen.add(bestVariant.graceSku);
        if (cards.length >= limit) break;
    }

    return cards;
}

export async function resolveProductRequestCore(
    ctx: QueryCtx,
    args: ResolveProductRequestArgs
): Promise<ResolveProductRequestResult> {
    const rawQuery = args.searchTerm.trim();
    const normalizedQuery = normalizeSearchTerm(rawQuery);
    const parsed = extractQueryParse(args);
    const searchQuery = parsed.tokens.join(" ") || normalizedQuery || rawQuery;
    const takeCount = Math.max(10, Math.min(args.limit ?? 12, 25));
    const candidateMap = new Map<string, ProductGroupDoc>();

    if (rawQuery.includes("-") && !rawQuery.includes(" ")) {
        const exactSlug = await ctx.db
            .query("productGroups")
            .withIndex("by_slug", (q) => q.eq("slug", rawQuery))
            .first();
        if (exactSlug) {
            candidateMap.set(exactSlug.slug, exactSlug);
        }
    }

    if (normalizedQuery) {
        const search = ctx.db.query("productGroups").withSearchIndex("search_displayName", (q) => {
            let sq = q.search("displayName", searchQuery);
            if (args.categoryLimit) sq = sq.eq("category", args.categoryLimit);
            if (args.familyLimit) sq = sq.eq("family", args.familyLimit);
            return sq;
        });
        const displayHits = await search.take(40);
        for (const hit of displayHits) candidateMap.set(hit.slug, hit);
    }

    if (parsed.family) {
        const family = parsed.family;
        const familyHits = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", family))
            .collect();
        for (const hit of familyHits) candidateMap.set(hit.slug, hit);
    }

    if (candidateMap.size < 8 && normalizedQuery) {
        const descHits = await ctx.db
            .query("productGroups")
            .withSearchIndex("search_groupDescription", (q) => {
                let sq = q.search("groupDescription", searchQuery);
                if (args.categoryLimit) sq = sq.eq("category", args.categoryLimit);
                if (args.familyLimit) sq = sq.eq("family", args.familyLimit);
                return sq;
            })
            .take(20);
        for (const hit of descHits) candidateMap.set(hit.slug, hit);
    }

    if (candidateMap.size === 0 && parsed.applicatorValues.length > 0) {
        const allGroups = await ctx.db.query("productGroups").collect();
        for (const group of allGroups) {
            if (groupMatchesApplicator(group, parsed)) {
                candidateMap.set(group.slug, group);
            }
        }
    }

    let candidates = [...candidateMap.values()];

    if (parsed.category) {
        const glassBottleCandidates = candidates.filter((candidate) => candidate.category === parsed.category);
        if (glassBottleCandidates.length > 0) candidates = glassBottleCandidates;
    }

    if (parsed.family) {
        const familyFiltered = candidates.filter((candidate) => candidate.family === parsed.family);
        if (familyFiltered.length > 0) candidates = familyFiltered;
    }

    if (parsed.capacityMl != null) {
        const capacityFiltered = candidates.filter((candidate) => candidate.capacityMl === parsed.capacityMl);
        if (capacityFiltered.length > 0) candidates = capacityFiltered;
    }

    if (parsed.color) {
        const colorFiltered = candidates.filter((candidate) => canonicalizeColor(candidate.color) === parsed.color);
        if (colorFiltered.length > 0) candidates = colorFiltered;
    }

    if (parsed.neckThreadSize) {
        const threadFiltered = candidates.filter((candidate) => candidate.neckThreadSize === parsed.neckThreadSize);
        if (threadFiltered.length > 0) candidates = threadFiltered;
    }

    if (parsed.applicatorValues.length > 0) {
        const applicatorFiltered = candidates.filter((candidate) => groupMatchesApplicator(candidate, parsed));
        if (applicatorFiltered.length > 0) candidates = applicatorFiltered;
    }

    const scored = candidates
        .map((candidate) => {
            const { score, confidence, matchReasons } = computeGroupScore(candidate, parsed, normalizedQuery || rawQuery);
            return {
                group: candidate,
                score,
                confidence,
                matchReasons,
            };
        })
        .filter((entry) => entry.score > 0 || rawQuery.length === 0)
        .sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.group.displayName.localeCompare(b.group.displayName));

    const topGroups = scored.slice(0, takeCount);
    const groupCards = topGroups.map((entry) => mapGroup(entry.group, entry.score, entry.confidence, entry.matchReasons));
    const bestGroup = groupCards[0] ?? null;
    const secondGroup = groupCards[1] ?? null;
    const queryIsStructurallySpecific =
        parsed.capacityMl != null ||
        Boolean(parsed.color) ||
        Boolean(parsed.neckThreadSize) ||
        parsed.applicatorValues.length > 0;
    const sharedIdentityCluster = bestGroup && queryIsStructurallySpecific
        ? groupCards.filter((group) => sharesParsedIdentity(group, bestGroup, parsed))
        : [];
    const exactEnough = Boolean(
        bestGroup &&
        (
            (
                bestGroup.confidence >= 0.64 &&
                (!secondGroup || bestGroup.score - secondGroup.score >= 4)
            ) ||
            sharedIdentityCluster.length > 1
        )
    );

    const groupsToHydrate = exactEnough && bestGroup ? [bestGroup, ...groupCards.slice(1, 4)] : groupCards.slice(0, 6);
    const variantsByGroup = new Map<string, ProductDoc[]>();

    for (const group of groupsToHydrate) {
        const variants = await ctx.db
            .query("products")
            .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group.groupId))
            .collect();
        variantsByGroup.set(group.slug, variants);
    }

    const bestGroupVariants = bestGroup
        ? (variantsByGroup.get(bestGroup.slug) ?? []).map((variant) => buildProductCard(variant, bestGroup.slug))
        : [];

    const representativeVariants = buildRepresentativeVariants(groupCards, variantsByGroup, Math.min(takeCount, 8));

    return {
        query: {
            raw: rawQuery,
            normalized: normalizedQuery,
            parsed,
        },
        resolutionMode: bestGroup
            ? exactEnough
                ? "exact_group"
                : "ranked_groups"
            : "no_match",
        confidence: bestGroup?.confidence ?? 0,
        bestGroup,
        groups: groupCards,
        representativeVariants,
        bestGroupVariants,
    };
}
