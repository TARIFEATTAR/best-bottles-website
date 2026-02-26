import type { Metadata } from "next";
import { EB_Garamond, Inter } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { CartProvider } from "@/components/CartProvider";
import GraceProvider from "@/components/GraceProvider";
import GraceSidePanel, { GraceFloatingTrigger } from "@/components/GraceSidePanel";

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
  description: "3,100+ premium glass bottles, sprayers, and packaging components. 170 years of expertise. Low MOQs, volume pricing, and dedicated support for scaling brands.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${ebGaramond.variable} ${inter.variable} antialiased selection:bg-muted-gold/20 selection:text-obsidian`}>
        <ConvexClientProvider>
          <CartProvider>
            <GraceProvider>
              {children}
              <GraceSidePanel />
              <GraceFloatingTrigger />
            </GraceProvider>
          </CartProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
