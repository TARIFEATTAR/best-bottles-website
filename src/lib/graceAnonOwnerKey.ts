/**
 * Anonymous owner key — gives non-authenticated users a stable identity for
 * Grace shortlists and uploads, without requiring Clerk auth.
 *
 * The key is a UUIDv4-like string persisted in localStorage. It scopes
 * shortlist + upload records to the device. When a user authenticates later
 * (Phase 7+), records can be migrated to their `clerkOrgId` server-side.
 *
 * The key is never exposed in shareable URLs — those use opaque
 * `shareToken` values minted server-side per shortlist.
 */

const STORAGE_KEY = "grace.anonOwnerKey";

function genKey(): string {
    // crypto.randomUUID is widely available in modern browsers; fall back to
    // a Math.random hex string in the rare case it's missing.
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `anon-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getAnonOwnerKey(): string {
    if (typeof window === "undefined") return "anon-ssr";
    try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing) return existing;
        const fresh = genKey();
        localStorage.setItem(STORAGE_KEY, fresh);
        return fresh;
    } catch {
        // localStorage blocked (private mode, ITP) — fall through to a
        // session-only key so the user still gets working shortlists this turn.
        return genKey();
    }
}
