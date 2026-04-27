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

        // Existing legacy actions (showProducts/compareProducts/buildKit/etc)
        // are not rendered inline today — they continue to act as routing /
        // cart / form triggers via the provider, which is the v2 behavior.
        case "showProducts":
        case "compareProducts":
        case "showProductPresentation":
        case "buildKit":
        case "proposeCartAdd":
        case "navigateToPage":
        case "prefillForm":
            return null;

        default:
            return null;
    }
}
