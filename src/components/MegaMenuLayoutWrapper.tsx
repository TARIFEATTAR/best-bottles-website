import { SanityMegaMenuProvider } from "@/components/SanityMegaMenuProvider";
import { getMegaMenuPanels } from "@/sanity/lib/queries";
import MobileTabBar from "@/components/mobile/MobileTabBar";

export default async function MegaMenuLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const megaMenuPanels = await getMegaMenuPanels();

    return (
        <SanityMegaMenuProvider initialData={megaMenuPanels}>
            {children}
            <MobileTabBar />
        </SanityMegaMenuProvider>
    );
}
