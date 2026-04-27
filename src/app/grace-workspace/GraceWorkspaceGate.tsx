"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, Check } from "@phosphor-icons/react";
import { useGrace } from "@/components/useGrace";
import WorkspaceShell from "@/components/grace-workspace/WorkspaceShell";

/**
 * Sign-in landing for /grace-workspace when the user is not authenticated.
 *
 * Renders inside the same WorkspaceShell as the real workspace (so the
 * brand register stays consistent) but the rail items are stubbed and the
 * main panel becomes a single sign-in card explaining the value of the
 * deluxe surface.
 *
 * Anonymous fallback: "Use the chat drawer instead" — opens the global
 * floating drawer (which is already fully functional for anonymous use).
 */
export default function GraceWorkspaceGate() {
    const router = useRouter();
    const { openPanel } = useGrace();

    const handleUseDrawer = () => {
        router.push("/");
        // Slight delay so the route change is committed before opening the drawer.
        setTimeout(() => openPanel(), 200);
    };

    const features: Array<{ label: string; sub: string }> = [
        { label: "Project memory across sessions", sub: "Pick up where you left off — Grace remembers your shortlist, notes, and project context." },
        { label: "Shareable shortlist URLs", sub: "Send your team a view-only link to the bottles you're considering." },
        { label: "Build-a-kit composer", sub: "Assemble bottle + closure + applicator with swap actions; one-click add to cart." },
        { label: "True-scale comparison", sub: "See up to four bottles at relative real-world size, with the full spec table inline." },
    ];

    return (
        <WorkspaceShell onNewConversation={() => { /* gate state — disabled */ }}>
            <div className="flex flex-1 items-center justify-center px-6 py-10 min-h-0">
                <div
                    className="w-full max-w-[560px] rounded-[3px] overflow-hidden"
                    style={{
                        background: "var(--color-linen)",
                        border: "1px solid rgba(212, 197, 169, 0.55)",
                        boxShadow: "0 24px 60px rgba(29, 29, 31, 0.10), 0 4px 16px rgba(29, 29, 31, 0.06)",
                    }}
                >
                    {/* Header */}
                    <div className="flex flex-col items-center px-8 pt-10 pb-2 text-center">
                        <div
                            className="flex items-center justify-center mb-5"
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 3,
                                background: "rgba(255, 255, 255, 0.6)",
                                border: "1px solid rgba(212, 197, 169, 0.6)",
                                boxShadow: "0 0 0 6px rgba(197, 160, 101, 0.10)",
                            }}
                        >
                            <Star size={26} weight="fill" className="text-muted-gold" />
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate">
                            Grace · Workspace
                        </div>
                        <h1 className="mt-1 font-serif text-[28px] font-medium tracking-[0.01em] text-obsidian">
                            The deluxe Grace concierge
                        </h1>
                        <p className="mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-slate">
                            A full surface for B2B accounts: project memory, shareable
                            shortlists, build-a-kit composer, and deep product
                            comparison. Available once you sign in.
                        </p>
                    </div>

                    {/* Features */}
                    <div className="px-8 pt-4 pb-2">
                        <ul className="flex flex-col gap-2.5">
                            {features.map((f) => (
                                <li key={f.label} className="flex items-start gap-2.5">
                                    <span
                                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                                        style={{ background: "rgba(197, 160, 101, 0.18)" }}
                                    >
                                        <Check size={10} weight="bold" className="text-muted-gold" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-medium text-obsidian leading-tight">
                                            {f.label}
                                        </div>
                                        <div className="mt-0.5 text-[11.5px] text-slate leading-snug">
                                            {f.sub}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* CTA row */}
                    <div className="px-8 pt-5 pb-7 flex flex-col items-center gap-2">
                        <Link
                            href="/sign-in?redirect_url=/grace-workspace"
                            className="block w-full text-center rounded-[3px] cursor-pointer transition-colors"
                            style={{
                                background: "var(--color-obsidian)",
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: "0.16em",
                                textTransform: "uppercase",
                                padding: "13px 18px",
                                borderBottom: "2px solid var(--color-muted-gold)",
                            }}
                        >
                            Sign in to unlock
                        </Link>
                        <button
                            type="button"
                            onClick={handleUseDrawer}
                            className="block text-[12px] font-medium text-slate hover:text-obsidian cursor-pointer pb-0.5 mt-1.5"
                            style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.6)" }}
                        >
                            Use the chat drawer instead →
                        </button>
                    </div>

                    {/* Footer */}
                    <div
                        className="px-8 py-3 text-center text-[10.5px] italic text-slate"
                        style={{
                            background: "rgba(238, 230, 212, 0.3)",
                            borderTop: "1px solid rgba(212, 197, 169, 0.4)",
                        }}
                    >
                        Already on the catalog and just want quick help? The drawer is on every page.
                    </div>
                </div>
            </div>
        </WorkspaceShell>
    );
}
