import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import {
    filterGroupedComponentsByFitmentRule,
    normalizeComponentsByType,
    selectBestFitmentRule,
} from "./componentUtils";
import { buildSystemPrompt, VOICE_MODE_ADDENDUM } from "./gracePrompt";
import {
    GRACE_TOOLS,
    MODEL_TEXT,
    MODEL_VOICE,
    MAX_TOOL_ITERATIONS_TEXT,
    MAX_TOOL_ITERATIONS_VOICE,
} from "./graceToolDefs";
import {
    normalizeSearchTerm,
    normalizeApplicatorValue,
    detectCatalogColor,
    detectApplicatorIntent,
    dedupeCatalogResults,
    scoreCatalogResult,
    buildSearchCatalogToolResult,
    buildBottleComponentsToolResult,
} from "./graceSearchUtils";

// ─────────────────────────────────────────────────────────────────────────────
// GRACE AI TOOL QUERIES
// These queries are called by the askGrace action as Claude tool executions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AI Tool: Search Catalog
 * Grace uses this to find specific bottles or closures based on a user's text prompt.
 */
export const searchCatalog = query({
    args: {
        searchTerm: v.string(),
        categoryLimit: v.optional(v.string()),
        familyLimit: v.optional(v.string()),
        applicatorFilter: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const normalizedTerm = normalizeSearchTerm(args.searchTerm);
        const searchTermToUse = normalizedTerm || args.searchTerm;
        const termLower = searchTermToUse.toLowerCase();
        const detectedColor = detectCatalogColor(termLower);
        const applicatorIntent = detectApplicatorIntent(searchTermToUse);

        // When an applicator filter is active, take more results before filtering
        const takeCount = args.applicatorFilter ? 100 : 25;

        let q = ctx.db.query("products").withSearchIndex("search_itemName", (q) =>
            q.search("itemName", searchTermToUse)
        );
        if (args.categoryLimit) {
            q = q.filter((q) => q.eq(q.field("category"), args.categoryLimit));
        }
        if (args.familyLimit) {
            q = q.filter((q) => q.eq(q.field("family"), args.familyLimit));
        }
        let results = await q.take(takeCount);

        // Fallback or Expanded search:
        // 1. If few results
        // 2. OR if user explicitly asked for "30ml roll-on", we want to proactively include the 28ml cylinders too.
        const isRollOnSearch = /\b(roll|roller|ball)\b/i.test(args.searchTerm);
        const is30mlSearch = /\b30\s*ml\b/i.test(args.searchTerm);

        if (results.length < 5 || (isRollOnSearch && is30mlSearch)) {
            const fallbackQ = ctx.db
                .query("products")
                .withSearchIndex("search_itemName", (q) => q.search("itemName", "roller"));
            let fallback = await fallbackQ.take(80);

            if (args.familyLimit) {
                fallback = fallback.filter((p) => p.family === args.familyLimit);
            }
            if (args.categoryLimit) {
                fallback = fallback.filter((p) => p.category === args.categoryLimit);
            }

            // Intelligent size matching:
            // If they ask for 30ml roll-on, we also want to surface the 28ml Cylinder variants.
            const targetCapacities = new Set<number>();
            const capacityMatch = args.searchTerm.match(/\b(\d+)\s*ml\b/i);
            if (capacityMatch) {
                const ml = parseInt(capacityMatch[1]);
                targetCapacities.add(ml);
                if (ml === 30 && isRollOnSearch) targetCapacities.add(28); // Proactively include 28ml
            }

            if (targetCapacities.size > 0) {
                const byCapacity = fallback.filter((p) => p.capacityMl !== null && targetCapacities.has(p.capacityMl));
                if (byCapacity.length > 0) fallback = byCapacity;
            }

            const seen = new Set(results.map((r) => r.graceSku));
            for (const p of fallback) {
                if (!seen.has(p.graceSku) && results.length < takeCount) {
                    results = [...results, p];
                    seen.add(p.graceSku);
                }
            }
        }

        // ── Structured fallback via productGroups ──────────────────────────
        // Text search on itemName is weak for structured queries like "100ml circle".
        // Parse family name and capacity from the search term and cross-check
        // productGroups so we never miss an obvious match.
        const KNOWN_FAMILIES = [
            "Apothecary", "Atomizer", "Bell", "Boston Round", "Circle", "Cylinder",
            "Diamond", "Diva", "Elegant", "Empire", "Grace", "Rectangle", "Round",
            "Sleek", "Slim", "Tulip", "Vial",
        ];
        const detectedFamily = args.familyLimit
            ?? KNOWN_FAMILIES.find((f) => termLower.includes(f.toLowerCase()))
            ?? null;
        const capMatch = args.searchTerm.match(/\b(\d+)\s*ml\b/i);
        const detectedCapMl = capMatch ? parseInt(capMatch[1]) : null;
        let structuredResults: typeof results = [];

        if (detectedFamily || detectedCapMl !== null || detectedColor) {
            let groupHits = detectedFamily
                ? await ctx.db.query("productGroups").withIndex("by_family", (q) => q.eq("family", detectedFamily)).collect()
                : await ctx.db.query("productGroups").collect();
            if (detectedCapMl) {
                groupHits = groupHits.filter((g) => g.capacityMl === detectedCapMl);
            }
            if (detectedColor) {
                groupHits = groupHits.filter((g) => g.color === detectedColor);
            }
            if (groupHits.length > 0) {
                groupHits = groupHits.sort((a, b) => {
                    const scoreA =
                        (detectedFamily && a.family === detectedFamily ? 3 : 0) +
                        (detectedCapMl !== null && a.capacityMl === detectedCapMl ? 3 : 0) +
                        (detectedColor && a.color === detectedColor ? 4 : 0);
                    const scoreB =
                        (detectedFamily && b.family === detectedFamily ? 3 : 0) +
                        (detectedCapMl !== null && b.capacityMl === detectedCapMl ? 3 : 0) +
                        (detectedColor && b.color === detectedColor ? 4 : 0);
                    return scoreB - scoreA;
                });
                for (const group of groupHits) {
                    let variants = await ctx.db.query("products")
                        .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
                        .take(8);
                    if (applicatorIntent === "rollon") {
                        variants = variants.filter((v) => /(roller|roll)/i.test(v.applicator ?? ""));
                    } else if (applicatorIntent === "spray") {
                        variants = variants.filter((v) => /(spray|atomizer|mist)/i.test(v.applicator ?? ""));
                    } else if (applicatorIntent === "dropper") {
                        variants = variants.filter((v) => /dropper/i.test(v.applicator ?? ""));
                    } else if (applicatorIntent === "pump") {
                        variants = variants.filter((v) => /pump/i.test(v.applicator ?? ""));
                    } else if (applicatorIntent === "reducer") {
                        variants = variants.filter((v) => /reducer/i.test(v.applicator ?? ""));
                    }
                    for (const v of variants) {
                        structuredResults.push(v);
                    }
                }
            }
        }

        // ── Description-based search via productGroups.groupDescription ────
        // Catches natural-language queries ("beard oil bottle", "sample vial
        // for trade shows") that don't match itemName but appear in the
        // SEO-rich group descriptions.
        if (results.length < takeCount) {
            const descHits = await ctx.db
                .query("productGroups")
                .withSearchIndex("search_groupDescription", (q) => {
                    let sq = q.search("groupDescription", searchTermToUse);
                    if (args.categoryLimit) sq = sq.eq("category", args.categoryLimit);
                    if (args.familyLimit) sq = sq.eq("family", args.familyLimit);
                    return sq;
                })
                .take(10);
            if (descHits.length > 0) {
                const existingSkus = new Set(results.map((r) => r.graceSku));
                for (const group of descHits) {
                    const variants = await ctx.db.query("products")
                        .withIndex("by_productGroupId", (q) => q.eq("productGroupId", group._id))
                        .take(3);
                    for (const v of variants) {
                        if (!existingSkus.has(v.graceSku) && results.length < takeCount) {
                            results.push(v);
                            existingSkus.add(v.graceSku);
                        }
                    }
                }
            }
        }

        // Apply applicator filter in JS after fetching (Convex search index doesn't support OR filters)
        if (args.applicatorFilter) {
            const allowed = new Set(
                args.applicatorFilter
                    .split(",")
                    .map((s) => normalizeApplicatorValue(s))
                    .filter((s): s is string => Boolean(s))
                    .map((s) => s.toLowerCase())
            );
            results = results
                .filter((p) => {
                    const normalizedApplicator = normalizeApplicatorValue(p.applicator);
                    return normalizedApplicator ? allowed.has(normalizedApplicator.toLowerCase()) : false;
                })
                .slice(0, 25);
        }

        results = dedupeCatalogResults([...structuredResults, ...results])
            .sort((a, b) =>
                scoreCatalogResult(b, {
                    termLower,
                    detectedFamily,
                    detectedCapMl,
                    detectedColor,
                    applicatorIntent,
                }) -
                scoreCatalogResult(a, {
                    termLower,
                    detectedFamily,
                    detectedCapMl,
                    detectedColor,
                    applicatorIntent,
                })
            )
            .slice(0, args.applicatorFilter ? 25 : takeCount);

        // Return a trimmed version — components arrays are large and waste tokens.
        // Normalize capacity strings: remove internal spaces ("9 ml" → "9ml")
        const enrichedResults = await Promise.all(
            results.map(async (p) => {
                let slug: string | undefined = undefined;
                if (p.productGroupId) {
                    const group = await ctx.db.get(p.productGroupId);
                    if (group) slug = group.slug;
                }
                return {
                    graceSku: p.graceSku,
                    itemName: p.itemName,
                    category: p.category,
                    family: p.family,
                    capacity: p.capacity ? p.capacity.replace(/\s*(ml|oz)\s*/gi, (_, u) => u.toLowerCase()) : p.capacity,
                    capacityMl: p.capacityMl,
                    color: p.color,
                    applicator: p.applicator,
                    capColor: p.capColor,
                    neckThreadSize: p.neckThreadSize,
                    webPrice1pc: p.webPrice1pc,
                    webPrice12pc: p.webPrice12pc,
                    caseQuantity: p.caseQuantity,
                    stockStatus: p.stockStatus,
                    slug,
                };
            })
        );
        return enrichedResults;
    },
});

/**
 * AI Tool: Live Catalog Stats
 * Returns real-time counts — Grace MUST call this instead of guessing.
 */
export const getCatalogStats = query({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").collect();
        let totalVariants = 0;
        const familyCounts: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};
        const collectionCounts: Record<string, number> = {};
        for (const g of groups) {
            const n = g.variantCount ?? 1;
            totalVariants += n;
            if (g.family) familyCounts[g.family] = (familyCounts[g.family] || 0) + n;
            categoryCounts[g.category] = (categoryCounts[g.category] || 0) + n;
            if (g.bottleCollection)
                collectionCounts[g.bottleCollection] = (collectionCounts[g.bottleCollection] || 0) + n;
        }
        return { totalVariants, totalGroups: groups.length, familyCounts, categoryCounts, collectionCounts };
    },
});

/**
 * AI Tool: Family Overview
 *
 * Returns aggregated sizes, colours, threads, applicators, and price ranges
 * for an entire bottle family.
 */
export const getFamilyOverview = query({
    args: { family: v.string() },
    handler: async (ctx, args) => {
        const groups = await ctx.db
            .query("productGroups")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();

        if (groups.length === 0) return null;

        const normCap = (cap: string | null | undefined): string | null => {
            if (!cap) return null;
            return cap.replace(/\s*(ml|oz)\s*/gi, (_, u: string) => u.toLowerCase());
        };

        const sizes = new Map<string, { ml: number | null; count: number }>();
        const colors = new Set<string>();
        const threads = new Set<string>();
        const applicators = new Set<string>();
        let minPrice = Infinity;
        let maxPrice = 0;
        let totalVariants = 0;

        for (const g of groups) {
            if (g.category !== "Glass Bottle" && groups.some(x => x.category === "Glass Bottle")) continue;

            totalVariants += g.variantCount ?? 1;

            const cap = normCap(g.capacity);
            if (cap) {
                const existing = sizes.get(cap);
                if (existing) {
                    existing.count += g.variantCount ?? 1;
                } else {
                    sizes.set(cap, { ml: g.capacityMl, count: g.variantCount ?? 1 });
                }
            }

            if (g.color) colors.add(g.color);
            if (g.neckThreadSize) threads.add(g.neckThreadSize);

            if (Array.isArray(g.applicatorTypes)) {
                for (const a of g.applicatorTypes) {
                    const normalizedApplicator = normalizeApplicatorValue(a);
                    if (normalizedApplicator) applicators.add(normalizedApplicator);
                }
            }

            if (g.priceRangeMin && g.priceRangeMin > 0) minPrice = Math.min(minPrice, g.priceRangeMin);
            if (g.priceRangeMax && g.priceRangeMax > 0) maxPrice = Math.max(maxPrice, g.priceRangeMax);
        }

        return {
            family: args.family,
            totalVariants,
            sizes: [...sizes.entries()]
                .map(([label, info]) => ({ label, ml: info.ml, variantCount: info.count }))
                .sort((a, b) => (a.ml ?? 0) - (b.ml ?? 0)),
            colors: [...colors].sort(),
            threadSizes: [...threads].sort(),
            applicatorTypes: [...applicators].sort(),
            priceRange: { min: minPrice === Infinity ? null : minPrice, max: maxPrice || null },
        };
    },
});

/**
 * AI Tool: Get Bottle Components
 * Returns the full grouped components for a specific bottle — the definitive
 * compatibility data. Resolves by graceSku or websiteSku.
 */
export const getBottleComponents = query({
    args: { bottleSku: v.string() },
    handler: async (ctx, args) => {
        const sku = args.bottleSku.trim();
        const bottle =
            (await ctx.db.query("products").withIndex("by_graceSku", (q) => q.eq("graceSku", sku)).first()) ??
            (await ctx.db.query("products").withIndex("by_websiteSku", (q) => q.eq("websiteSku", sku)).first());

        if (!bottle) return null;

        const grouped = normalizeComponentsByType(bottle.components);
        const bottleThread = (bottle.neckThreadSize ?? "").toString().trim();
        const fitmentRules = bottleThread
            ? await ctx.db
                .query("fitments")
                .withIndex("by_threadSize", (q) => q.eq("threadSize", bottleThread))
                .collect()
            : [];
        const matchedFitmentRule = selectBestFitmentRule(fitmentRules, bottle);
        const reconciled = filterGroupedComponentsByFitmentRule(grouped, matchedFitmentRule);
        const summary: Record<string, Array<{ graceSku: string; itemName: string; webPrice1pc: number | null; capColor: string | null; stockStatus: string | null }>> = {};
        for (const [type, items] of Object.entries(reconciled)) {
            summary[type] = items.map((item) => ({
                graceSku: item.graceSku,
                itemName: item.itemName,
                webPrice1pc: item.webPrice1pc,
                capColor: item.capColor,
                stockStatus: item.stockStatus,
            }));
        }

        return {
            bottle: {
                graceSku: bottle.graceSku,
                itemName: bottle.itemName,
                family: bottle.family,
                capacity: bottle.capacity
                    ? bottle.capacity.replace(/\s*(ml|oz)\s*/gi, (_, u: string) => u.toLowerCase())
                    : bottle.capacity,
                color: bottle.color,
                neckThreadSize: bottle.neckThreadSize,
                caseQuantity: bottle.caseQuantity,
                webPrice1pc: bottle.webPrice1pc,
                webPrice12pc: bottle.webPrice12pc,
            },
            componentTypes: Object.keys(summary),
            totalComponents: Object.values(summary).reduce((s, arr) => s + arr.length, 0),
            components: summary,
        };
    },
});

/**
 * AI Tool: Check Compatibility
 * Returns the fitment matrix for a given thread size.
 */
export const checkCompatibility = query({
    args: { threadSize: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("fitments")
            .withIndex("by_threadSize", (q) => q.eq("threadSize", args.threadSize))
            .collect();
    },
});

/**
 * Fetches the graceKnowledge entries used to build Grace's system prompt.
 */
export const getCoreKnowledge = query({
    args: {},
    handler: async (ctx) => {
        const coreCategories = [
            "identity", "voice", "emotional_intelligence", "sales_methodology",
            "navigation", "response_templates", "autonomous_behaviours",
            "escalation", "brand_differentiators", "product_knowledge",
        ];
        const entries: Array<{ title: string; content: string; category: string }> = [];
        for (const category of coreCategories) {
            const items = await ctx.db
                .query("graceKnowledge")
                .withIndex("by_category", (q) => q.eq("category", category))
                .collect();
            entries.push(
                ...items.map((i) => ({ title: i.title, content: i.content, category: i.category }))
            );
        }
        return entries;
    },
});

/**
 * Lightweight knowledge fetch for voice mode — only loads what's needed
 * for concise 2-sentence responses.
 */
export const getVoiceKnowledge = query({
    args: {},
    handler: async (ctx) => {
        const voiceCategories = ["identity", "voice", "product_knowledge"];
        const entries: Array<{ title: string; content: string; category: string }> = [];
        for (const category of voiceCategories) {
            const items = await ctx.db
                .query("graceKnowledge")
                .withIndex("by_category", (q) => q.eq("category", category))
                .collect();
            entries.push(
                ...items.map((i) => ({ title: i.title, content: i.content, category: i.category }))
            );
        }
        return entries;
    },
});

/**
 * Returns the fully-built system prompt for Grace.
 */
export const getGraceInstructions = query({
    args: { voiceMode: v.optional(v.boolean()) },
    handler: async (_ctx, args) => {
        let prompt = buildSystemPrompt();
        if (args.voiceMode) {
            prompt += VOICE_MODE_ADDENDUM;
        }
        return prompt;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH UTILITY (run once after catalog updates)
// ─────────────────────────────────────────────────────────────────────────────

export const patchKnowledgeEntries = mutation({
    args: {},
    handler: async (ctx) => {
        const patched: string[] = [];
        const catalogEntry = await ctx.db
            .query("graceKnowledge")
            .withSearchIndex("search_content", (q) => q.search("content", "3,179 products"))
            .first();
        if (catalogEntry) {
            await ctx.db.patch(catalogEntry._id, {
                title: "Best Bottles Catalog Overview — What Grace Needs to Know",
                content: `Best Bottles carries thousands of glass and packaging products organised into four primary categories. Grace should ALWAYS call getCatalogStats() to get the live product count — never rely on a number stored in this knowledge entry, as it will go stale.

GLASS BOTTLES (primary product line):
12 distinct bottle families: Cylinder, Elegant, Circle, Diva, Empire, Slim, Boston Round, Sleek, Diamond, Royal, Round, Square. Available in clear, frosted, and amber glass. Capacities from 5ml sample sizes through 500ml production volumes. All glass meets Type III cosmetic/pharmaceutical standards. UV-resistant amber glass is available across all major families.

ALUMINUM BOTTLES:
Lightweight alternative for travel-size and eco-conscious brands.

COMPONENTS (closures, applicators):
Fine mist sprayers (glass and plastic), glass and plastic droppers, roll-on applicators (metal ball, glass ball, plastic ball), lotion pumps, caps (shiny gold, matte gold, shiny silver, matte silver, shiny black, matte black, antique gold), reducers / orifice reducers.

SPECIALTY:
Atomisers, perfume travel sets, specialty dispensing systems.

HOW TO ANSWER "HOW MANY PRODUCTS DO YOU HAVE?":
Call getCatalogStats(). Report totalVariants and totalGroups. Do not invent or recall a number from memory.`,
                tags: ["catalog", "product overview", "glass bottles", "aluminum", "components", "families", "live count"],
                source: "grace_constitution_v3_patched",
            });
            patched.push("catalog overview (removed hardcoded 3,179 count)");
        }
        return {
            success: true,
            patched,
            message: patched.length === 0
                ? "No stale entries found — knowledge base is already current."
                : `Patched ${patched.length} entries: ${patched.join(", ")}`,
        };
    },
});

/**
 * Recalibrate Grace's knowledge after major catalog/nav restructures.
 */
export const recalibrateKnowledge = mutation({
    args: {
        pruneDuplicates: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const pruneDuplicates = args.pruneDuplicates ?? true;

        const categories = [
            "identity", "voice", "emotional_intelligence", "sales_methodology",
            "navigation", "response_templates", "autonomous_behaviours",
            "escalation", "brand_differentiators", "product_knowledge",
        ];

        const dedupeDeleted: Array<{ category: string; title: string; deleted: number }> = [];

        if (pruneDuplicates) {
            for (const category of categories) {
                const items = await ctx.db
                    .query("graceKnowledge")
                    .withIndex("by_category", (q) => q.eq("category", category))
                    .collect();

                const byTitle = new Map<string, typeof items>();
                for (const item of items) {
                    const key = item.title.trim().toLowerCase();
                    const arr = byTitle.get(key) ?? [];
                    arr.push(item);
                    byTitle.set(key, arr);
                }

                for (const [titleKey, arr] of byTitle.entries()) {
                    if (arr.length <= 1) continue;
                    const sorted = [...arr].sort((a, b) => b._creationTime - a._creationTime);
                    const toDelete = sorted.slice(1);
                    for (const d of toDelete) {
                        await ctx.db.delete(d._id);
                    }
                    dedupeDeleted.push({
                        category,
                        title: titleKey,
                        deleted: toDelete.length,
                    });
                }
            }
        }

        const groups = await ctx.db.query("productGroups").collect();
        const totalGroups = groups.length;
        const totalVariants = groups.reduce((sum, g) => sum + (g.variantCount ?? 0), 0);

        const familySet = new Set<string>();
        const categoryCounts: Record<string, number> = {};
        const componentTypeSet = new Set<string>();

        for (const g of groups) {
            categoryCounts[g.category] = (categoryCounts[g.category] ?? 0) + (g.variantCount ?? 0);
            if (g.family) familySet.add(g.family);
            if (g.category === "Component") {
                const baseType = g.displayName.split(" — ")[0]?.trim();
                if (baseType) componentTypeSet.add(baseType);
            }
        }

        const families = [...familySet].sort();
        const componentTypes = [...componentTypeSet].sort();

        const productKnowledgeItems = await ctx.db
            .query("graceKnowledge")
            .withIndex("by_category", (q) => q.eq("category", "product_knowledge"))
            .collect();

        const overviewEntries = productKnowledgeItems.filter((k) =>
            /catalog overview/i.test(k.title)
        );

        const liveOverview = `Best Bottles catalog snapshot (live):
- Product groups: ${totalGroups}
- Total variants: ${totalVariants}

Current organization:
- Primary browse axes: Applicator Type, Design Family, Capacity
- Categories present: ${Object.keys(categoryCounts).sort().join(", ")}
- Design families in catalog: ${families.join(", ")}
- Component groups are split by type + thread size for precise fitment discovery.
- Component type examples: ${componentTypes.join(", ")}

Operational guidance for Grace:
- ALWAYS call getCatalogStats() for counts (never quote a memorized number).
- For specific product discovery, call searchCatalog with applicatorFilter when applicable.
- For fitment questions on a specific bottle, call getBottleComponents first.
- For thread-only compatibility questions, call checkCompatibility.
- Never promise SKU availability or fitment from memory.`;

        let patchedOverviewId: string | null = null;
        if (overviewEntries.length > 0) {
            const newest = [...overviewEntries].sort((a, b) => b._creationTime - a._creationTime)[0];
            await ctx.db.patch(newest._id, {
                title: "Best Bottles Catalog Overview — Live Structure",
                content: liveOverview,
                tags: [
                    "catalog", "live-count", "applicator-first",
                    "design-family", "capacity", "components", "fitment",
                ],
                source: "grace_recalibration_live",
            });
            patchedOverviewId = String(newest._id);
        } else {
            const id = await ctx.db.insert("graceKnowledge", {
                category: "product_knowledge",
                title: "Best Bottles Catalog Overview — Live Structure",
                content: liveOverview,
                tags: [
                    "catalog", "live-count", "applicator-first",
                    "design-family", "capacity", "components", "fitment",
                ],
                priority: 1,
                source: "grace_recalibration_live",
            });
            patchedOverviewId = String(id);
        }

        return {
            success: true,
            totalGroups,
            totalVariants,
            dedupeDeletedCount: dedupeDeleted.reduce((s, x) => s + x.deleted, 0),
            dedupeDeleted,
            patchedOverviewId,
            message: "Grace knowledge recalibration complete.",
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// GRACE AI CORE ACTION — Claude Sonnet 4.6 with agentic tool use
// ─────────────────────────────────────────────────────────────────────────────

export const askGrace = action({
    args: {
        messages: v.array(
            v.object({
                role: v.union(v.literal("user"), v.literal("assistant")),
                content: v.string(),
            })
        ),
        voiceMode: v.optional(v.boolean()),
        pageContextBlock: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<string> => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return "Grace is not yet configured. Please contact the team to enable the AI concierge.";
        }

        const isVoice = !!args.voiceMode;
        const model = isVoice ? MODEL_VOICE : MODEL_TEXT;
        const maxIterations = isVoice ? MAX_TOOL_ITERATIONS_VOICE : MAX_TOOL_ITERATIONS_TEXT;
        const maxTokens = isVoice ? 200 : 1024;

        const anthropic = new Anthropic({ apiKey });

        // ── 1. Build system prompt (self-contained constitution, no DB fetch) ──
        let systemPrompt = buildSystemPrompt();
        if (args.pageContextBlock) {
            systemPrompt = args.pageContextBlock + "\n\n" + systemPrompt;
        }
        if (isVoice) {
            systemPrompt += VOICE_MODE_ADDENDUM;
        }

        // ── 2. Set up the mutable message list for the agentic loop ──────────
        const messages: Anthropic.MessageParam[] = args.messages.map((m) => ({
            role: m.role,
            content: m.content,
        }));

        // ── 3. Agentic tool-use loop ──────────────────────────────────────────

        async function callAnthropic(retries = 2): Promise<Anthropic.Message> {
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    return await anthropic.messages.create({
                        model,
                        max_tokens: maxTokens,
                        system: systemPrompt,
                        tools: GRACE_TOOLS,
                        messages,
                    });
                } catch (e: unknown) {
                    const err = e as { status?: number; error?: { status?: number } };
                    const status = err?.status ?? err?.error?.status;
                    if ((status === 429 || status === 529) && attempt < retries) {
                        const wait = Math.min(2000 * Math.pow(2, attempt), 8000);
                        await new Promise((r) => setTimeout(r, wait));
                        continue;
                    }
                    throw e;
                }
            }
            throw new Error("Exhausted retries");
        }

        try {
            for (let iteration = 0; iteration < maxIterations; iteration++) {
                const response = await callAnthropic();

                // ── Final text response ───────────────────────────────────────
                if (response.stop_reason === "end_turn") {
                    const textBlock = response.content.find((b) => b.type === "text");
                    return textBlock && textBlock.type === "text"
                        ? textBlock.text
                        : "I wasn't able to formulate a response. Please try rephrasing your question.";
                }

                // ── Tool use — execute each tool and feed results back ────────
                if (response.stop_reason === "tool_use") {
                    messages.push({ role: "assistant", content: response.content });

                    const toolResults: Anthropic.ToolResultBlockParam[] = [];

                    for (const block of response.content) {
                        if (block.type !== "tool_use") continue;

                        let result: string;
                        try {
                            if (block.name === "searchCatalog") {
                                const input = block.input as {
                                    searchTerm: string;
                                    categoryLimit?: string;
                                    familyLimit?: string;
                                    applicatorFilter?: string;
                                };
                                const data = await ctx.runQuery(api.grace.searchCatalog, {
                                    searchTerm: input.searchTerm,
                                    categoryLimit: input.categoryLimit,
                                    familyLimit: input.familyLimit,
                                    applicatorFilter: input.applicatorFilter,
                                });
                                result = data.length > 0
                                    ? buildSearchCatalogToolResult(input, data)
                                    : "No products found for that search. Try a broader term.";
                            } else if (block.name === "getFamilyOverview") {
                                const input = block.input as { family: string };
                                const data = await ctx.runQuery(api.grace.getFamilyOverview, {
                                    family: input.family,
                                });
                                result = data
                                    ? JSON.stringify(data, null, 2)
                                    : `No products found for the "${input.family}" family. Check the family name spelling.`;
                            } else if (block.name === "getBottleComponents") {
                                const input = block.input as { bottleSku: string };
                                const data = await ctx.runQuery(api.grace.getBottleComponents, {
                                    bottleSku: input.bottleSku,
                                });
                                result = data
                                    ? buildBottleComponentsToolResult(data)
                                    : `No bottle found with SKU "${input.bottleSku}". Try searchCatalog first to find the correct SKU.`;
                            } else if (block.name === "checkCompatibility") {
                                const input = block.input as { threadSize: string };
                                const data = await ctx.runQuery(api.grace.checkCompatibility, {
                                    threadSize: input.threadSize,
                                });
                                result = data.length > 0
                                    ? JSON.stringify(data, null, 2)
                                    : `No fitment data found for thread size ${input.threadSize}.`;
                            } else if (block.name === "getCatalogStats") {
                                const data = await ctx.runQuery(api.grace.getCatalogStats, {});
                                result = JSON.stringify(data, null, 2);
                            } else {
                                result = `Unknown tool: ${block.name}`;
                            }
                        } catch (e) {
                            result = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
                        }

                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: block.id,
                            content: result,
                        });
                    }

                    messages.push({ role: "user", content: toolResults });
                    continue;
                }

                break;
            }
        } catch (e: unknown) {
            const err = e as { status?: number; error?: { status?: number } };
            const status = err?.status ?? err?.error?.status;
            if (status === 429 || status === 529) {
                return "I'm experiencing a brief moment of high demand. Could you try again in just a few seconds? I'll be right here.";
            }
            console.error("Grace AI error:", err);
            return "I ran into an unexpected issue. Please try again in a moment, or reach out to our team at sales@nematinternational.com if this persists.";
        }

        return "I ran into an issue processing your request. Please try again in a moment.";
    },
});
