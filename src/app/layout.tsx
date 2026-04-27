import type { Metadata } from "next";
import { Cormorant, EB_Garamond, Inter } from "next/font/google";
import "./globals.css";
import AppProviders from "@/components/AppProviders";
import { getMegaMenuPanels } from "@/sanity/lib/queries";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "@/lib/seo";

const cormorant = Cormorant({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "glass bottles wholesale",
    "perfume bottles",
    "essential oil bottles",
    "roll-on bottles",
    "boston round bottles",
    "euro dropper bottles",
    "glass packaging",
    "beauty packaging",
    "fragrance bottles",
    "wholesale packaging",
    "spray bottles",
    "dropper bottles",
    "cosmetic packaging",
    "Nemat International",
    "Best Bottles",
  ],
  authors: [{ name: "Best Bottles", url: SITE_URL }],
  creator: "Nemat International",
  publisher: "Best Bottles",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  verification: {},
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch mega-menu panels on the server (Sanity) and pass to the client-side
  // provider via props. Lets AppProviders stay a Client Component without
  // rendering an async Server Component inside it (which Next.js disallows).
  const megaMenuPanels = await getMegaMenuPanels();

  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${ebGaramond.variable} ${inter.variable} antialiased selection:bg-muted-gold/20 selection:text-obsidian`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebSiteJsonLd()) }}
        />
        <AppProviders megaMenuPanels={megaMenuPanels}>{children}</AppProviders>
      </body>
    </html>
  );
}
