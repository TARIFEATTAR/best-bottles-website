import { journal } from "./documents/journal";
import { product } from "./documents/product";
import { homepagePage } from "./documents/homepagePage";
import { productFamilyContent } from "./documents/productFamilyContent";
import { productGroupContent } from "./documents/productGroupContent";
import { heroBlock } from "./objects/heroBlock";
import { startHereCard } from "./objects/startHereCard";
import { designFamilyCard } from "./objects/designFamilyCard";
import { educationPreview } from "./objects/educationPreview";
import { megaMenuFeaturedCard } from "./objects/megaMenuFeaturedCard";
import { mobileCategoryCard } from "./objects/mobileCategoryCard";
import { megaMenuPanels } from "./objects/megaMenuPanels";
import { pdpFeatureStrip } from "./objects/pdpFeatureStrip";
import { pdpRichDescription } from "./objects/pdpRichDescription";
import { pdpGalleryRow } from "./objects/pdpGalleryRow";
import { pdpPromoBanner } from "./objects/pdpPromoBanner";
import { pdpFaqAccordion } from "./objects/pdpFaqAccordion";
import { pdpTrustBadges } from "./objects/pdpTrustBadges";
import { paperDollLayerAsset } from "./objects/paperDollLayerAsset";
import { paperDollFamily } from "./documents/paperDollFamily";

export const schemaTypes = [
    // Documents
    journal,
    product,
    homepagePage,
    productFamilyContent,
    productGroupContent,
    paperDollFamily,
    // Objects — Homepage
    heroBlock,
    startHereCard,
    designFamilyCard,
    mobileCategoryCard,
    educationPreview,
    megaMenuFeaturedCard,
    megaMenuPanels,
    // Objects — Product Page Blocks
    pdpFeatureStrip,
    pdpRichDescription,
    pdpGalleryRow,
    pdpPromoBanner,
    pdpFaqAccordion,
    pdpTrustBadges,
    // Paper Doll
    paperDollLayerAsset,
];
