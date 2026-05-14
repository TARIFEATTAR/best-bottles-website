"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useUser, useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCart } from "@/components/CartProvider";
import { useGrace } from "@/components/useGrace";
import { CLERK_ENABLED } from "@/lib/clerk";
import { ArrowLeft, Plus } from "./icons";

/**
 * Error boundary scoped to one rail section. Used for the Popular Families
 * strip — a Convex sync failure (function not yet deployed, schema mismatch)
 * should NOT crash the entire workspace shell. We swallow the error, log it
 * for telemetry, and render a minimal "Nothing yet." fallback in its place.
 */
class RailSectionErrorBoundary extends Component<
    { children: ReactNode; fallback: ReactNode },
    { hasError: boolean }
> {
    constructor(props: { children: ReactNode; fallback: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(err: Error, info: ErrorInfo) {
        console.warn("[Grace] PopularFamiliesStrip failed — falling back gracefully:", err.message, info.componentStack);
    }
    render() {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}

const SIDEBAR_W = 256;
const TOPBAR_H = 60;

interface ProjectItem {
    name: string;
    sub: string;
}

interface WorkspaceShellProps {
    children: ReactNode;
    onNewConversation: () => void;
}

type WorkspaceUser = {
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
    primaryEmailAddress?: { emailAddress?: string | null } | null;
} | null | undefined;

type WorkspaceOrganization = {
    id?: string | null;
    name?: string | null;
} | null | undefined;

function relativeTime(updatedAt: number): string {
    const ms = Date.now() - updatedAt;
    const day = 86400000;
    if (ms < day) return "today";
    if (ms < 2 * day) return "yesterday";
    if (ms < 7 * day) return `${Math.round(ms / day)} days ago`;
    if (ms < 30 * day) return `${Math.round(ms / (7 * day))} weeks ago`;
    return `${Math.round(ms / 30 / day)} months ago`;
}

export default function WorkspaceShell(props: WorkspaceShellProps) {
    if (CLERK_ENABLED) return <WorkspaceShellWithClerk {...props} />;
    return <WorkspaceShellView {...props} user={null} organization={null} />;
}

function WorkspaceShellWithClerk(props: WorkspaceShellProps) {
    const { user } = useUser();
    const { organization } = useOrganization();
    return <WorkspaceShellView {...props} user={user} organization={organization} />;
}

function WorkspaceShellView({
    children,
    onNewConversation,
    user,
    organization,
}: WorkspaceShellProps & {
    user: WorkspaceUser;
    organization: WorkspaceOrganization;
}) {
    const router = useRouter();
    const { itemCount } = useCart();
    const { conversationActive } = useGrace();

    const clerkOrgId = organization?.id ?? null;
    const account = useQuery(
        api.portal.getAccountByOrg,
        clerkOrgId ? { clerkOrgId } : "skip",
    );
    const projects = useQuery(
        api.portal.listGraceProjectsByOrg,
        clerkOrgId ? { clerkOrgId } : "skip",
    );

    const sortedProjects = projects ?? [];
    const activeProject: ProjectItem | null = sortedProjects[0]
        ? { name: sortedProjects[0].name, sub: relativeTime(sortedProjects[0].updatedAt) }
        : null;
    const recentProjects: ProjectItem[] = sortedProjects.slice(1, 4).map((p) => ({
        name: p.name,
        sub: relativeTime(p.updatedAt),
    }));

    // Identity — fall back gracefully when org/account aren't yet wired.
    const orgName = account?.companyName ?? organization?.name ?? null;
    const tierLabel = account?.tier ?? (clerkOrgId ? "Authenticated" : "Signed in");
    const userFullName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ") || (user.primaryEmailAddress?.emailAddress ?? "You")
        : "You";
    const userInitial = (user?.firstName?.[0] ?? user?.primaryEmailAddress?.emailAddress?.[0] ?? "·").toUpperCase();

    return (
        <div
            className="flex h-dvh w-screen overflow-hidden bg-bone text-obsidian font-sans"
        >
            {/* ── Left rail ─────────────────────────────────────── */}
            <aside
                className="hidden md:flex flex-col shrink-0 bg-linen px-3.5 py-[18px]"
                style={{
                    width: SIDEBAR_W,
                    borderRight: "1px solid rgba(212, 197, 169, 0.55)",
                }}
            >
                {/* Brand — clicks back to the home site */}
                <Link
                    href="/"
                    className="flex items-center gap-[9px] rounded-[2px] px-1.5 pb-3.5 pt-1 -mx-1.5 -mt-1 hover:bg-obsidian/[0.03] transition-colors"
                    title="Back to bestbottles.com"
                    aria-label="Back to Best Bottles home"
                >
                    <GraceMark />
                    <div className="leading-none">
                        <div className="font-serif text-[18px] font-medium tracking-[0.04em]">Grace</div>
                        <div className="mt-[3px] text-[9.5px] font-semibold uppercase tracking-[0.18em] text-slate">
                            Best Bottles
                        </div>
                    </div>
                </Link>

                {/* New conversation */}
                <button
                    onClick={onNewConversation}
                    className="flex items-center justify-center gap-1.5 rounded-[2px] px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-obsidian cursor-pointer"
                    style={{
                        background: "rgba(255, 255, 255, 0.7)",
                        border: "1px solid rgba(212, 197, 169, 0.7)",
                        borderBottom: "2px solid var(--color-muted-gold)",
                    }}
                >
                    <Plus size={11} weight="bold" />
                    New conversation
                </button>

                {/* Active */}
                <div className="mt-[18px]">
                    <Eyebrow>Active</Eyebrow>
                    {activeProject ? (
                        <div
                            className="mt-1.5 flex items-center gap-2 rounded-[1px] px-1.5 py-2"
                            style={{
                                background: "rgba(197, 160, 101, 0.08)",
                                borderLeft: "2px solid var(--color-muted-gold)",
                            }}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="font-serif text-[13.5px] font-medium tracking-[0.02em]">
                                    {activeProject.name}
                                </div>
                                <div className="mt-0.5 text-[10px] text-slate">{activeProject.sub}</div>
                            </div>
                            {conversationActive && (
                                <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-gold"
                                    style={{ boxShadow: "0 0 0 3px rgba(197, 160, 101, 0.18)" }}
                                    aria-label="Conversation active"
                                />
                            )}
                        </div>
                    ) : (
                        <div className="mt-1.5 px-1.5 py-2 text-[11.5px] text-slate italic leading-snug">
                            No active project yet — click <span className="not-italic font-medium text-obsidian">+ New conversation</span> to start one.
                        </div>
                    )}
                </div>

                {/* Recent OR Popular families fallback when no projects yet */}
                <div className="mt-[18px] min-h-0 flex-1 overflow-y-auto -mx-1 px-1">
                    {recentProjects.length > 0 ? (
                        <>
                            <Eyebrow>Recent projects</Eyebrow>
                            {recentProjects.map((p) => (
                                <div key={p.name} className="mt-1 px-1.5 py-2">
                                    <div className="font-serif text-[13px] font-medium tracking-[0.02em] text-obsidian">
                                        {p.name}
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-slate">{p.sub}</div>
                                </div>
                            ))}
                        </>
                    ) : (
                        <RailSectionErrorBoundary
                            fallback={
                                <>
                                    <Eyebrow>Recent projects</Eyebrow>
                                    <div className="mt-1.5 px-1.5 py-2 text-[11px] text-slate italic">
                                        Nothing yet.
                                    </div>
                                </>
                            }
                        >
                            <PopularFamiliesStrip />
                        </RailSectionErrorBoundary>
                    )}
                </div>

                {/* Identity — real Clerk user + portal account when available */}
                <div
                    className="mt-auto pt-3.5"
                    style={{ borderTop: "1px solid rgba(212, 197, 169, 0.55)" }}
                >
                    <div className="flex items-center gap-[9px] px-1.5 py-1">
                        {user?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- Clerk-hosted avatar URL changes per user; Next/Image needs whitelisted domain config
                            <img
                                src={user.imageUrl}
                                alt={userFullName}
                                className="h-7 w-7 rounded-full object-cover"
                                style={{ border: "1px solid rgba(212,197,169,0.6)" }}
                            />
                        ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted-gold font-serif text-[13px] font-semibold text-obsidian">
                                {userInitial}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-medium truncate">{userFullName}</div>
                            <div className="text-[10px] text-slate truncate">
                                {orgName ? `${orgName} · ${tierLabel}` : tierLabel}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Main column ──────────────────────────────────── */}
            <div className="relative flex min-w-0 flex-1 flex-col">
                {/* Top bar */}
                <div
                    className="flex shrink-0 items-center gap-3.5 px-6"
                    style={{
                        height: TOPBAR_H,
                        borderBottom: "1px solid rgba(212, 197, 169, 0.55)",
                    }}
                >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                        {activeProject ? (
                            <>
                                <span className="shrink-0 whitespace-nowrap font-serif text-[18px] font-medium tracking-[0.03em]">
                                    {activeProject.name}
                                </span>
                                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] tracking-[0.04em] text-slate">
                                    · {activeProject.sub}
                                </span>
                            </>
                        ) : (
                            <span className="shrink-0 whitespace-nowrap font-serif text-[18px] font-medium tracking-[0.03em]">
                                {orgName ? `${orgName}'s workspace` : "Workspace"}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3.5">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 rounded-[2px] px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-obsidian cursor-pointer hover:bg-obsidian/[0.04] transition-colors"
                            style={{ border: "1px solid rgba(99, 117, 136, 0.3)" }}
                            title="Back to bestbottles.com"
                        >
                            <ArrowLeft size={12} weight="bold" />
                            Back to site
                        </Link>
                        {/* Share link only makes sense once a project / shortlist exists.
                            Hidden until that pattern lands; preserves space for future wiring. */}
                        {activeProject && (
                            <button
                                type="button"
                                disabled
                                title="Shortlist sharing — coming with the next deploy"
                                className="rounded-[2px] px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-obsidian cursor-not-allowed opacity-50"
                                style={{ border: "1px solid rgba(99, 117, 136, 0.3)" }}
                            >
                                Generate share link
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                // Cart is a Navbar-owned drawer, not a route. Navigate home,
                                // then dispatch the global open event the Navbar listens for.
                                router.push("/");
                                setTimeout(() => {
                                    window.dispatchEvent(new CustomEvent("open-cart-drawer"));
                                }, 200);
                            }}
                            className="rounded-[2px] bg-obsidian px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white cursor-pointer hover:bg-black transition-colors"
                            style={{ borderBottom: "2px solid var(--color-muted-gold)" }}
                        >
                            Cart · {itemCount}
                        </button>
                    </div>
                </div>

                {/* Main content area with faded champagne grid background */}
                <div className="relative flex min-h-0 flex-1 flex-col">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-0"
                        style={{
                            backgroundImage:
                                "linear-gradient(rgba(212,197,169,0.32) 1px, transparent 1px), linear-gradient(90deg, rgba(212,197,169,0.32) 1px, transparent 1px)",
                            backgroundSize: "56px 56px",
                            maskImage:
                                "radial-gradient(ellipse 85% 65% at 50% 38%, #000 25%, transparent 85%)",
                            WebkitMaskImage:
                                "radial-gradient(ellipse 85% 65% at 50% 38%, #000 25%, transparent 85%)",
                        }}
                    />
                    <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Eyebrow({ children }: { children: ReactNode }) {
    return (
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate">
            {children}
        </div>
    );
}

/**
 * Renders when a workspace user has no recent projects yet — converts the
 * empty rail real-estate into a product-discovery surface. Fetches the top
 * families by variant count from Convex and renders them as clickable tiles
 * that open the full catalog filtered to that family.
 */
function PopularFamiliesStrip() {
    const families = useQuery(api.products.getPopularFamilies, { limit: 6 });
    if (families === undefined) {
        return (
            <>
                <Eyebrow>Popular families</Eyebrow>
                <div className="mt-1.5 px-1.5 py-2 text-[11px] text-slate italic">Loading…</div>
            </>
        );
    }
    if (!families || families.length === 0) {
        return (
            <>
                <Eyebrow>Recent projects</Eyebrow>
                <div className="mt-1.5 px-1.5 py-2 text-[11px] text-slate italic">Nothing yet.</div>
            </>
        );
    }
    return (
        <>
            <Eyebrow>Popular families</Eyebrow>
            <div className="mt-2 grid grid-cols-2 gap-2">
                {families.map((f) => (
                    <Link
                        key={f.family}
                        href={`/catalog?family=${encodeURIComponent(f.family)}`}
                        className="group rounded-[2px] overflow-hidden cursor-pointer transition-colors"
                        style={{
                            background: "var(--color-linen)",
                            border: "1px solid rgba(212, 197, 169, 0.55)",
                        }}
                        title={`Browse ${f.family}`}
                    >
                        <div
                            className="relative w-full"
                            style={{ aspectRatio: "1 / 1.1", background: "var(--color-travertine)" }}
                        >
                            {f.heroImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- Convex/Sanity URL set per group; Next/Image needs whitelisted domain config
                                <img
                                    src={f.heroImageUrl}
                                    alt={f.family}
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            ) : (
                                <div
                                    className="absolute inset-0 flex items-center justify-center font-cormorant"
                                    style={{ color: "rgba(29, 29, 31, 0.3)", fontSize: 24 }}
                                >
                                    {f.family[0]}
                                </div>
                            )}
                        </div>
                        <div className="px-1.5 py-1.5">
                            <div className="font-serif text-[11.5px] font-medium tracking-[0.01em] truncate text-obsidian group-hover:text-gold-dim transition-colors">
                                {f.family}
                            </div>
                            <div className="text-[9px] uppercase tracking-wider text-slate mt-0.5">
                                {f.variantCount} variant{f.variantCount === 1 ? "" : "s"}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </>
    );
}

function GraceMark() {
    return (
        <div
            className="relative flex h-[26px] w-[26px] items-center justify-center rounded-[2px]"
            style={{
                border: "1px solid rgba(29, 29, 31, 0.18)",
                background: "rgba(255, 255, 255, 0.6)",
            }}
        >
            <span
                className="font-cormorant font-semibold leading-none text-obsidian"
                style={{ fontSize: 14, letterSpacing: "-0.02em" }}
            >
                G
            </span>
            <span
                className="absolute -right-[2px] -top-[2px] h-[5px] w-[5px] rounded-full bg-muted-gold"
                aria-hidden
            />
        </div>
    );
}
