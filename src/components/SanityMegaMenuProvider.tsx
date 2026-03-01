"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type MegaMenuPanelsData = {
    bottles?: { featuredImage?: { asset?: { _ref: string } }; title?: string; subtitle?: string; href?: string };
    closures?: { featuredImage?: { asset?: { _ref: string } }; title?: string; subtitle?: string; href?: string };
    specialty?: { featuredImage?: { asset?: { _ref: string } }; title?: string; subtitle?: string; href?: string };
};

const MegaMenuContext = createContext<MegaMenuPanelsData | null>(null);

export function useMegaMenuPanels() {
    return useContext(MegaMenuContext);
}

export function SanityMegaMenuProvider({ children, initialData }: { children: React.ReactNode; initialData: MegaMenuPanelsData | null | undefined }) {
    const [data, setData] = useState<MegaMenuPanelsData | null>(initialData ?? null);

    useEffect(() => {
        if (initialData) setData(initialData);
    }, [initialData]);

    return <MegaMenuContext.Provider value={data}>{children}</MegaMenuContext.Provider>;
}
