"use client";

import { useEffect, useState } from "react";
import { CLERK_ENABLED } from "@/lib/clerk";

/**
 * Lightweight auth check that works ANYWHERE in the tree, not just under
 * ClerkProvider. Used by the global drawer to decide whether to surface
 * the "Expand to workspace" affordance.
 *
 * Behavior:
 *  - CLERK_ENABLED=false (dev) → returns `true` so dev work isn't blocked.
 *  - CLERK_ENABLED=true → checks for Clerk's `__session` cookie (set on
 *    successful sign-in). Re-checks on focus / cookie change so the icon
 *    appears immediately after sign-in without a page refresh.
 *
 * For pages already inside ClerkProvider, prefer Clerk's `useAuth()`.
 * This hook is the cross-tree fallback.
 */
export function useIsAuthenticated(): boolean {
    const [authed, setAuthed] = useState<boolean>(() => {
        if (!CLERK_ENABLED) return true;
        if (typeof document === "undefined") return false;
        return readSessionCookie();
    });

    useEffect(() => {
        if (!CLERK_ENABLED) return;
        const refresh = () => setAuthed(readSessionCookie());
        // Re-check when the tab regains focus (covers sign-in in another tab).
        window.addEventListener("focus", refresh);
        // Re-check periodically while the page is open.
        const t = setInterval(refresh, 30_000);
        return () => {
            window.removeEventListener("focus", refresh);
            clearInterval(t);
        };
    }, []);

    return authed;
}

function readSessionCookie(): boolean {
    if (typeof document === "undefined") return false;
    const cookies = document.cookie.split(";");
    for (const c of cookies) {
        const [rawName, rawValue] = c.split("=");
        const name = rawName?.trim();
        if (name === "__session" && rawValue && rawValue.trim().length > 0) {
            return true;
        }
    }
    return false;
}
