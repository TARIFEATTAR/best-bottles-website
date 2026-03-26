/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://www.bestbottles.com",
  generateRobotsTxt: true,
  generateIndexSitemap: true,
  changefreq: "weekly",
  priority: 0.7,
  sitemapSize: 5000,

  robotsTxtOptions: {
    policies: [
      { userAgent: "*", allow: "/" },
      { userAgent: "*", disallow: ["/api/", "/portal/", "/studio/", "/sign-in/", "/_next/"] },
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
    ],
    additionalSitemaps: [
      "https://www.bestbottles.com/server-sitemap.xml",
    ],
  },

  exclude: [
    "/api/*",
    "/portal/*",
    "/studio/*",
    "/sign-in/*",
    "/example",
    "/fitment-demo",
  ],
};
