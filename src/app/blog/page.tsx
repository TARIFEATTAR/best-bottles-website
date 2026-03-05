import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import { JOURNAL_POSTS_QUERY } from "@/sanity/lib/queries";
import type { HomepageData } from "@/sanity/lib/queries";

export const revalidate = 60;

export const metadata: Metadata = {
    title: "Journal — Packaging Insights & Brand Guides | Best Bottles",
    description:
        "Expert guides on glass packaging, fragrance, and brand strategy. From bottle selection to scaling your label — insights from the Best Bottles team.",
};

type JournalPost = NonNullable<NonNullable<HomepageData["educationPreview"]>["featuredArticles"]>[number] & {
    publishedAt?: string;
    estimatedReadTime?: number;
};

const CATEGORY_LABELS: Record<string, string> = {
    "packaging-101": "Packaging 101",
    "fragrance-guides": "Fragrance Guides",
    "brand-stories": "Brand Stories",
    "ingredient-science": "Ingredient Science",
    "how-to": "How-To",
    "industry-news": "Industry News",
};

async function getPosts(): Promise<JournalPost[]> {
    if (!isSanityConfigured) return [];
    try {
        return await client.fetch<JournalPost[]>(JOURNAL_POSTS_QUERY);
    } catch {
        return [];
    }
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

function ArticleCard({ post, featured = false }: { post: JournalPost; featured?: boolean }) {
    const imgSrc = post.image ? urlFor(post.image) : null;
    const categoryLabel = post.category ? (CATEGORY_LABELS[post.category] ?? post.category) : null;

    if (featured) {
        return (
            <Link href={`/blog/${post.slug}`} className="group block">
                <div className="grid md:grid-cols-2 gap-0 rounded-sm overflow-hidden border border-champagne/50 bg-white hover:border-muted-gold/50 hover:shadow-xl transition-all duration-500">
                    <div className="relative aspect-[4/3] md:aspect-auto bg-travertine">
                        {imgSrc ? (
                            <Image
                                src={imgSrc}
                                alt={post.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                unoptimized
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-travertine to-champagne/30" />
                        )}
                    </div>
                    <div className="p-8 lg:p-12 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-4">
                            {categoryLabel && (
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-gold">
                                    {categoryLabel}
                                </span>
                            )}
                            {post.estimatedReadTime && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-champagne" />
                                    <span className="flex items-center gap-1 text-[10px] text-slate uppercase tracking-wider">
                                        <Clock className="w-3 h-3" />
                                        {post.estimatedReadTime} min read
                                    </span>
                                </>
                            )}
                        </div>
                        <h2 className="font-serif text-2xl lg:text-3xl text-obsidian leading-tight mb-4 group-hover:text-muted-gold transition-colors duration-300">
                            {post.title}
                        </h2>
                        {post.excerpt && (
                            <p className="text-slate text-sm leading-relaxed mb-6 line-clamp-3">
                                {post.excerpt}
                            </p>
                        )}
                        {post.publishedAt && (
                            <p className="text-xs text-slate/60 mb-6">{formatDate(post.publishedAt)}</p>
                        )}
                        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-obsidian group-hover:text-muted-gold transition-colors duration-200">
                            Read Article <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                    </div>
                </div>
            </Link>
        );
    }

    return (
        <Link href={`/blog/${post.slug}`} className="group block">
            <div className="rounded-sm overflow-hidden border border-champagne/50 bg-white hover:border-muted-gold/50 hover:shadow-lg transition-all duration-400 h-full flex flex-col">
                <div className="relative aspect-[3/2] bg-travertine overflow-hidden">
                    {imgSrc ? (
                        <Image
                            src={imgSrc}
                            alt={post.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-700"
                            unoptimized
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-travertine to-champagne/30" />
                    )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-2.5 mb-3">
                        {categoryLabel && (
                            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-gold">
                                {categoryLabel}
                            </span>
                        )}
                        {post.estimatedReadTime && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-champagne" />
                                <span className="flex items-center gap-1 text-[10px] text-slate uppercase tracking-wider">
                                    <Clock className="w-3 h-3" />
                                    {post.estimatedReadTime} min
                                </span>
                            </>
                        )}
                    </div>
                    <h3 className="font-serif text-lg text-obsidian leading-snug mb-3 group-hover:text-muted-gold transition-colors duration-200 flex-1">
                        {post.title}
                    </h3>
                    {post.excerpt && (
                        <p className="text-xs text-slate leading-relaxed line-clamp-2 mb-4">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-champagne/40">
                        {post.publishedAt && (
                            <span className="text-[10px] text-slate/50">{formatDate(post.publishedAt)}</span>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-obsidian group-hover:text-muted-gold transition-colors duration-200 ml-auto">
                            Read <ArrowRight className="w-3 h-3" />
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

export default async function BlogPage() {
    const posts = await getPosts();
    const [featured, ...rest] = posts;

    const CATEGORIES = Object.entries(CATEGORY_LABELS);

    return (
        <div className="min-h-screen bg-bone">
            <Navbar />

            {/* Hero */}
            <section className="pt-32 pb-16 px-6 border-b border-champagne/30">
                <div className="max-w-[1100px] mx-auto">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-gold font-bold mb-4">
                        From the Lab
                    </p>
                    <h1 className="font-serif text-5xl lg:text-6xl text-obsidian font-medium mb-4">
                        Journal
                    </h1>
                    <p className="text-slate max-w-[520px] leading-relaxed">
                        Expert guides on glass packaging, fragrance, and brand strategy — from the Best Bottles team.
                    </p>
                </div>
            </section>

            <div className="max-w-[1100px] mx-auto px-6 py-16 space-y-20">

                {posts.length === 0 ? (
                    /* Empty state */
                    <div className="text-center py-24">
                        <div className="w-16 h-16 rounded-full bg-champagne/30 flex items-center justify-center mx-auto mb-6">
                            <ArrowRight className="w-6 h-6 text-muted-gold" />
                        </div>
                        <h2 className="font-serif text-2xl text-obsidian mb-3">Articles coming soon</h2>
                        <p className="text-slate text-sm max-w-[360px] mx-auto mb-8">
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
                    <>
                        {/* Featured post */}
                        {featured && (
                            <section>
                                <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate mb-6">
                                    Featured
                                </p>
                                <ArticleCard post={featured} featured />
                            </section>
                        )}

                        {/* Category filter strip */}
                        {rest.length > 0 && (
                            <section>
                                <div className="flex items-center gap-4 mb-10 overflow-x-auto pb-2 -mx-2 px-2">
                                    <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate shrink-0">
                                        Browse by topic
                                    </span>
                                    <div className="flex gap-2 shrink-0">
                                        {CATEGORIES.map(([value, label]) => {
                                            const count = posts.filter((p) => p.category === value).length;
                                            if (count === 0) return null;
                                            return (
                                                <span
                                                    key={value}
                                                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-champagne rounded-full text-slate hover:border-muted-gold hover:text-muted-gold transition-colors duration-200 cursor-pointer whitespace-nowrap"
                                                >
                                                    {label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Article grid */}
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {rest.map((post) => (
                                        <ArticleCard key={post._id} post={post} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>

            {/* Bottom CTA */}
            <section className="border-t border-champagne/30 bg-white/50 py-16 px-6">
                <div className="max-w-[600px] mx-auto text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-3">Ready to shop?</p>
                    <h2 className="font-serif text-3xl text-obsidian mb-4">Find the right bottle for your brand</h2>
                    <p className="text-slate text-sm leading-relaxed mb-8">
                        3,100+ premium glass bottles. Filter by shape, size, color, and closure compatibility.
                    </p>
                    <Link
                        href="/catalog"
                        className="inline-flex items-center gap-2 bg-obsidian text-white text-xs uppercase font-bold tracking-wider px-8 py-4 rounded hover:bg-muted-gold transition-colors duration-200"
                    >
                        Browse the Catalog <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
