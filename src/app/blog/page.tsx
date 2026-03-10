import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import Navbar from "@/components/Navbar";
import BlogGrid, { type JournalPost } from "@/components/BlogGrid";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { JOURNAL_POSTS_QUERY } from "@/sanity/lib/queries";

export const revalidate = 60;

export const metadata: Metadata = {
    title: "Journal — Packaging Insights & Brand Guides | Best Bottles",
    description:
        "Expert guides on glass packaging, fragrance, and brand strategy. From bottle selection to scaling your label — insights from the Best Bottles team.",
};

async function getPosts(): Promise<JournalPost[]> {
    if (!isSanityConfigured) return [];
    try {
        const raw = await client.fetch<JournalPost[]>(JOURNAL_POSTS_QUERY);
        return raw.filter((p): p is JournalPost => Boolean(p.slug));
    } catch {
        return [];
    }
}

export default async function BlogPage() {
    const posts = await getPosts();

    return (
        <div className="min-h-screen bg-bone">
            <Navbar />

            {/* Hero */}
            <section className="pt-24 sm:pt-28 lg:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 border-b border-champagne/30">
                <div className="max-w-[1100px] mx-auto">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-gold font-bold mb-3 sm:mb-4">
                        From the Lab
                    </p>
                    <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-obsidian font-medium mb-3 sm:mb-4 leading-tight">
                        Journal
                    </h1>
                    <p className="text-slate text-[15px] sm:text-base max-w-[520px] leading-relaxed">
                        Expert guides on glass packaging, fragrance, and brand strategy — from the Best Bottles team.
                    </p>
                </div>
            </section>

            <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20 space-y-16 sm:space-y-20">

                {posts.length === 0 ? (
                    /* Empty state */
                    <div className="text-center py-24 sm:py-32">
                        <div className="w-16 h-16 rounded-full bg-champagne/30 flex items-center justify-center mx-auto mb-6">
                            <ArrowRight className="w-6 h-6 text-muted-gold" />
                        </div>
                        <h2 className="font-serif text-2xl sm:text-3xl text-obsidian mb-3">Articles coming soon</h2>
                        <p className="text-slate text-sm sm:text-base max-w-[360px] mx-auto mb-8 px-4">
                            We&apos;re working on guides, deep-dives, and brand stories. Check back soon.
                        </p>
                        <Link
                            href="/catalog"
                            className="inline-flex items-center gap-2 bg-obsidian text-white text-xs uppercase font-bold tracking-wider px-6 py-3 rounded hover:bg-muted-gold transition-colors duration-200"
                        >
                            Browse the Catalog <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                ) : (
                    <BlogGrid posts={posts} />
                )}
            </div>

            {/* Bottom CTA */}
            <section className="border-t border-champagne/30 bg-white/50 py-10 sm:py-16 px-4 sm:px-6">
                <div className="max-w-[600px] mx-auto text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-3">Ready to shop?</p>
                    <h2 className="font-serif text-xl sm:text-3xl text-obsidian mb-4 leading-tight">Find the right bottle for your brand</h2>
                    <p className="text-slate text-sm leading-relaxed mb-6 sm:mb-8">
                        2,300+ premium glass bottles. Filter by shape, size, color, and closure compatibility.
                    </p>
                    <Link
                        href="/catalog"
                        className="inline-flex items-center gap-2 bg-obsidian text-white text-xs uppercase font-bold tracking-wider px-6 sm:px-8 py-3 sm:py-4 rounded hover:bg-muted-gold transition-colors duration-200"
                    >
                        Browse the Catalog <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
