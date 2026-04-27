"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useOrganization } from "@clerk/nextjs";

function NavIcon({ id }: { id: string }) {
    const icons: Record<string, React.ReactNode> = {
        dashboard: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
        ),
        orders: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M2 4h12M2 8h12M2 12h8" />
            </svg>
        ),
        tracking: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="14" height="10" rx="2" />
                <path d="M1 7h14" />
                <path d="M5 11h2" />
            </svg>
        ),
        drafts: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
                <path d="M10 2v3h3" />
            </svg>
        ),
        tools: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
            </svg>
        ),
        grace: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2l1.5 4h4.3l-3.4 2.5 1.4 4L8 10l-3.8 2.5 1.4-4L2.2 6h4.3L8 2Z" />
            </svg>
        ),
        documents: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
                <path d="M10 2v3h3" />
                <path d="M5 8h6M5 11h4" />
            </svg>
        ),
        account: (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="8" cy="5.5" r="2.5" />
                <path d="M2.5 14c0-2.76 2.46-4.5 5.5-4.5s5.5 1.74 5.5 4.5" />
            </svg>
        ),
    };

    return (
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {icons[id]}
        </span>
    );
}

const navSections = [
    {
        items: [
            { href: "/portal", label: "Overview", id: "dashboard" },
            { href: "/portal/orders", label: "Orders", id: "orders" },
            { href: "/portal/drafts", label: "Drafts", id: "drafts" },
            { href: "/portal/grace", label: "Grace AI", id: "grace" },
        ],
    },
    {
        items: [
            // Full-screen Grace workspace lives at a top-level route (gated to
            // authenticated B2B users). External arrow signals it leaves the
            // portal shell into Grace's own surface.
            { href: "/grace-workspace", label: "Grace Workspace ↗", id: "grace", external: true },
        ],
    },
    {
        items: [
            { href: "/portal/account", label: "Account", id: "account" },
        ],
    },
];

export default function PortalSidebar({
    companyName,
    tierLabel,
}: {
    companyName?: string | null;
    tierLabel?: string | null;
}) {
    const pathname = usePathname();
    const { organization } = useOrganization();

    const isActive = (href: string) => {
        if (href === "/portal") return pathname === "/portal";
        return pathname.startsWith(href);
    };

    const orgName = companyName ?? organization?.name ?? "Your organization";
    const initials = orgName
        .split(" ")
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase();

    return (
        <div className="w-[220px] min-w-[220px] bg-white border-r border-neutral-200 flex flex-col h-full">

            {/* Brand */}
            <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
                <p className="font-sans text-[22px] font-semibold text-neutral-900 leading-tight tracking-tight">
                    Best Bottles
                </p>
                <p className="font-sans text-[11px] text-neutral-400 mt-0.5">Client Portal</p>
            </div>

            {/* Org switcher */}
            <div className="px-5 py-3.5 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-neutral-900 flex items-center justify-center shrink-0">
                        <span className="font-sans text-[10px] text-white font-semibold leading-none">
                            {initials}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-sans text-[13px] text-neutral-900 font-medium truncate leading-tight">
                            {orgName}
                        </p>
                        <p className="font-sans text-[11px] text-neutral-400 leading-tight">
                            {tierLabel ?? "Portal access"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-2">
                {navSections.map((section, si) => (
                    <div key={si}>
                        {si > 0 && <div className="h-px bg-neutral-100 mx-4 my-1.5" />}
                        {section.items.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2.5 mx-2 px-3 py-[7px] rounded-md text-[13px] font-sans transition-colors duration-100 ${
                                        active
                                            ? "bg-neutral-100 text-neutral-900 font-medium"
                                            : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
                                    }`}
                                >
                                    <span className={active ? "text-neutral-700" : "text-neutral-400"}>
                                        <NavIcon id={item.id} />
                                    </span>
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="font-sans text-[11px] text-neutral-400">Grace online</span>
                </div>
                <UserButton appearance={{ elements: { avatarBox: "w-6 h-6" } }} />
            </div>
        </div>
    );
}
