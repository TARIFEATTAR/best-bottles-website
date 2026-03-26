/**
 * SEO constants and utilities for Best Bottles.
 *
 * Centralizes site metadata, structured data builders, and canonical URL
 * logic so every page stays consistent without duplication.
 */

export const SITE_URL = "https://www.bestbottles.com";
export const SITE_NAME = "Best Bottles";
export const SITE_TAGLINE = "Premium Glass Packaging for Beauty, Fragrance & Wellness Brands";
export const SITE_DESCRIPTION =
  "2,300+ premium glass bottles, sprayers, and packaging components from Nemat International. 20+ years of expertise. Low MOQs, volume pricing, and dedicated support for scaling brands.";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

// ─── Structured Data Builders ────────────────────────────────────────────────

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Best Bottles",
    alternateName: "Nemat International",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: SITE_DESCRIPTION,
    foundingDate: "2003",
    numberOfEmployees: { "@type": "QuantitativeValue", minValue: 10, maxValue: 50 },
    address: {
      "@type": "PostalAddress",
      addressCountry: "US",
    },
    sameAs: [
      "https://www.instagram.com/bestbottles",
      "https://www.linkedin.com/company/nemat-international",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: "sales@bestbottles.com",
    },
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/catalog?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface ProductJsonLdInput {
  name: string;
  description: string;
  sku: string;
  image?: string;
  url: string;
  family: string;
  priceLow?: number | null;
  priceHigh?: number | null;
  inStock?: boolean;
  neckThreadSize?: string;
  capacity?: string;
  material?: string;
}

export function buildProductJsonLd(p: ProductJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.sku,
    brand: { "@type": "Brand", name: "Best Bottles" },
    category: p.family,
    ...(p.image && { image: p.image }),
    url: p.url,
    ...(p.neckThreadSize && {
      additionalProperty: [
        { "@type": "PropertyValue", name: "Neck Thread Size", value: p.neckThreadSize },
        ...(p.capacity ? [{ "@type": "PropertyValue", name: "Capacity", value: p.capacity }] : []),
        ...(p.material ? [{ "@type": "PropertyValue", name: "Material", value: p.material }] : []),
      ],
    }),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      ...(p.priceLow != null && { lowPrice: p.priceLow.toFixed(2) }),
      ...(p.priceHigh != null && { highPrice: p.priceHigh.toFixed(2) }),
      availability: p.inStock !== false
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "Best Bottles" },
    },
  };
}

export function buildCollectionPageJsonLd(input: {
  name: string;
  description: string;
  url: string;
  itemCount: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: input.url,
    numberOfItems: input.itemCount,
    provider: { "@type": "Organization", name: "Best Bottles" },
  };
}
