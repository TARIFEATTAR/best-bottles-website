"use client";

import type { ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Thin wrapper that picks `authed` or `unauthed` based on Clerk's `useAuth`.
 * Lives in its own file so it can be lazy-loaded — only evaluated when
 * CLERK_ENABLED is true (avoids a hard dependency on Clerk in dev).
 *
 * `isLoaded` guard prevents a flash of the gate before Clerk hydrates.
 */
export default function ClerkAuthGate({
    authed,
    unauthed,
}: {
    authed: ReactNode;
    unauthed: ReactNode;
}) {
    const { isLoaded, isSignedIn } = useAuth();
    if (!isLoaded) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-bone">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-gold/30 border-t-muted-gold" />
            </div>
        );
    }
    return <>{isSignedIn ? authed : unauthed}</>;
}
