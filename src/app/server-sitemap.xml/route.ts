import { getServerSideSitemap, ISitemapField } from "next-sitemap";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { client as sanityClient, isSanityConfigured } from "@/sanity/lib/client";

const SITE_URL = "https://www.bestbottles.com";
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  const fields: ISitemapField[] = [];

  try {
    const groups = await convex.query(api.products.getAllCatalogGroups, {});
    for (const g of groups as Array<{ slug: string }>) {
      fields.push({
        loc: `${SITE_URL}/products/${g.slug}`,
        lastmod: new Date().toISOString(),
        changefreq: "weekly",
        priority: 0.8,
      });
    }
  } catch (e) {
    console.error("[Sitemap] Failed to fetch product groups:", e);
  }

  if (isSanityConfigured) {
    try {
      const posts = await sanityClient.fetch<Array<{ slug: string; publishedAt?: string }>>(
        `*[_type == "journalPost" && defined(slug.current)] | order(publishedAt desc) { "slug": slug.current, publishedAt }`
      );
      for (const p of posts) {
        fields.push({
          loc: `${SITE_URL}/blog/${p.slug}`,
          lastmod: p.publishedAt ? new Date(p.publishedAt).toISOString() : new Date().toISOString(),
          changefreq: "monthly",
          priority: 0.6,
        });
      }
    } catch (e) {
      console.error("[Sitemap] Failed to fetch blog posts:", e);
    }
  }

  return getServerSideSitemap(fields);
}
