import { ReactNode } from "react";
import type { Metadata } from "next";
import PortalSidebar from "@/components/portal/PortalSidebar";
import PortalTopBar from "@/components/portal/PortalTopBar";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getPortalShellData } from "@/lib/portal/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Client Portal — Best Bottles",
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
    if (!CLERK_ENABLED) {
        return (
            <div className="min-h-screen bg-bone px-6 py-24">
                <div className="max-w-[760px] mx-auto bg-white border border-champagne/40 rounded-xl px-8 py-8">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-muted-gold font-semibold mb-3">
                        Client Portal
                    </p>
                    <h1 className="font-serif text-3xl text-obsidian mb-3">
                        Portal auth is temporarily disabled
                    </h1>
                    <p className="text-sm text-slate leading-relaxed">
                        Public pages remain available, but Clerk-backed portal access is currently turned off until the
                        auth keys are verified and re-enabled for this environment.
                    </p>
                </div>
            </div>
        );
    }

    const shell = await getPortalShellData();

    return (
        <div className="flex h-screen overflow-hidden bg-neutral-50">
            <PortalSidebar
                companyName={shell.account?.companyName ?? null}
                tierLabel={shell.account?.tier ?? null}
            />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <PortalTopBar inTransitCount={shell.inTransitCount} />
                <main className="flex-1 overflow-auto bg-neutral-50">
                    {shell.viewer.clerkOrgId ? (
                        children
                    ) : (
                        <div className="px-6 py-10 max-w-[760px]">
                            <div className="bg-white border border-neutral-200 rounded-lg px-6 py-6">
                                <h1 className="font-sans text-[22px] font-semibold text-neutral-900 mb-2">
                                    Choose your organization to use the portal
                                </h1>
                                <p className="font-sans text-sm text-neutral-500 leading-relaxed">
                                    Your account is signed in, but there is no active Clerk organization selected for this session yet.
                                    Once an organization is active, orders, drafts, and account data will sync to the portal automatically.
                                </p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
