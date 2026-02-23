import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    products: defineTable({
        websiteSku: v.string(),
        graceSku: v.string(),
        category: v.string(),
        family: v.union(v.string(), v.null()),
        shape: v.union(v.string(), v.null()),
        color: v.union(v.string(), v.null()),
        capacity: v.union(v.string(), v.null()),
        capacityMl: v.union(v.number(), v.null()),
        capacityOz: v.union(v.number(), v.null()),
        applicator: v.union(v.string(), v.null()),
        capColor: v.union(v.string(), v.null()),
        trimColor: v.union(v.string(), v.null()),
        capStyle: v.union(v.string(), v.null()),
        neckThreadSize: v.union(v.string(), v.null()),
        heightWithCap: v.union(v.string(), v.null()),
        heightWithoutCap: v.union(v.string(), v.null()),
        diameter: v.union(v.string(), v.null()),
        bottleWeightG: v.union(v.number(), v.null()),
        caseQuantity: v.union(v.number(), v.null()),
        qbPrice: v.union(v.number(), v.null()),
        webPrice1pc: v.union(v.number(), v.null()),
        webPrice10pc: v.union(v.number(), v.null()),
        webPrice12pc: v.union(v.number(), v.null()),
        stockStatus: v.union(v.string(), v.null()),
        itemName: v.string(),
        itemDescription: v.union(v.string(), v.null()),
        productUrl: v.union(v.string(), v.null()),
        dataGrade: v.union(v.string(), v.null()),
        bottleCollection: v.union(v.string(), v.null()),
        fitmentStatus: v.union(v.string(), v.null()),
        components: v.any(),
        graceDescription: v.union(v.string(), v.null()),
        verified: v.boolean(),
    })
        .index("by_graceSku", ["graceSku"])
        .index("by_category", ["category"])
        .index("by_family", ["family"])
        .index("by_neckThreadSize", ["neckThreadSize"])
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
});
