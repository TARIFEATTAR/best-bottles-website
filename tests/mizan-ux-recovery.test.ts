import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readRepoFile(path: string) {
    return readFileSync(join(root, path), "utf8");
}

describe("Mizan UX recovery guardrails", () => {
    it("starts Shopify checkout in the same tab instead of relying on a popup", () => {
        const cartProvider = readRepoFile("src/components/CartProvider.tsx");

        expect(cartProvider).toContain("window.location.assign(checkoutUrl)");
        expect(cartProvider).not.toContain("window.open(checkoutUrl");
    });

    it("exposes stable mobile/search affordances for Mizan and real buyers", () => {
        const navbar = readRepoFile("src/components/Navbar.tsx");
        const mobileTabBar = readRepoFile("src/components/mobile/MobileTabBar.tsx");

        expect(navbar).toContain('type="search"');
        expect(navbar).toContain('enterKeyHint="search"');
        expect(navbar).toContain('data-testid="navbar-mobile-search-submit"');
        expect(navbar).toContain('data-testid="mobile-menu-primary-link"');
        expect(mobileTabBar).toContain("data-testid={`mobile-tab-${tab.key}`}");
    });

    it("renders PDP confidence content and avoids a generic loading-only PDP state", () => {
        const pdp = readRepoFile("src/app/products/[slug]/page.tsx");
        const gallery = readRepoFile("src/components/products/ProductImageGallery.tsx");

        expect(pdp).toContain("ProductConfidenceSummary");
        expect(pdp).toContain('data-testid="pdp-confidence-summary"');
        expect(pdp).toContain("Preparing product details and fitment data");
        expect(pdp).not.toContain("Loading product...");
        expect(gallery).toContain('loading="eager"');
        expect(gallery).toContain('fetchPriority="high"');
    });

    it("surfaces catalog search and filtering recovery affordances", () => {
        const catalog = readRepoFile("src/app/catalog/page.tsx");
        const filters = readRepoFile("src/lib/catalogFilters.ts");

        expect(filters).toContain("catalogSearchMatches");
        expect(filters).toContain("catalogSearchRecoverySuggestions");
        expect(catalog).toContain('data-testid="catalog-search-input"');
        expect(catalog).toContain('data-testid="catalog-result-count"');
        expect(catalog).toContain('data-testid="catalog-active-filter-chip"');
        expect(catalog).toContain('data-testid="catalog-search-recovery-suggestion"');
        expect(catalog).toContain('data-testid="catalog-card-specs"');
    });

    it("adds crawlable AEO answer blocks with Grace handoff prompts", () => {
        const catalog = readRepoFile("src/app/catalog/page.tsx");
        const resources = readRepoFile("src/app/resources/page.tsx");

        expect(catalog).toContain("PACKAGING_ANSWER_BLOCKS");
        expect(catalog).toContain('data-testid="catalog-answer-blocks"');
        expect(catalog).toContain('data-testid="catalog-answer-grace-cta"');
        expect(catalog).toContain("buildCatalogFaqJsonLd");
        expect(catalog).toContain("Can I use any applicator with any bottle?");
        expect(catalog).toContain("setGraceInput(prompt)");

        expect(resources).toContain("buildResourcesFaqJsonLd");
        expect(resources).toContain('id: "neck-size"');
        expect(resources).toContain('id: "case-quantity"');
    });

    it("captures May 4 stakeholder regressions for search, guided sizing, Grace tiles, and compatibility ordering", () => {
        const home = readRepoFile("src/components/HomePage.tsx");
        const graceProvider = readRepoFile("src/components/grace/GraceProvider.tsx");
        const graceRenderer = readRepoFile("src/components/grace/GraceActionRenderer.tsx");
        const pdp = readRepoFile("src/app/products/[slug]/page.tsx");

        expect(home).toContain("1–5 ml (0.03–0.17 oz)");
        expect(home).toContain("capacities=3.7+ml&capacities=4+ml");
        expect(home).toContain('params.set("sort", "capacity-asc")');

        expect(graceProvider).toContain("shouldAutoDisplayCatalogTiles");
        expect(graceProvider).toContain("selectGraceTileProducts");
        expect(graceProvider).toContain('type: "showProductPresentation"');
        expect(graceProvider).toContain('qs.set("applicators", "rollon")');

        expect(graceRenderer).toContain("GraceProductTileGrid");
        expect(graceRenderer).toContain('data-testid="grace-product-tile-grid"');
        expect(graceRenderer).toContain("GraceProductCard");

        expect(pdp).toContain("sortCompatibleApplicatorSiblings");
        expect(pdp).toContain("compatibleApplicatorPriority");
    });
});
