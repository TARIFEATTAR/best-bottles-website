import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // ── Product Groups (Phase 1) ─────────────────────────────────────────────
    // ~230 parent groups. Each group = unique (family + capacityMl + color).
    // All 2,354 individual SKU variants link back to their parent group.
    productGroups: defineTable({
        slug: v.string(),                                    // e.g. "cylinder-9ml-clear" — stable URL key
        displayName: v.string(),                             // e.g. "Cylinder 9ml Clear" — for search
        family: v.string(),
        capacity: v.union(v.string(), v.null()),             // human-readable e.g. "9 ml"
        capacityMl: v.union(v.number(), v.null()),
        color: v.union(v.string(), v.null()),
        category: v.string(),
        bottleCollection: v.union(v.string(), v.null()),
        neckThreadSize: v.union(v.string(), v.null()),       // representative thread size for fitment
        variantCount: v.number(),
        priceRangeMin: v.union(v.number(), v.null()),        // lowest webPrice1pc in group
        priceRangeMax: v.union(v.number(), v.null()),        // highest webPrice1pc in group
        // Filled in later phases:
        shopifyProductId: v.optional(v.union(v.string(), v.null())),
        sanitySlug: v.optional(v.union(v.string(), v.null())),
        heroImageUrl: v.optional(v.union(v.string(), v.null())),
    })
        .index("by_slug", ["slug"])
        .index("by_family", ["family"])
        .index("by_category", ["category"])
        .index("by_collection", ["bottleCollection"])
        .searchIndex("search_displayName", {
            searchField: "displayName",
            filterFields: ["category", "family"],
        }),

    products: defineTable({
        // ── Identity — 3-identifier system ─────────────────────────
        // productId: Immutable anchor. Assigned once in master sheet.
        // Format: BB-{PREFIX}-000-{NNNN}  e.g. BB-GB-000-0001
        // Never changes — use this to trace any record back to source.
        // Optional so existing Convex docs without it still validate.
        productId: v.optional(v.union(v.string(), v.null())),
        websiteSku: v.string(),
        graceSku: v.string(),

        // ── Classification ──────────────────────────────────────────
        category: v.string(),
        family: v.union(v.string(), v.null()),
        shape: v.union(v.string(), v.null()),
        color: v.union(v.string(), v.null()),
        capacity: v.union(v.string(), v.null()),
        capacityMl: v.union(v.number(), v.null()),
        capacityOz: v.union(v.number(), v.null()),

        // ── Applicator & Cap ────────────────────────────────────────
        applicator: v.union(v.string(), v.null()),
        capColor: v.union(v.string(), v.null()),
        trimColor: v.union(v.string(), v.null()),
        capStyle: v.union(v.string(), v.null()),
        ballMaterial: v.optional(v.union(v.string(), v.null())),

        // ── Physical dimensions ─────────────────────────────────────
        neckThreadSize: v.union(v.string(), v.null()),
        heightWithCap: v.union(v.string(), v.null()),
        heightWithoutCap: v.union(v.string(), v.null()),
        diameter: v.union(v.string(), v.null()),
        bottleWeightG: v.union(v.number(), v.null()),
        caseQuantity: v.union(v.number(), v.null()),

        // ── Pricing ─────────────────────────────────────────────────
        qbPrice: v.union(v.number(), v.null()),
        webPrice1pc: v.union(v.number(), v.null()),
        webPrice10pc: v.union(v.number(), v.null()),
        webPrice12pc: v.union(v.number(), v.null()),

        // ── Content & Status ────────────────────────────────────────
        stockStatus: v.union(v.string(), v.null()),
        itemName: v.string(),
        itemDescription: v.union(v.string(), v.null()),
        imageUrl: v.optional(v.union(v.string(), v.null())),
        productUrl: v.union(v.string(), v.null()),
        dataGrade: v.union(v.string(), v.null()),
        bottleCollection: v.union(v.string(), v.null()),

        // ── Fitment ─────────────────────────────────────────────────
        fitmentStatus: v.union(v.string(), v.null()),
        components: v.any(), // Array of compatible component SKUs by type
        graceDescription: v.union(v.string(), v.null()),

        // ── Meta ────────────────────────────────────────────────────
        verified: v.boolean(),
        importSource: v.optional(v.string()), // e.g. "master_sheet_v1.4_component_tab"

        // ── Phase 1: Product Grouping ────────────────────────────────
        productGroupId: v.optional(v.id("productGroups")), // FK → productGroups
    })
        .index("by_productId", ["productId"])         // Primary stable anchor
        .index("by_websiteSku", ["websiteSku"])       // BestBottles.com lookup
        .index("by_graceSku", ["graceSku"])           // Grace internal lookup
        .index("by_category", ["category"])
        .index("by_family", ["family"])
        .index("by_neckThreadSize", ["neckThreadSize"])
        .index("by_productGroupId", ["productGroupId"]) // Used by getProductGroup to avoid full table scan
        .searchIndex("search_itemName", {
            searchField: "itemName",
            filterFields: ["category", "family"],
        }),

    fitments: defineTable({
        threadSize: v.string(),
        bottleName: v.string(),
        bottleCode: v.union(v.string(), v.null()),
        familyHint: v.union(v.string(), v.null()),
        capacityMl: v.union(v.number(), v.null()),
        components: v.any(),
    })
        .index("by_threadSize", ["threadSize"])
        .index("by_bottleName", ["bottleName"]),

    // -------------------------------------------------------------------------
    // GRACE AI KNOWLEDGE BASE
    // -------------------------------------------------------------------------

    graceKnowledge: defineTable({
        category: v.string(),
        title: v.string(),
        content: v.string(),
        tags: v.array(v.string()),
        relatedSkus: v.optional(v.array(v.string())),
        priority: v.union(v.number(), v.string()),
        source: v.optional(v.string()),
        // Legacy fields from previous schema version (will be cleared after re-seed)
        createdAt: v.optional(v.number()),
        updatedAt: v.optional(v.number()),
        summary: v.optional(v.string()),
        relevantSegments: v.optional(v.array(v.string())),
    })
        .index("by_category", ["category"])
        .index("by_priority", ["priority"])
        .searchIndex("search_content", {
            searchField: "content",
            filterFields: ["category", "priority"],
        }),

    gracePersonas: defineTable({
        segment: v.string(),
        displayName: v.string(),
        description: v.string(),
        typicalOrderSize: v.string(),
        pricePoint: v.string(),
        preferredFamilies: v.array(v.string()),
        keyMotivations: v.array(v.string()),
        commonQuestions: v.array(v.string()),
        toneGuidance: v.string(),
    })
        .index("by_segment", ["segment"]),

    graceObjections: defineTable({
        category: v.string(),
        objection: v.string(),
        response: v.string(),
        followUpQuestion: v.optional(v.string()),
        relatedPersonas: v.optional(v.array(v.string())),
    })
        .index("by_category", ["category"])
        .searchIndex("search_objections", {
            searchField: "objection",
            filterFields: ["category"],
        }),

    graceTrends: defineTable({
        category: v.string(),
        trendStage: v.string(),
        title: v.string(),
        summary: v.string(),
        relevantFamilies: v.array(v.string()),
        relevantCapacities: v.optional(v.array(v.string())),
        customerImplication: v.string(),
        graceTalkingPoint: v.string(),
    })
        .index("by_category", ["category"])
        .index("by_stage", ["trendStage"]),

    graceStatistics: defineTable({
        category: v.string(),
        stat: v.string(),
        context: v.string(),
        description: v.string(),
        verified: v.boolean(),
        citationNote: v.optional(v.string()),
    })
        .index("by_category", ["category"])
        .searchIndex("search_stats", {
            searchField: "description",
            filterFields: ["category"],
        }),

    // -------------------------------------------------------------------------
    // GRACE AI CONVERSATION ENGINE
    // -------------------------------------------------------------------------

    conversations: defineTable({
        sessionId: v.string(),
        userId: v.optional(v.string()),
        detectedPersona: v.optional(v.string()),
        startedAt: v.number(),
        lastMessageAt: v.number(),
    })
        .index("by_session", ["sessionId"])
        .index("by_user", ["userId"]),

    messages: defineTable({
        conversationId: v.id("conversations"),
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        toolCallsUsed: v.optional(v.array(v.string())),
        createdAt: v.number(),
    })
        .index("by_conversation", ["conversationId"]),

    // -------------------------------------------------------------------------
    // FORM SUBMISSIONS (sample requests, quotes, contact)
    // -------------------------------------------------------------------------

    formSubmissions: defineTable({
        formType: v.union(
            v.literal("sample"),
            v.literal("quote"),
            v.literal("contact"),
            v.literal("newsletter")
        ),
        name: v.optional(v.string()),
        email: v.string(),
        company: v.optional(v.string()),
        phone: v.optional(v.string()),
        message: v.optional(v.string()),
        products: v.optional(v.string()),
        quantities: v.optional(v.string()),
        source: v.optional(v.string()),
        submittedAt: v.number(),
    })
        .index("by_type", ["formType"])
        .index("by_email", ["email"]),
});
