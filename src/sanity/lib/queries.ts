// Homepage query (singleton: uses "homepage" if present, else first homepagePage)
export const HOMEPAGE_QUERY = `
  *[_type == "homepagePage"][0] {
    heroSlides[] {
      mediaType,
      image,
      video {
        asset-> {
          url
        }
      },
      videoPoster,
      headline,
      subheadline,
      eyebrow,
      ctaText,
      ctaHref
    },
    startHereEyebrow,
    startHereTitle,
    startHereSubheading,
    startHereCards[] {
      title,
      subtitle,
      href,
      image,
      backgroundColor
    },
    designFamilyCards[] | order(order asc) {
      family,
      title,
      image,
      order
    },
    educationPreview {
      sectionTitle,
      sectionEyebrow,
      featuredArticles[]-> {
        _id,
        title,
        "slug": slug.current,
        category,
        excerpt,
        image
      },
      viewAllHref
    },
    megaMenuPanels {
      bottles {
        featuredImage,
        title,
        subtitle,
        href
      },
      closures {
        featuredImage,
        title,
        subtitle,
        href
      },
      specialty {
        featuredImage,
        title,
        subtitle,
        href
      }
    }
  }
`;

// Journal article queries

export const JOURNAL_POSTS_QUERY = `
  *[_type == "journal" && defined(slug.current)] | order(publishedAt desc) {
    _id,
    title,
    "slug": slug.current,
    category,
    publishedAt,
    estimatedReadTime,
    excerpt,
    image,
    generationSource,
  }
`;

export const JOURNAL_POST_QUERY = `
  *[_type == "journal" && slug.current == $slug][0] {
    _id,
    title,
    "slug": slug.current,
    category,
    publishedAt,
    estimatedReadTime,
    excerpt,
    image,
    content,
    generationSource,
    relatedProducts[]-> {
      _id,
      title,
      "slug": shopifyHandle.current,
    },
  }
`;

export const JOURNAL_SLUGS_QUERY = `
  *[_type == "journal" && defined(slug.current)] {
    "slug": slug.current
  }
`;

import { client, isSanityConfigured } from "./client";

// Mega menu panels only (for Navbar)
export const MEGA_MENU_QUERY = `
  *[_type == "homepagePage"][0] {
    megaMenuPanels {
      bottles { featuredImage, title, subtitle, href },
      closures { featuredImage, title, subtitle, href },
      specialty { featuredImage, title, subtitle, href }
    }
  }
`;

// Fetch homepage data (returns null if no document exists or Sanity not configured)
export async function getHomepageData(): Promise<HomepageData | null> {
    if (!isSanityConfigured) return null;
    try {
        return await client.fetch<HomepageData | null>(HOMEPAGE_QUERY);
    } catch {
        return null;
    }
}

// Fetch only mega menu panels (for Navbar)
export async function getMegaMenuPanels(): Promise<HomepageData["megaMenuPanels"] | null> {
    if (!isSanityConfigured) return null;
    try {
        const result = await client.fetch<{ megaMenuPanels?: HomepageData["megaMenuPanels"] } | null>(MEGA_MENU_QUERY);
        return result?.megaMenuPanels ?? null;
    } catch {
        return null;
    }
}

export type HomepageData = {
    heroSlides?: Array<{
        mediaType?: "image" | "video";
        image?: { asset?: { _ref: string }; _type: string };
        video?: { asset?: { url?: string } };
        videoPoster?: { asset?: { _ref: string } };
        headline?: string;
        subheadline?: string;
        eyebrow?: string;
        ctaText?: string;
        ctaHref?: string;
    }>;
    startHereEyebrow?: string;
    startHereTitle?: string;
    startHereSubheading?: string;
    startHereCards?: Array<{
        title: string;
        subtitle?: string;
        href: string;
        image?: { asset?: { _ref: string } };
        backgroundColor?: string;
    }>;
    designFamilyCards?: Array<{
        family: string;
        title: string;
        image?: { asset?: { _ref: string } };
        order?: number;
    }>;
    educationPreview?: {
        sectionTitle?: string;
        sectionEyebrow?: string;
        featuredArticles?: Array<{
            _id: string;
            title: string;
            slug?: string;
            category?: string;
            excerpt?: string;
            image?: { asset?: { _ref: string } };
        }>;
        viewAllHref?: string;
    };
    megaMenuPanels?: {
        bottles?: { featuredImage?: { asset?: { _ref: string } }; title?: string; subtitle?: string; href?: string };
        closures?: { featuredImage?: { asset?: { _ref: string } }; title?: string; subtitle?: string; href?: string };
        specialty?: { featuredImage?: { asset?: { _ref: string } }; title?: string; subtitle?: string; href?: string };
    };
};
