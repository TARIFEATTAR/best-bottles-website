import type { Metadata } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import GraceProvider from "@/components/GraceProvider";
import GraceChatModal, { GraceFloatingTrigger } from "@/components/GraceChatModal";

const bodoniModa = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const jost = Jost({
  variable: "--font-jost",
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
      <body className={`${bodoniModa.variable} ${jost.variable} antialiased selection:bg-muted-gold/20 selection:text-obsidian`}>
        <ConvexClientProvider>
          <GraceProvider>
            {children}
            <GraceChatModal />
            <GraceFloatingTrigger />
          </GraceProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
