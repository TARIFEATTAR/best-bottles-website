import "server-only";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

let convexClient: ConvexHttpClient | null = null;

function getConvex() {
    if (!convexClient) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
        convexClient = new ConvexHttpClient(url);
    }
    return convexClient;
}

export async function getPortalViewer() {
    const { userId, orgId } = await auth();
    return {
        clerkUserId: userId ?? null,
        clerkOrgId: orgId ?? null,
    };
}

export async function requirePortalViewer() {
    const viewer = await getPortalViewer();
    if (!viewer.clerkUserId) throw new Error("Unauthenticated");
    if (!viewer.clerkOrgId) throw new Error("No active organization selected.");
    return {
        clerkUserId: viewer.clerkUserId,
        clerkOrgId: viewer.clerkOrgId,
    };
}

export async function getPortalShellData() {
    const viewer = await getPortalViewer();
    if (!viewer.clerkOrgId) {
        return {
            viewer,
            account: null,
            inTransitCount: 0,
            draftCount: 0,
        };
    }

    const shell = await getConvex().query(api.portal.getShellData, {
        clerkOrgId: viewer.clerkOrgId,
    });

    return {
        viewer,
        ...shell,
    };
}

export async function getPortalDashboardData() {
    const viewer = await requirePortalViewer();
    const dashboard = await getConvex().query(api.portal.getDashboardData, {
        clerkOrgId: viewer.clerkOrgId,
    });
    return { viewer, ...dashboard };
}

export async function getPortalOrdersData() {
    const viewer = await requirePortalViewer();
    const orders = await getConvex().query(api.portal.listOrdersByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    return { viewer, orders };
}

export async function getPortalAccountData() {
    const viewer = await requirePortalViewer();
    const account = await getConvex().query(api.portal.getAccountByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    const orders = await getConvex().query(api.portal.listOrdersByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    return { viewer, account, orders };
}

export async function getPortalDraftsData() {
    const viewer = await requirePortalViewer();
    const drafts = await getConvex().query(api.portal.listDraftsByOrg, {
        clerkOrgId: viewer.clerkOrgId,
    });
    return { viewer, drafts };
}

export async function getPortalGraceWorkspace(projectId?: string) {
    const viewer = await requirePortalViewer();
    const workspace = await getConvex().query(api.portal.getGraceWorkspaceByOrg, {
        clerkOrgId: viewer.clerkOrgId,
        projectId: (projectId ?? undefined) as never,
    });
    return { viewer, ...workspace };
}

export async function createPortalDraftForViewer(name?: string) {
    const viewer = await requirePortalViewer();
    return await getConvex().mutation(api.portal.createDraft, {
        clerkOrgId: viewer.clerkOrgId,
        name,
    });
}

export async function createPortalDraftFromOrderForViewer(orderId: string) {
    const viewer = await requirePortalViewer();
    return await getConvex().mutation(api.portal.createDraftFromOrder, {
        clerkOrgId: viewer.clerkOrgId,
        orderId,
    });
}

export async function createGraceProjectForViewer(name?: string) {
    const viewer = await requirePortalViewer();
    return await getConvex().mutation(api.portal.createGraceProject, {
        clerkOrgId: viewer.clerkOrgId,
        name,
    });
}

export async function askGraceForViewerProject(projectId: string, message: string) {
    const viewer = await requirePortalViewer();

    const workspace = await getConvex().query(api.portal.getGraceWorkspaceByOrg, {
        clerkOrgId: viewer.clerkOrgId,
        projectId: projectId as never,
    });

    if (!workspace.activeProject) {
        throw new Error("Grace project not found.");
    }

    const history = [
        ...workspace.messages.map((entry) => ({
            role: entry.role,
            content: entry.content,
        })),
        {
            role: "user" as const,
            content: message,
        },
    ];

    const response = await getConvex().action(api.grace.respond, {
        messages: history,
        voiceMode: false,
        channel: "portal",
        sessionMetadata: {
            sessionId: workspace.activeProject.convexConversationId
                ? `portal:${viewer.clerkOrgId}:${projectId}`
                : `portal:${viewer.clerkOrgId}:${projectId}`,
            entrypoint: "grace-workspace",
            pageType: "portal",
        },
    });

    await getConvex().mutation(api.portal.saveGraceChatTurn, {
        clerkOrgId: viewer.clerkOrgId,
        clerkUserId: viewer.clerkUserId,
        projectId: projectId as never,
        userMessage: message,
        assistantMessage: response.assistantText,
        toolCallsUsed: response.toolCallsUsed,
        intent: response.classification.intent ?? undefined,
        productFamily: response.classification.productFamily ?? undefined,
        capacityMl: response.classification.capacityMl ?? undefined,
        color: response.classification.color ?? undefined,
        applicator: response.classification.applicator ?? undefined,
        resolvedGroupSlug: response.classification.resolvedGroupSlug ?? undefined,
        resolutionConfidence: response.classification.resolutionConfidence ?? undefined,
        latencyMs: response.latencyMs,
        provider: response.classification.provider,
        voiceOrText: response.classification.voiceOrText,
    });

    return { assistantMessage: response.assistantText };
}
