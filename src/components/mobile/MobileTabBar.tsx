"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, LayoutGrid, ShoppingBag, Sparkles, User } from "lucide-react";
import { useCart } from "../CartProvider";
import { useGrace } from "../useGrace";

// ─── Tab definitions ─────────────────────────────────────────────────────────

interface Tab {
    key: string;
    label: string;
    icon: typeof Home;
    href?: string;
    action?: "cart" | "grace";
}

const TABS: Tab[] = [
    { key: "home", label: "Home", icon: Home, href: "/" },
    { key: "catalog", label: "Catalog", icon: LayoutGrid, href: "/catalog" },
    { key: "cart", label: "Cart", icon: ShoppingBag, action: "cart" },
    { key: "grace", label: "Grace", icon: Sparkles, action: "grace" },
    { key: "account", label: "Account", icon: User, href: "/account" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MobileTabBar() {
    const pathname = usePathname();
    const { itemCount } = useCart();
    const { openPanel } = useGrace();

    function handleAction(action: "cart" | "grace") {
        if (action === "cart") {
            window.dispatchEvent(new Event("open-cart-drawer"));
        } else {
            openPanel();
        }
    }

    function isActive(tab: Tab): boolean {
        if (!tab.href) return false;
        if (tab.href === "/") return pathname === "/";
        return pathname.startsWith(tab.href);
    }

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-bone/95 backdrop-blur-md border-t border-champagne/60"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            role="tablist"
            aria-label="Main navigation"
        >
            <div className="flex items-center justify-around h-14">
                {TABS.map((tab) => {
                    const active = isActive(tab);
                    const Icon = tab.icon;

                    const inner = (
                        <span className="flex flex-col items-center gap-0.5 relative">
                            <span className="relative">
                                <Icon
                                    className={`w-5 h-5 transition-colors duration-150 ${
                                        active
                                            ? "text-muted-gold"
                                            : "text-slate group-hover:text-obsidian"
                                    }`}
                                    strokeWidth={active ? 2.2 : 1.8}
                                />
                                {/* Cart badge */}
                                {tab.key === "cart" && itemCount > 0 && (
                                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-muted-gold text-[10px] font-semibold text-obsidian px-1 leading-none">
                                        {itemCount > 99 ? "99+" : itemCount}
                                    </span>
                                )}
                            </span>
                            <span
                                className={`text-[10px] leading-tight font-medium transition-colors duration-150 ${
                                    active
                                        ? "text-muted-gold"
                                        : "text-slate group-hover:text-obsidian"
                                }`}
                            >
                                {tab.label}
                            </span>
                        </span>
                    );

                    if (tab.action) {
                        return (
                            <button
                                key={tab.key}
                                role="tab"
                                aria-selected={false}
                                onClick={() => handleAction(tab.action!)}
                                className="group flex-1 flex items-center justify-center h-full min-w-[44px] cursor-pointer"
                            >
                                {inner}
                            </button>
                        );
                    }

                    return (
                        <Link
                            key={tab.key}
                            href={tab.href!}
                            role="tab"
                            aria-selected={active}
                            aria-current={active ? "page" : undefined}
                            className="group flex-1 flex items-center justify-center h-full min-w-[44px]"
                        >
                            {inner}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
