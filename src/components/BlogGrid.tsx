"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock } from "@/components/icons";
import { urlFor } from "@/sanity/lib/image";

const CATEGORY_LABELS: Record<string, string> = {
    "packaging-101": "Packaging 101",
    "fragrance-guides": "Fragrance Guides",
    "brand-stories": "Brand Stories",
    "ingredient-science": "Ingredient Science",
    "how-to": "How-To",
    "industry-news": "Industry News",
};

export type JournalPost = {
    _id: string;
    title: string;
    slug: string;
    category?: string;
    publishedAt?: string;
    estimatedReadTime?: number;
    excerpt?: string;
    image?: { asset?: { _ref: string }; _type?: string } | null;
};

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-sm overflow-hidden border border-champagne/50 bg-white hover:border-muted-gold/50 hover:shadow-xl transition-all duration-500">
                    <div className="relative aspect-[16/10] sm:aspect-[4/3] md:aspect-auto md:min-h-[320px] bg-travertine">
                        {imgSrc ? (
                            <Image
                                src={imgSrc}
                                alt={post.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                unoptimized
                                sizes="(max-width: 768px) 100vw, 50vw"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-travertine to-champagne/30" />
                        )}
                    </div>
                    <div className="p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
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
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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

export default function BlogGrid({
    posts,
}: {
    posts: JournalPost[];
}) {
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [featured, ...rest] = posts;

    const filtered = activeCategory
        ? rest.filter((p) => p.category === activeCategory)
        : rest;

    const CATEGORIES = Object.entries(CATEGORY_LABELS);

    return (
        <>
            {featured && (
                <section>
                    <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate mb-6">
                        Featured
                    </p>
                    <ArticleCard post={featured} featured />
                </section>
            )}

            {rest.length > 0 && (
                <section>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-8 sm:mb-10">
                        <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate shrink-0">
                            Browse by topic
                        </span>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0 hide-scroll">
                            <button
                                type="button"
                                onClick={() => setActiveCategory(null)}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-colors duration-200 whitespace-nowrap ${
                                    activeCategory === null
                                        ? "bg-muted-gold text-white border border-muted-gold"
                                        : "border border-champagne text-slate hover:border-muted-gold hover:text-muted-gold"
                                }`}
                            >
                                All
                            </button>
                            {CATEGORIES.map(([value, label]) => {
                                const count = rest.filter((p) => p.category === value).length;
                                if (count === 0) return null;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setActiveCategory(activeCategory === value ? null : value)}
                                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-colors duration-200 whitespace-nowrap ${
                                            activeCategory === value
                                                ? "bg-muted-gold text-white border border-muted-gold"
                                                : "border border-champagne text-slate hover:border-muted-gold hover:text-muted-gold"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                        {filtered.map((post) => (
                            <ArticleCard key={post._id} post={post} />
                        ))}
                    </div>

                    {filtered.length === 0 && (
                        <p className="text-center text-slate py-12">
                            No articles in this category yet.
                        </p>
                    )}
                </section>
            )}
        </>
    );
}
