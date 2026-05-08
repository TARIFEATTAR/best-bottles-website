import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CLERK_ENABLED } from "@/lib/clerk";

const isPortalRoute = createRouteMatcher(["/portal(.*)", "/api/portal(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    if (!CLERK_ENABLED) {
        return NextResponse.next();
    }

    if (isPortalRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and static files
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
