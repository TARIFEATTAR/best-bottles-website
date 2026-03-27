"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { House, GridFour, ShoppingBag, User, X, Microphone } from "@/components/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/components/CartProvider";
import { useGrace } from "@/components/useGrace";

const GRACE_TAB_ONBOARDING_KEY = "grace-tab-onboarding-seen";

// ─── Tab definitions ─────────────────────────────────────────────────────────

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

interface Tab {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string; size?: number; weight?: IconWeight }>;
    href?: string;
    action?: "cart" | "grace";
}

const TABS: Tab[] = [
    { key: "home", label: "Home", icon: House, href: "/" },
    { key: "catalog", label: "Catalog", icon: GridFour, href: "/catalog" },
    { key: "cart", label: "Cart", icon: ShoppingBag, action: "cart" },
    { key: "grace", label: "Ask Grace AI", icon: Microphone, action: "grace" },
    { key: "account", label: "Account", icon: User, href: "/account" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MobileTabBar() {
    const pathname = usePathname();
    const { itemCount, isCartHydrated } = useCart();
    const { openPanel } = useGrace();
    const [showGraceTooltip, setShowGraceTooltip] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!mounted || typeof window === "undefined") return;
        if (!localStorage.getItem(GRACE_TAB_ONBOARDING_KEY)) setShowGraceTooltip(true);
    }, [mounted]);

    const dismissGraceTooltip = () => {
        setShowGraceTooltip(false);
        try {
            localStorage.setItem(GRACE_TAB_ONBOARDING_KEY, "1");
        } catch {
            /* ignore */
        }
    };

    useEffect(() => {
        if (!showGraceTooltip) return;
        const t = setTimeout(dismissGraceTooltip, 5000);
        return () => clearTimeout(t);
    }, [showGraceTooltip]);

    function handleAction(action: "cart" | "grace") {
        if (action === "cart") {
            window.dispatchEvent(new Event("open-cart-drawer"));
        } else {
            dismissGraceTooltip();
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
                        <span className="flex flex-col items-center gap-1.5 relative">
                            {tab.key === "grace" ? (
                                <div className={`w-12 h-12 -mt-6 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${active ? "bg-muted-gold" : "bg-obsidian hover:bg-black hover:scale-105 active:scale-95"} ${showGraceTooltip ? "ring-4 ring-muted-gold/20 animate-grace-pulse" : ""}`}>
                                    <Icon
                                        className="text-white"
                                        size={24}
                                        weight="fill"
                                    />
                                </div>
                            ) : (
                                <span className="relative">
                                    <Icon
                                        className={`transition-colors duration-150 ${active ? "text-muted-gold" : "text-slate group-hover:text-obsidian"}`}
                                        size={20}
                                        weight={active ? "bold" : "regular"}
                                    />
                                    {tab.key === "cart" && mounted && isCartHydrated && itemCount > 0 && (
                                        <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-muted-gold text-[10px] font-semibold text-obsidian px-1 leading-none">
                                            {itemCount > 99 ? "99+" : itemCount}
                                        </span>
                                    )}
                                </span>
                            )}
                            <span
                                className={`text-[8px] leading-tight font-bold uppercase tracking-tight transition-colors duration-150 text-center ${tab.key === "grace" ? "text-obsidian mt-0.5" : (active ? "text-muted-gold" : "text-slate")}`}
                                style={{ maxWidth: "60px" }}
                            >
                                {tab.label}
                            </span>
                        </span>
                    );

                    if (tab.action) {
                        const isGrace = tab.key === "grace";
                        return (
                            <div key={tab.key} className="relative flex-1 flex items-center justify-center h-full min-w-[44px]">
                                <AnimatePresence>
                                    {isGrace && showGraceTooltip && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 4 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[200px] z-[60]"
                                        >
                                            <div className="bg-obsidian text-bone text-xs rounded-xl shadow-xl px-3 py-2.5 pr-7 relative">
                                                <p className="leading-snug">Need fitment help? Talk with Grace — your bottle & closure expert.</p>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); dismissGraceTooltip(); }}
                                                    aria-label="Dismiss"
                                                    className="absolute top-1.5 right-1.5 p-0.5 rounded hover:bg-white/10 transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-obsidian rotate-45" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <button
                                    role="tab"
                                    aria-selected={false}
                                    onClick={() => handleAction(tab.action!)}
                                    className="group w-full flex items-center justify-center h-full min-w-[44px] cursor-pointer"
                                >
                                    {inner}
                                </button>
                            </div>
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
