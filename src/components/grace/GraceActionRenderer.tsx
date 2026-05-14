"use client";

import type { GraceAction, ProductCard } from "@/components/GraceContext";
import PatternA_SingleSku from "./patterns/PatternA_SingleSku";
import PatternB_FamilyCard from "./patterns/PatternB_FamilyCard";
import PatternC_ComponentsTray from "./patterns/PatternC_ComponentsTray";
import PatternD_BuildKit from "./patterns/PatternD_BuildKit";
import PatternE_Anatomy from "./patterns/PatternE_Anatomy";
import PatternF_DeepCompare from "./patterns/PatternF_DeepCompare";
import PatternH_ReferenceMatch from "./patterns/PatternH_ReferenceMatch";
import PatternI_BrandMockup from "./patterns/PatternI_BrandMockup";
import PatternJ_Shortlist from "./patterns/PatternJ_Shortlist";
import PatternL_CatalogDiscovery from "./patterns/PatternL_CatalogDiscovery";
import GraceProductCard from "./cards/GraceProductCard";

/**
 * Central dispatch for Grace's inline rich actions.
 *
 * Each `GraceAction` variant maps to exactly one pattern component (PRD A-L).
 * Patterns added incrementally in their respective phases:
 *  - Phase 3: A, B, C, D, F, J, L (this file)
 *  - Phase 4: K (voice note pinned, rendered separately as a message variant)
 *  - Phase 5: H, I (file-upload patterns)
 *  - Phase 6: E, G (anatomy + true-scale)
 *
 * The renderer is a pure switch — no data fetching here. Payloads arrive
 * pre-built from the corresponding clientTool in GraceProvider.
 */
export interface GraceActionRendererProps {
    action: GraceAction;
    onAddToShortlist?: (p: ProductCard) => void;
    tierLabel?: string | null;
}

function GraceProductTileGrid({
    products,
    headline,
    onAddToShortlist,
    tierLabel,
}: {
    products: ProductCard[];
    headline?: string;
    onAddToShortlist?: (p: ProductCard) => void;
    tierLabel?: string | null;
}) {
    if (products.length === 0) return null;

    return (
        <div
            className="rounded-[2px] p-3 space-y-3"
            style={{
                background: "var(--color-linen)",
                border: "1px solid rgba(212, 197, 169, 0.55)",
            }}
            data-testid="grace-product-tile-grid"
        >
            {headline && (
                <div className="font-serif text-[16px] font-medium text-obsidian leading-tight">
                    {headline}
                </div>
            )}
            <div className="grid grid-cols-1 gap-2">
                {products.slice(0, 6).map((product) => (
                    <GraceProductCard
                        key={product.slug ?? product.graceSku}
                        product={product}
                        mode="single"
                        onAddToShortlist={onAddToShortlist}
                        tierLabel={tierLabel}
                    />
                ))}
            </div>
        </div>
    );
}

export default function GraceActionRenderer({ action, onAddToShortlist, tierLabel }: GraceActionRendererProps) {
    switch (action.type) {
        case "displayProductCard":
            return (
                <PatternA_SingleSku
                    product={action.product}
                    onAddToShortlist={onAddToShortlist}
                    tierLabel={tierLabel}
                />
            );

        case "displayFamilyCard":
            return (
                <PatternB_FamilyCard
                    payload={action.payload}
                    onAddToShortlist={onAddToShortlist}
                    tierLabel={tierLabel}
                />
            );

        case "displayCompatibility":
            return (
                <PatternC_ComponentsTray
                    payload={action.payload}
                    onAddToShortlist={onAddToShortlist}
                />
            );

        case "displayBuildKit":
            return <PatternD_BuildKit payload={action.payload} />;

        case "displayComparison":
            return (
                <PatternF_DeepCompare
                    payload={action.payload}
                    onAddToShortlist={onAddToShortlist}
                />
            );

        case "displayShortlist":
            return <PatternJ_Shortlist payload={action.payload} />;

        case "displayCatalogStrip":
            return <PatternL_CatalogDiscovery payload={action.payload} />;

        case "displayReferenceMatch":
            return <PatternH_ReferenceMatch payload={action.payload} />;

        case "displayBrandMockup":
            return <PatternI_BrandMockup payload={action.payload} />;

        case "displayAnatomy":
            return <PatternE_Anatomy payload={action.payload} />;

        case "showProducts":
        case "compareProducts":
            return (
                <GraceProductTileGrid
                    products={action.products}
                    onAddToShortlist={onAddToShortlist}
                    tierLabel={tierLabel}
                />
            );
        case "showProductPresentation":
            return (
                <GraceProductTileGrid
                    products={action.products}
                    headline={action.headline}
                    onAddToShortlist={onAddToShortlist}
                    tierLabel={tierLabel}
                />
            );

        // Existing legacy non-product actions continue to act as routing /
        // cart / form triggers via the provider, which is the v2 behavior.
        case "buildKit":
        case "proposeCartAdd":
        case "navigateToPage":
        case "prefillForm":
            return null;

        default:
            return null;
    }
}
