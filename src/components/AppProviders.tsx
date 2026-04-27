"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { CartProvider } from "@/components/CartProvider";
import {
    SanityMegaMenuProvider,
    type MegaMenuPanelsData,
} from "@/components/SanityMegaMenuProvider";
import MobileTabBar from "@/components/mobile/MobileTabBar";
import GraceProvider from "@/components/grace/GraceProvider";
import GraceChatDrawer from "@/components/grace/GraceChatDrawer";
import GraceLauncher from "@/components/grace/GraceLauncher";
import GraceLayoutShell from "@/components/grace/GraceLayoutShell";
import { MixpanelProvider } from "@/components/MixpanelProvider";
import { CLERK_ENABLED, isClerkAuthPath } from "@/lib/clerk";

// megaMenuPanels is fetched in the Server Component root layout and passed
// down as a prop, because this file is a Client Component boundary and cannot
// render an async Server Component inside it (Next.js constraint).
type AppProvidersProps = {
    children: ReactNode;
    megaMenuPanels: MegaMenuPanelsData | null | undefined;
};

function ProviderContent({
    children,
    withClerk,
    megaMenuPanels,
}: {
    children: ReactNode;
    withClerk: boolean;
    megaMenuPanels: MegaMenuPanelsData | null | undefined;
}) {
    return (
        <ConvexClientProvider withClerk={withClerk}>
            <CartProvider>
                <Suspense
                    fallback={
                        <div className="min-h-screen bg-bone flex items-center justify-center">
                            <div className="w-10 h-10 border-2 border-muted-gold/30 border-t-muted-gold rounded-full animate-spin" />
                        </div>
                    }
                >
                    <GraceProvider withClerk={withClerk}>
                        <GraceLayoutShell>
                            <SanityMegaMenuProvider initialData={megaMenuPanels}>
                                {children}
                                <MobileTabBar />
                            </SanityMegaMenuProvider>
                        </GraceLayoutShell>
                        <GraceChatDrawer />
                        <GraceLauncher />
                    </GraceProvider>
                </Suspense>
                <MixpanelProvider withClerk={withClerk} />
            </CartProvider>
        </ConvexClientProvider>
    );
}

export default function AppProviders({ children, megaMenuPanels }: AppProvidersProps) {
    const pathname = usePathname();
    const withClerk = CLERK_ENABLED && isClerkAuthPath(pathname);

    if (withClerk) {
        return (
            <ClerkProvider>
                <ProviderContent withClerk={withClerk} megaMenuPanels={megaMenuPanels}>
                    {children}
                </ProviderContent>
            </ClerkProvider>
        );
    }

    return (
        <ProviderContent withClerk={false} megaMenuPanels={megaMenuPanels}>
            {children}
        </ProviderContent>
    );
}
