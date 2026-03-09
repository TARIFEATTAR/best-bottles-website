import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

function orderTotal(order: Doc<"portalOrders">): number | null {
    if (typeof order.totalAmount === "number") return order.totalAmount;

    let total = 0;
    let hasPrices = false;
    for (const item of order.lineItems) {
        if (typeof item.unitPrice === "number") {
            total += item.unitPrice * item.quantity;
            hasPrices = true;
        }
    }

    return hasPrices ? total : null;
}

function orderItemCount(order: Doc<"portalOrders">): number {
    return order.lineItems.reduce((sum, item) => sum + item.quantity, 0);
}

function draftTotal(draft: Doc<"portalDrafts">): number | null {
    if (typeof draft.totalAmount === "number") return draft.totalAmount;

    let total = 0;
    let hasPrices = false;
    for (const item of draft.lineItems) {
        if (typeof item.unitPrice === "number") {
            total += item.unitPrice * item.quantity;
            hasPrices = true;
        }
    }

    return hasPrices ? total : null;
}

function sortByNewest<T extends { updatedAt?: number; orderDate?: number; createdAt?: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
        const aTime = a.updatedAt ?? a.orderDate ?? a.createdAt ?? 0;
        const bTime = b.updatedAt ?? b.orderDate ?? b.createdAt ?? 0;
        return bTime - aTime;
    });
}

export const getShellData = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const account = await ctx.db
            .query("portalAccounts")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();

        const orders = await ctx.db
            .query("portalOrders")
            .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .collect();

        const drafts = await ctx.db
            .query("portalDrafts")
            .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .collect();

        return {
            account,
            inTransitCount: orders.filter((order) => order.status === "in_transit").length,
            draftCount: drafts.filter((draft) => draft.status !== "submitted").length,
        };
    },
});

export const getAccountByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("portalAccounts")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();
    },
});

export const getDashboardData = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const account = await ctx.db
            .query("portalAccounts")
            .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();

        const orders = sortByNewest(
            await ctx.db
                .query("portalOrders")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        const drafts = sortByNewest(
            await ctx.db
                .query("portalDrafts")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

        const activeOrders = orders.filter(
            (order) => order.status === "processing" || order.status === "in_transit"
        );
        const deliveredOrders = orders.filter((order) => order.status === "delivered");
        const ytdSpend = deliveredOrders.reduce(
            (sum, order) => sum + (order.orderDate >= startOfYear ? orderTotal(order) ?? 0 : 0),
            0
        );
        const unitsInFlight = activeOrders.reduce((sum, order) => sum + orderItemCount(order), 0);

        const recentOrders = deliveredOrders.slice(0, 3).map((order) => ({
            _id: order._id,
            orderId: order.orderId,
            orderDate: order.orderDate,
            totalAmount: orderTotal(order),
            itemCount: orderItemCount(order),
            primaryLineItem: order.lineItems[0] ?? null,
        }));

        const seenSkus = new Set<string>();
        const quickReorder = deliveredOrders
            .flatMap((order) =>
                order.lineItems.map((lineItem) => ({
                    sku: lineItem.sku,
                    description: lineItem.description,
                    quantity: lineItem.quantity,
                    orderDate: order.orderDate,
                }))
            )
            .filter((lineItem) => {
                if (seenSkus.has(lineItem.sku)) return false;
                seenSkus.add(lineItem.sku);
                return true;
            })
            .slice(0, 3);

        return {
            account,
            stats: {
                ytdSpend,
                activeOrderCount: activeOrders.length,
                inTransitCount: orders.filter((order) => order.status === "in_transit").length,
                unitsInFlight,
                availableCredit: account ? Math.max(100_000 - ytdSpend, 0) : null,
            },
            activeOrders: activeOrders.slice(0, 4).map((order) => ({
                _id: order._id,
                orderId: order.orderId,
                status: order.status,
                estimatedDelivery: order.estimatedDelivery ?? null,
                totalAmount: orderTotal(order),
                itemCount: orderItemCount(order),
                primaryLineItem: order.lineItems[0] ?? null,
            })),
            recentOrders,
            drafts: drafts.slice(0, 3).map((draft) => ({
                _id: draft._id,
                name: draft.name,
                status: draft.status,
                updatedAt: draft.updatedAt,
                lineItemCount: draft.lineItems.length,
                totalAmount: draftTotal(draft),
            })),
            quickReorder,
        };
    },
});

export const listOrdersByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const orders = sortByNewest(
            await ctx.db
                .query("portalOrders")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        return orders.map((order) => ({
            _id: order._id,
            orderId: order.orderId,
            status: order.status,
            orderDate: order.orderDate,
            estimatedDelivery: order.estimatedDelivery ?? null,
            carrier: order.carrier ?? null,
            trackingNumber: order.trackingNumber ?? null,
            totalAmount: orderTotal(order),
            itemCount: orderItemCount(order),
            primaryLineItem: order.lineItems[0] ?? null,
            lineItems: order.lineItems,
        }));
    },
});

export const listDraftsByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const drafts = sortByNewest(
            await ctx.db
                .query("portalDrafts")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        return drafts.map((draft) => ({
            _id: draft._id,
            name: draft.name,
            status: draft.status,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
            totalAmount: draftTotal(draft),
            lineItems: draft.lineItems,
            lineItemCount: draft.lineItems.length,
        }));
    },
});

export const createDraft = mutation({
    args: {
        clerkOrgId: v.string(),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const draftId = await ctx.db.insert("portalDrafts", {
            clerkOrgId: args.clerkOrgId,
            name: args.name?.trim() || `Draft ${new Date(now).toLocaleDateString("en-US")}`,
            status: "draft",
            lineItems: [],
            totalAmount: 0,
            createdAt: now,
            updatedAt: now,
        });

        return { draftId };
    },
});

export const createDraftFromOrder = mutation({
    args: {
        clerkOrgId: v.string(),
        orderId: v.string(),
    },
    handler: async (ctx, args) => {
        const sourceOrder = await ctx.db
            .query("portalOrders")
            .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
            .unique();

        if (!sourceOrder || sourceOrder.clerkOrgId !== args.clerkOrgId) {
            throw new Error("Order not found for this organization.");
        }

        const now = Date.now();
        const draftId = await ctx.db.insert("portalDrafts", {
            clerkOrgId: args.clerkOrgId,
            name: `Reorder ${sourceOrder.orderId}`,
            status: "draft",
            lineItems: sourceOrder.lineItems,
            totalAmount: orderTotal(sourceOrder) ?? 0,
            createdAt: now,
            updatedAt: now,
        });

        return { draftId };
    },
});

export const listGraceProjectsByOrg = query({
    args: { clerkOrgId: v.string() },
    handler: async (ctx, args) => {
        const projects = sortByNewest(
            await ctx.db
                .query("graceProjects")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        return projects.map((project) => ({
            _id: project._id,
            name: project.name,
            updatedAt: project.updatedAt,
            createdAt: project.createdAt,
            savedBottleCount: project.savedBottles.length,
            savedBottles: project.savedBottles,
            convexConversationId: project.convexConversationId ?? null,
        }));
    },
});

export const getGraceWorkspaceByOrg = query({
    args: {
        clerkOrgId: v.string(),
        projectId: v.optional(v.id("graceProjects")),
    },
    handler: async (ctx, args) => {
        const projects = sortByNewest(
            await ctx.db
                .query("graceProjects")
                .withIndex("by_orgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
                .collect()
        );

        const activeProject =
            (args.projectId
                ? projects.find((project) => project._id === args.projectId)
                : projects[0]) ?? null;

        const messages =
            activeProject?.convexConversationId
                ? await ctx.db
                    .query("messages")
                    .withIndex("by_conversation", (q) =>
                        q.eq("conversationId", activeProject.convexConversationId as Id<"conversations">)
                    )
                    .collect()
                : [];

        return {
            projects: projects.map((project) => ({
                _id: project._id,
                name: project.name,
                updatedAt: project.updatedAt,
                createdAt: project.createdAt,
                savedBottleCount: project.savedBottles.length,
                savedBottles: project.savedBottles,
                convexConversationId: project.convexConversationId ?? null,
            })),
            activeProject: activeProject
                ? {
                    _id: activeProject._id,
                    name: activeProject.name,
                    updatedAt: activeProject.updatedAt,
                    createdAt: activeProject.createdAt,
                    savedBottleCount: activeProject.savedBottles.length,
                    savedBottles: activeProject.savedBottles,
                    convexConversationId: activeProject.convexConversationId ?? null,
                }
                : null,
            messages: sortByNewest(messages.map((message) => ({ ...message, updatedAt: message.createdAt })))
                .reverse()
                .map((message) => ({
                    _id: message._id,
                    role: message.role,
                    content: message.content,
                    createdAt: message.createdAt,
                })),
        };
    },
});

export const createGraceProject = mutation({
    args: {
        clerkOrgId: v.string(),
        name: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const projectId = await ctx.db.insert("graceProjects", {
            clerkOrgId: args.clerkOrgId,
            name: args.name?.trim() || `Packaging Project ${new Date(now).toLocaleDateString("en-US")}`,
            savedBottles: [],
            createdAt: now,
            updatedAt: now,
        });

        return { projectId };
    },
});

export const saveGraceChatTurn = mutation({
    args: {
        clerkOrgId: v.string(),
        clerkUserId: v.string(),
        projectId: v.id("graceProjects"),
        userMessage: v.string(),
        assistantMessage: v.string(),
        toolCallsUsed: v.optional(v.array(v.string())),
        intent: v.optional(v.string()),
        productFamily: v.optional(v.string()),
        capacityMl: v.optional(v.number()),
        color: v.optional(v.string()),
        applicator: v.optional(v.string()),
        resolvedGroupSlug: v.optional(v.string()),
        resolutionConfidence: v.optional(v.number()),
        latencyMs: v.optional(v.number()),
        provider: v.optional(v.string()),
        voiceOrText: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const project = await ctx.db.get(args.projectId);
        if (!project || project.clerkOrgId !== args.clerkOrgId) {
            throw new Error("Project not found for this organization.");
        }

        const now = Date.now();
        let conversationId = project.convexConversationId ?? null;

        if (!conversationId) {
            conversationId = await ctx.db.insert("conversations", {
                sessionId: `portal:${args.clerkOrgId}:${args.projectId}`,
                userId: args.clerkUserId,
                channel: "portal",
                entrypoint: "grace-workspace",
                pageType: "portal",
                startedAt: now,
                lastMessageAt: now,
            });
            await ctx.db.patch(project._id, {
                convexConversationId: conversationId,
                updatedAt: now,
            });
        }

        await ctx.db.insert("messages", {
            conversationId,
            role: "user",
            content: args.userMessage,
            intent: args.intent,
            productFamily: args.productFamily,
            capacityMl: args.capacityMl,
            color: args.color,
            applicator: args.applicator,
            resolvedGroupSlug: args.resolvedGroupSlug,
            resolutionConfidence: args.resolutionConfidence,
            provider: args.provider,
            voiceOrText: args.voiceOrText,
            createdAt: now,
        });
        await ctx.db.insert("messages", {
            conversationId,
            role: "assistant",
            content: args.assistantMessage,
            toolCallsUsed: args.toolCallsUsed,
            intent: args.intent,
            productFamily: args.productFamily,
            capacityMl: args.capacityMl,
            color: args.color,
            applicator: args.applicator,
            resolvedGroupSlug: args.resolvedGroupSlug,
            resolutionConfidence: args.resolutionConfidence,
            latencyMs: args.latencyMs,
            provider: args.provider,
            voiceOrText: args.voiceOrText,
            createdAt: now + 1,
        });

        await ctx.db.patch(conversationId, { lastMessageAt: now + 1 });
        await ctx.db.patch(project._id, { updatedAt: now + 1 });

        return { conversationId };
    },
});
