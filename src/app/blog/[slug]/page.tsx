import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import Navbar from "@/components/Navbar";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import { JOURNAL_POST_QUERY, JOURNAL_SLUGS_QUERY } from "@/sanity/lib/queries";

export const revalidate = 60;

type ArticleImage = { asset?: { _ref: string }; _type?: string } | null | undefined;

type JournalPost = {
    _id: string;
    title: string;
    slug: string;
    category?: string;
    publishedAt?: string;
    estimatedReadTime?: number;
    excerpt?: string;
    image?: ArticleImage;
    content?: unknown[];
    generationSource?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
    "packaging-101": "Packaging 101",
    "fragrance-guides": "Fragrance Guides",
    "brand-stories": "Brand Stories",
    "ingredient-science": "Ingredient Science",
    "how-to": "How-To",
    "industry-news": "Industry News",
};

async function getPost(slug: string): Promise<JournalPost | null> {
    if (!isSanityConfigured) return null;
    try {
        return await client.fetch<JournalPost | null>(JOURNAL_POST_QUERY, { slug });
    } catch {
        return null;
    }
}

export async function generateStaticParams() {
    if (!isSanityConfigured) return [];
    try {
        const slugs = await client.fetch<{ slug: string }[]>(JOURNAL_SLUGS_QUERY);
        return slugs.map((s) => ({ slug: s.slug }));
    } catch {
        return [];
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPost(slug);
    if (!post) return { title: "Article Not Found | Best Bottles Journal" };
    return {
        title: `${post.title} | Best Bottles Journal`,
        description: post.excerpt ?? `Read ${post.title} on the Best Bottles Journal.`,
        openGraph: {
            title: post.title,
            description: post.excerpt ?? "",
            images: post.image ? [{ url: urlFor(post.image) }] : [],
        },
    };
}

// ─── Portable Text Components ─────────────────────────────────────────────────

const ptComponents: PortableTextComponents = {
    block: {
        normal: ({ children }) => (
            <p className="text-slate leading-[1.85] mb-6 text-[15px]">{children}</p>
        ),
        h1: ({ children }) => (
            <h1 className="font-serif text-4xl text-obsidian font-medium mt-12 mb-5 leading-tight">{children}</h1>
        ),
        h2: ({ children }) => (
            <h2 className="font-serif text-3xl text-obsidian font-medium mt-10 mb-4 leading-tight">{children}</h2>
        ),
        h3: ({ children }) => (
            <h3 className="font-serif text-2xl text-obsidian font-medium mt-8 mb-3">{children}</h3>
        ),
        h4: ({ children }) => (
            <h4 className="font-sans text-base font-semibold text-obsidian mt-6 mb-2 uppercase tracking-wider">{children}</h4>
        ),
        blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-muted-gold pl-6 my-8 italic font-serif text-xl text-obsidian/70 leading-relaxed">
                {children}
            </blockquote>
        ),
    },
    list: {
        bullet: ({ children }) => (
            <ul className="list-none mb-6 space-y-2.5 pl-0">{children}</ul>
        ),
        number: ({ children }) => (
            <ol className="list-decimal pl-6 mb-6 space-y-2.5">{children}</ol>
        ),
    },
    listItem: {
        bullet: ({ children }) => (
            <li className="flex items-start gap-2.5 text-slate text-[15px] leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-gold mt-2.5 shrink-0" />
                <span>{children}</span>
            </li>
        ),
        number: ({ children }) => (
            <li className="text-slate text-[15px] leading-relaxed">{children}</li>
        ),
    },
    marks: {
        strong: ({ children }) => (
            <strong className="font-semibold text-obsidian">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children }) => (
            <code className="font-mono text-sm bg-travertine px-1.5 py-0.5 rounded text-obsidian">{children}</code>
        ),
        underline: ({ children }) => <span className="underline">{children}</span>,
        "strike-through": ({ children }) => <span className="line-through">{children}</span>,
        link: ({ children, value }) => (
            <a
                href={value?.href}
                target={value?.href?.startsWith("http") ? "_blank" : undefined}
                rel={value?.href?.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-muted-gold underline underline-offset-2 hover:text-obsidian transition-colors duration-200"
            >
                {children}
            </a>
        ),
    },
    types: {
        image: ({ value }: { value: { asset?: { _ref: string }; _type?: string; alt?: string; caption?: string } }) => {
            const src = urlFor(value);
            if (!src) return null;
            return (
                <figure className="my-10">
                    <div className="relative w-full aspect-[16/9] rounded-sm overflow-hidden bg-travertine">
                        <Image src={src} alt={value.alt ?? ""} fill className="object-cover" unoptimized />
                    </div>
                    {value.caption && (
                        <figcaption className="text-center text-xs text-slate/60 mt-3 italic">
                            {value.caption}
                        </figcaption>
                    )}
                </figure>
            );
        },
    },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogArticlePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPost(slug);
    if (!post) notFound();

    const imgSrc = post.image ? urlFor(post.image) : null;
    const categoryLabel = post.category ? (CATEGORY_LABELS[post.category] ?? post.category) : null;

    return (
        <div className="min-h-screen bg-bone">
            <Navbar />

            {/* Hero */}
            <section className="pt-24">
                {imgSrc && (
                    <div className="relative w-full aspect-[21/9] bg-travertine overflow-hidden max-h-[520px]">
                        <Image
                            src={imgSrc}
                            alt={post.title}
                            fill
                            className="object-cover"
                            priority
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-obsidian/60 via-obsidian/10 to-transparent" />
                    </div>
                )}

                {/* Meta bar */}
                <div className={`px-6 ${imgSrc ? "py-10 bg-white border-b border-champagne/40" : "pt-16 pb-10 border-b border-champagne/40"}`}>
                    <div className="max-w-[760px] mx-auto">
                        {/* Back */}
                        <Link
                            href="/blog"
                            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate hover:text-muted-gold transition-colors duration-200 mb-6"
                        >
                            <ArrowLeft className="w-3 h-3" /> Journal
                        </Link>

                        <div className="flex items-center gap-4 mb-5">
                            {categoryLabel && (
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-gold">
                                    {categoryLabel}
                                </span>
                            )}
                            {post.estimatedReadTime && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-champagne" />
                                    <span className="flex items-center gap-1.5 text-[10px] text-slate uppercase tracking-wider">
                                        <Clock className="w-3 h-3" />
                                        {post.estimatedReadTime} min read
                                    </span>
                                </>
                            )}
                            {post.publishedAt && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-champagne" />
                                    <span className="flex items-center gap-1.5 text-[10px] text-slate uppercase tracking-wider">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(post.publishedAt).toLocaleDateString("en-US", {
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </span>
                                </>
                            )}
                        </div>

                        <h1 className="font-serif text-4xl lg:text-5xl text-obsidian font-medium leading-tight mb-4">
                            {post.title}
                        </h1>
                        {post.excerpt && (
                            <p className="text-slate text-lg leading-relaxed">{post.excerpt}</p>
                        )}
                    </div>
                </div>
            </section>

            {/* Article body */}
            <section className="px-6 py-16">
                <div className="max-w-[760px] mx-auto">
                    {post.content && post.content.length > 0 ? (
                        <PortableText value={post.content as Parameters<typeof PortableText>[0]["value"]} components={ptComponents} />
                    ) : (
                        <p className="text-slate italic">Content coming soon.</p>
                    )}
                </div>
            </section>

            {/* Footer CTA */}
            <section className="border-t border-champagne/30 bg-white/50 py-16 px-6">
                <div className="max-w-[600px] mx-auto text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-3">
                        Ready to source?
                    </p>
                    <h2 className="font-serif text-3xl text-obsidian mb-4">
                        Find the bottle behind the brand
                    </h2>
                    <p className="text-slate text-sm leading-relaxed mb-8">
                        3,100+ premium glass bottles. Filter by shape, size, color, and closure compatibility.
                    </p>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        <Link
                            href="/catalog"
                            className="inline-flex items-center gap-2 bg-obsidian text-white text-xs uppercase font-bold tracking-wider px-8 py-4 rounded hover:bg-muted-gold transition-colors duration-200"
                        >
                            Browse the Catalog
                        </Link>
                        <Link
                            href="/blog"
                            className="inline-flex items-center gap-2 border border-champagne text-obsidian text-xs uppercase font-bold tracking-wider px-8 py-4 rounded hover:border-muted-gold hover:text-muted-gold transition-colors duration-200"
                        >
                            <ArrowLeft className="w-3 h-3" /> More Articles
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
