"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { CLERK_ENABLED } from "@/lib/clerk";
import GraceWorkspaceClient from "./GraceWorkspaceClient";
import GraceWorkspaceGate from "./GraceWorkspaceGate";

// Clerk's `useAuth` is dynamically imported so we don't try to evaluate it
// in environments where Clerk isn't enabled (CLERK_ENABLED=false). When
// disabled, the workspace falls open for dev so the team can still iterate.
const ClerkAuthGate = dynamic(() => import("./_clerkAuthGate"), { ssr: false });

export default function GraceWorkspaceRouter() {
    const searchParams = useSearchParams();
    // Dev preview: visit /grace-workspace?gate=preview to see the locked
    // landing without flipping CLERK_ENABLED. Useful for design review.
    if (searchParams?.get("gate") === "preview") {
        return <GraceWorkspaceGate />;
    }

    // Dev / staging without Clerk → workspace is open. The gate exists for
    // production where CLERK_ENABLED=true, but we don't want to lock dev out.
    if (!CLERK_ENABLED) {
        return <GraceWorkspaceClient />;
    }
    return (
        <ClerkAuthGate
            authed={<GraceWorkspaceClient />}
            unauthed={<GraceWorkspaceGate />}
        />
    );
}
