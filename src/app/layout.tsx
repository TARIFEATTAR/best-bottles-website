import type { Metadata } from "next";
import { Suspense } from "react";
import { Cormorant, EB_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { CartProvider } from "@/components/CartProvider";
import MegaMenuLayoutWrapper from "@/components/MegaMenuLayoutWrapper";
import { GraceWidget } from "@/components/grace/GraceWidget";

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
  title: "Best Bottles — Premium Glass Packaging for Beauty, Fragrance & Wellness Brands",
  description: "2,300+ premium glass bottles, sprayers, and packaging components. 20+ years of expertise. Low MOQs, volume pricing, and dedicated support for scaling brands.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${cormorant.variable} ${ebGaramond.variable} ${inter.variable} antialiased selection:bg-muted-gold/20 selection:text-obsidian`}>
          <ConvexClientProvider>
            <CartProvider>
              <Suspense fallback={
                <div className="min-h-screen bg-bone flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-muted-gold/30 border-t-muted-gold rounded-full animate-spin" />
                </div>
              }>
                <MegaMenuLayoutWrapper>
                  {children}
                </MegaMenuLayoutWrapper>
              </Suspense>
              <Suspense><GraceWidget /></Suspense>
            </CartProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
