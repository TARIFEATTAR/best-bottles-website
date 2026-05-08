"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGrace } from "@/components/useGrace";

/**
 * Grace floating launcher — PRD v3 collapsed-state spec.
 *
 * 56px disc anchored bottom-right with a subtle gold breathing pulse on idle.
 * Replaces the old navbar Grace button. Hidden on mobile (the MobileTabBar
 * Grace tab handles that surface) and on the workspace route (it owns its
 * own surface).
 *
 * Sub-states (per PRD): default · hover · active (drawer open) · with-notification-dot.
 * The gold notification dot lights up automatically while a Grace conversation
 * is active in the background — letting the customer see the page (e.g. catalog
 * Grace just navigated to) while signaling she's still alive and one click away.
 *
 * When Grace auto-minimizes during navigation, `launcherTooltip` from context
 * is rendered beside the disc as a brief contextual hint that fades after ~3s.
 */
export default function GraceLauncher() {
    const { panelMode, openPanel, conversationActive, launcherTooltip } = useGrace();
    const isOpen = panelMode === "open";
    const pathname = usePathname();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        const onResize = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(mq.matches); // eslint-disable-line react-hooks/set-state-in-effect -- sync initial
        mq.addEventListener("change", onResize);
        return () => mq.removeEventListener("change", onResize);
    }, []);

    // Workspace owns the viewport — no launcher there.
    const ownsViewport = pathname.startsWith("/grace-workspace");
    const visible = !isOpen && !isMobile && !ownsViewport;

    return (
        <AnimatePresence>
            {visible && (
                <motion.button
                    key="grace-launcher"
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 8 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    onClick={openPanel}
                    aria-label="Open Grace AI"
                    title="Ask Grace — AI bottling concierge"
                    className="fixed z-[55] flex items-center justify-center cursor-pointer group"
                    style={{
                        right: "max(22px, env(safe-area-inset-right))",
                        bottom: "max(22px, calc(env(safe-area-inset-bottom) + 22px))",
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: "var(--color-bone)",
                        border: "1px solid rgba(29, 29, 31, 0.12)",
                        boxShadow:
                            "0 1px 2px rgba(29, 29, 31, 0.04), 0 12px 32px rgba(29, 29, 31, 0.12), 0 0 0 1px rgba(212, 197, 169, 0.4)",
                    }}
                >
                    {/* Breathing pulse — adagio, only on idle */}
                    {!conversationActive && (
                        <span
                            aria-hidden
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                                animation: "grace-launcher-pulse 3.4s ease-in-out infinite",
                                boxShadow: "0 0 0 0 rgba(197, 160, 101, 0.45)",
                            }}
                        />
                    )}

                    {/* Mark — refined G monogram + gold dot */}
                    <span
                        className="relative flex items-center justify-center font-cormorant"
                        style={{
                            color: "var(--color-obsidian)",
                            fontWeight: 600,
                            fontSize: 26,
                            letterSpacing: "-0.02em",
                            lineHeight: 1,
                            marginTop: -2,
                        }}
                    >
                        G
                        <span
                            className="absolute rounded-full"
                            style={{
                                right: -6,
                                top: -1,
                                width: 6,
                                height: 6,
                                background: "var(--color-muted-gold)",
                            }}
                            aria-hidden
                        />
                    </span>

                    {/* Notification dot — lit while Grace is alive in the background */}
                    {conversationActive && (
                        <span
                            aria-label="Grace conversation in progress"
                            className="absolute"
                            style={{
                                right: 6,
                                top: 6,
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: "var(--color-muted-gold)",
                                border: "2px solid var(--color-bone)",
                                boxShadow: "0 0 0 1px rgba(29, 29, 31, 0.08), 0 0 0 4px rgba(197, 160, 101, 0.18)",
                            }}
                        />
                    )}

                    {/* Contextual tooltip beside the disc — set by Grace when she
                        auto-minimizes after navigating the customer somewhere. */}
                    <AnimatePresence>
                        {launcherTooltip && (
                            <motion.div
                                key={launcherTooltip.message}
                                initial={{ opacity: 0, x: 6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 6 }}
                                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute pointer-events-none whitespace-nowrap"
                                style={{
                                    right: 70,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "var(--color-obsidian)",
                                    color: "#fff",
                                    fontSize: 12,
                                    fontWeight: 500,
                                    letterSpacing: "0.02em",
                                    padding: "8px 14px",
                                    borderRadius: 3,
                                    boxShadow: "0 8px 24px rgba(29, 29, 31, 0.18)",
                                }}
                            >
                                {launcherTooltip.message}
                                {/* Caret pointing at the disc */}
                                <span
                                    aria-hidden
                                    className="absolute"
                                    style={{
                                        right: -5,
                                        top: "50%",
                                        transform: "translateY(-50%) rotate(45deg)",
                                        width: 10,
                                        height: 10,
                                        background: "var(--color-obsidian)",
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.button>
            )}
        </AnimatePresence>
    );
}
