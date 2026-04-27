"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useGrace } from "@/components/useGrace";
import { DRAWER_WIDTH } from "./GraceChatDrawer";

export default function GraceLayoutShell({ children }: { children: ReactNode }) {
    const { panelMode } = useGrace();
    const pathname = usePathname();
    const isOpen = panelMode === "open";

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(mq.matches); // eslint-disable-line react-hooks/set-state-in-effect -- sync initial media query state
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    // The drawer floats above the page (Copilot-style) — no layout push.
    // This wrapper is kept as a no-op so callers can reintroduce a push
    // behind a flag without restructuring the provider tree.
    void isOpen;
    void pathname;
    void isMobile;
    void DRAWER_WIDTH;

    return <div>{children}</div>;
}
