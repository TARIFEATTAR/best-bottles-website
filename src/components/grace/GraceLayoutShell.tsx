"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useGrace } from "@/components/useGrace";
import { DRAWER_WIDTH } from "./GraceChatDrawer";

export default function GraceLayoutShell({ children }: { children: ReactNode }) {
    const { panelMode } = useGrace();
    const isOpen = panelMode === "open";

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const shouldPush = isOpen && !isMobile;

    return (
        <div
            className="transition-[margin-right] duration-300 ease-in-out"
            style={{ marginRight: shouldPush ? DRAWER_WIDTH : 0 }}
        >
            {children}
        </div>
    );
}
