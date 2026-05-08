import { NextRequest, NextResponse } from "next/server";
import { askGraceForViewerProject } from "@/lib/portal/server";

function statusForPortalError(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Unauthenticated") return 401;
    if (message === "No active organization selected.") return 403;
    if (message === "Portal auth is disabled.") return 503;
    return 500;
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as {
            projectId?: string;
            message?: string;
        };

        const projectId = body.projectId?.trim();
        const message = body.message?.trim();

        if (!projectId || !message) {
            return NextResponse.json(
                { error: "Missing projectId or message." },
                { status: 400 }
            );
        }

        const result = await askGraceForViewerProject(projectId, message);
        return NextResponse.json(result);
    } catch (error) {
        const status = statusForPortalError(error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to reach Grace." },
            { status }
        );
    }
}
