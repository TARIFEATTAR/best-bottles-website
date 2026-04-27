export const CLERK_ENABLED = process.env.NEXT_PUBLIC_CLERK_ENABLED === "true";

export function isClerkAuthPath(pathname: string | null): boolean {
    if (!pathname) return false;
    return (
        pathname.startsWith("/portal")
        || pathname.startsWith("/sign-in")
        // Workspace is gated to authenticated B2B accounts; Clerk must initialize
        // here so `useAuth()` works for the gate check.
        || pathname.startsWith("/grace-workspace")
    );
}
