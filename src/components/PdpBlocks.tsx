"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import {
    Shield, Droplets, Sun, Leaf, Zap, Award, FlaskConical,
    Package, Recycle, Layers, Check, Star, Clock, Sparkles,
    Tag, Globe, CaretDown, CaretRight,
} from "@/components/icons";
import { urlFor } from "@/sanity/lib/image";

// ─── Shared types ─────────────────────────────────────────────────────────────

type SanityImage = { asset?: { _ref: string }; _type?: string } | null | undefined;

export type PdpFeatureStripBlock = {
    _type: "pdpFeatureStrip";
    _key: string;
    items: Array<{ _key: string; icon: string; label: string; body?: string }>;
};

export type PdpRichDescriptionBlock = {
    _type: "pdpRichDescription";
    _key: string;
    eyebrow?: string;
    heading?: string;
    body: unknown[];
};

export type PdpGalleryRowBlock = {
    _type: "pdpGalleryRow";
    _key: string;
    eyebrow?: string;
    images: Array<{ _key: string; image: SanityImage; alt: string; caption?: string }>;
    layout?: "scroll" | "grid";
};

export type PdpPromoBannerBlock = {
    _type: "pdpPromoBanner";
    _key: string;
    style?: "subtle" | "bold" | "urgent";
    eyebrow?: string;
    headline: string;
    body?: string;
    ctaText?: string;
    ctaHref?: string;
    countdownEndDate?: string;
    countdownLabel?: string;
};

export type PdpFaqAccordionBlock = {
    _type: "pdpFaqAccordion";
    _key: string;
    eyebrow?: string;
    heading?: string;
    items: Array<{ _key: string; question: string; answer: unknown[] }>;
};

export type PdpTrustBadgesBlock = {
    _type: "pdpTrustBadges";
    _key: string;
    badges: Array<{ _key: string; label: string; style?: "default" | "gold" | "dark" | "green" }>;
};

export type PdpBlock =
    | PdpFeatureStripBlock
    | PdpRichDescriptionBlock
    | PdpGalleryRowBlock
    | PdpPromoBannerBlock
    | PdpFaqAccordionBlock
    | PdpTrustBadgesBlock;

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
    Shield, Droplets, Sun, Leaf, Zap, Award, FlaskConical,
    Package, Recycle, Layers, Check, Star, Clock, Sparkles, Tag, Globe,
};

function FeatureIcon({ name, className }: { name: string; className?: string }) {
    const Icon = ICON_MAP[name] ?? Shield;
    return <Icon className={className ?? ""} size={20} weight="regular" />;
}

// ─── Portable Text components (shared across blocks) ──────────────────────────

const ptComponents: PortableTextComponents = {
    block: {
        normal: ({ children }) => (
            <p className="text-slate leading-[1.8] mb-4 text-[14.5px]">{children}</p>
        ),
        h3: ({ children }) => (
            <h3 className="font-serif text-xl text-obsidian font-medium mt-6 mb-3">{children}</h3>
        ),
        blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-muted-gold pl-5 my-5 italic font-serif text-lg text-obsidian/70">
                {children}
            </blockquote>
        ),
    },
    list: {
        bullet: ({ children }) => <ul className="mb-4 space-y-2">{children}</ul>,
        number: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-2">{children}</ol>,
    },
    listItem: {
        bullet: ({ children }) => (
            <li className="flex items-start gap-2.5 text-slate text-[14px] leading-relaxed">
                <span className="w-1 h-1 rounded-full bg-muted-gold mt-2.5 shrink-0" />
                <span>{children}</span>
            </li>
        ),
        number: ({ children }) => (
            <li className="text-slate text-[14px] leading-relaxed">{children}</li>
        ),
    },
    marks: {
        strong: ({ children }) => <strong className="font-semibold text-obsidian">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        underline: ({ children }) => <span className="underline">{children}</span>,
        link: ({ children, value }) => (
            <a
                href={value?.href}
                target={value?.href?.startsWith("http") ? "_blank" : undefined}
                rel={value?.href?.startsWith("http") ? "noopener noreferrer" : undefined}
                className="text-muted-gold underline underline-offset-2 hover:text-obsidian transition-colors"
            >
                {children}
            </a>
        ),
    },
};

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(endDate: string | undefined) {
    const [remaining, setRemaining] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

    useEffect(() => {
        if (!endDate) return;
        const target = new Date(endDate).getTime();

        function calc() {
            const diff = target - Date.now();
            if (diff <= 0) { setRemaining({ d: 0, h: 0, m: 0, s: 0 }); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining({ d, h, m, s });
        }
        calc();
        const id = setInterval(calc, 1000);
        return () => clearInterval(id);
    }, [endDate]);

    return remaining;
}

// ─── Block components ─────────────────────────────────────────────────────────

function FeatureStripBlock({ block }: { block: PdpFeatureStripBlock }) {
    return (
        <div className="py-8 border-t border-champagne/40">
            <div className="flex gap-6 overflow-x-auto pb-2 hide-scroll">
                {block.items.map((item) => (
                    <div
                        key={item._key}
                        className="flex flex-col items-center text-center gap-2.5 min-w-[90px] group"
                        title={item.body}
                    >
                        <div className="w-10 h-10 rounded-full bg-muted-gold/10 flex items-center justify-center group-hover:bg-muted-gold/20 transition-colors duration-200">
                            <FeatureIcon name={item.icon} className="w-5 h-5 text-muted-gold" />
                        </div>
                        <p className="text-[11px] font-semibold text-obsidian leading-tight">{item.label}</p>
                        {item.body && (
                            <p className="text-[10px] text-slate/70 leading-snug">{item.body}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function RichDescriptionBlock({ block }: { block: PdpRichDescriptionBlock }) {
    return (
        <div className="py-8 border-t border-champagne/40">
            {block.eyebrow && (
                <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted-gold mb-3">
                    {block.eyebrow}
                </p>
            )}
            {block.heading && (
                <h2 className="font-serif text-2xl text-obsidian font-medium mb-5">{block.heading}</h2>
            )}
            {block.body && (
                <PortableText
                    value={block.body as Parameters<typeof PortableText>[0]["value"]}
                    components={ptComponents}
                />
            )}
        </div>
    );
}

function GalleryRowBlock({ block }: { block: PdpGalleryRowBlock }) {
    const [lightbox, setLightbox] = useState<number | null>(null);
    const isGrid = block.layout === "grid";

    return (
        <div className="py-8 border-t border-champagne/40">
            {block.eyebrow && (
                <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate mb-5">
                    {block.eyebrow}
                </p>
            )}

            {isGrid ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {block.images.map((img, i) => {
                        const src = img.image ? urlFor(img.image) : null;
                        if (!src) return null;
                        return (
                            <button
                                key={img._key}
                                onClick={() => setLightbox(i)}
                                className="group relative aspect-square rounded-sm overflow-hidden bg-travertine border border-champagne/40 hover:border-muted-gold/50 transition-colors"
                            >
                                <Image src={src} alt={img.alt} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                                {img.caption && (
                                    <div className="absolute bottom-0 inset-x-0 bg-obsidian/60 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-[10px] text-white/90 truncate">{img.caption}</p>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-3 hide-scroll -mx-1 px-1">
                    {block.images.map((img, i) => {
                        const src = img.image ? urlFor(img.image) : null;
                        if (!src) return null;
                        return (
                            <button
                                key={img._key}
                                onClick={() => setLightbox(i)}
                                className="group relative shrink-0 w-48 sm:w-56 aspect-[4/3] rounded-sm overflow-hidden bg-travertine border border-champagne/40 hover:border-muted-gold/50 transition-colors"
                            >
                                <Image src={src} alt={img.alt} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Lightbox */}
            {lightbox !== null && (
                <div
                    className="fixed inset-0 z-[200] bg-obsidian/90 flex items-center justify-center p-4"
                    onClick={() => setLightbox(null)}
                >
                    <div className="relative max-w-4xl w-full max-h-[85vh] aspect-[4/3]" onClick={(e) => e.stopPropagation()}>
                        {block.images[lightbox]?.image && (
                            <Image
                                src={urlFor(block.images[lightbox].image) ?? ""}
                                alt={block.images[lightbox].alt}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        )}
                        {block.images[lightbox]?.caption && (
                            <p className="absolute bottom-0 inset-x-0 text-center text-white/70 text-xs py-2 bg-obsidian/40">{block.images[lightbox].caption}</p>
                        )}
                        <button
                            onClick={() => setLightbox(null)}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm transition-colors"
                            aria-label="Close"
                        >✕</button>
                        {lightbox > 0 && (
                            <button onClick={() => setLightbox(l => (l ?? 1) - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">‹</button>
                        )}
                        {lightbox < block.images.length - 1 && (
                            <button onClick={() => setLightbox(l => (l ?? 0) + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">›</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function CountdownDisplay({ endDate, label }: { endDate: string; label?: string }) {
    const t = useCountdown(endDate);
    if (!t) return null;
    const expired = t.d === 0 && t.h === 0 && t.m === 0 && t.s === 0;
    if (expired) return null;

    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {t.d > 0 && (
                <span className="font-mono text-sm font-bold">{t.d}d</span>
            )}
            <span className="font-mono text-sm font-bold">{pad(t.h)}h</span>
            <span className="font-mono text-sm font-bold">{pad(t.m)}m</span>
            <span className="font-mono text-sm font-bold tabular-nums">{pad(t.s)}s</span>
            {label && <span className="text-xs opacity-75 ml-1">{label}</span>}
        </div>
    );
}

function PromoBannerBlock({ block }: { block: PdpPromoBannerBlock }) {
    const styleMap = {
        subtle: "bg-muted-gold/8 border border-muted-gold/30 text-obsidian",
        bold: "bg-obsidian text-white border border-obsidian",
        urgent: "bg-muted-gold text-obsidian border border-muted-gold",
    };
    const s = block.style ?? "subtle";

    return (
        <div className={`rounded-sm px-6 py-5 my-2 ${styleMap[s]}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                    {block.eyebrow && (
                        <p className={`text-[10px] uppercase tracking-[0.22em] font-bold mb-1.5 ${s === "bold" ? "text-muted-gold" : "opacity-70"}`}>
                            {block.eyebrow}
                        </p>
                    )}
                    <p className="font-serif text-lg font-medium leading-snug">{block.headline}</p>
                    {block.body && (
                        <p className={`text-sm mt-1 leading-relaxed ${s === "bold" ? "text-white/70" : "opacity-75"}`}>
                            {block.body}
                        </p>
                    )}
                    {block.countdownEndDate && (
                        <div className={`mt-2 ${s === "bold" ? "text-white" : ""}`}>
                            <CountdownDisplay endDate={block.countdownEndDate} label={block.countdownLabel} />
                        </div>
                    )}
                </div>
                {block.ctaText && block.ctaHref && (
                    <Link
                        href={block.ctaHref}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                            s === "bold"
                                ? "bg-muted-gold text-obsidian hover:bg-white hover:text-obsidian"
                                : "bg-obsidian text-white hover:bg-muted-gold hover:text-obsidian"
                        }`}
                    >
                        {block.ctaText} <CaretRight size={14} />
                    </Link>
                )}
            </div>
        </div>
    );
}

function FaqAccordionBlock({ block }: { block: PdpFaqAccordionBlock }) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    return (
        <div className="py-8 border-t border-champagne/40">
            {block.eyebrow && (
                <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted-gold mb-3">
                    {block.eyebrow}
                </p>
            )}
            {block.heading && (
                <h2 className="font-serif text-2xl text-obsidian font-medium mb-6">{block.heading}</h2>
            )}
            <div className="divide-y divide-champagne/40">
                {block.items.map((item, i) => (
                    <div key={item._key}>
                        <button
                            onClick={() => setOpenIdx(openIdx === i ? null : i)}
                            className="w-full flex items-start justify-between gap-4 py-4 text-left group"
                        >
                            <span className="font-serif text-[15px] text-obsidian font-medium leading-snug group-hover:text-muted-gold transition-colors">
                                {item.question}
                            </span>
                            <CaretDown
                                className={`text-slate shrink-0 mt-0.5 transition-transform duration-200 ${openIdx === i ? "rotate-180" : ""}`}
                                size={16}
                            />
                        </button>
                        {openIdx === i && item.answer && (
                            <div className="pb-4 pl-0 pr-6">
                                <PortableText
                                    value={item.answer as Parameters<typeof PortableText>[0]["value"]}
                                    components={ptComponents}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function TrustBadgesBlock({ block }: { block: PdpTrustBadgesBlock }) {
    const styleMap: Record<string, string> = {
        default: "border border-champagne text-slate bg-white",
        gold: "border border-muted-gold/60 text-muted-gold bg-muted-gold/8",
        dark: "bg-obsidian text-white border border-obsidian",
        green: "border border-emerald-200 text-emerald-700 bg-emerald-50",
    };

    return (
        <div className="flex flex-wrap gap-2 py-4">
            {block.badges.map((badge) => (
                <span
                    key={badge._key}
                    className={`inline-flex items-center px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full ${styleMap[badge.style ?? "default"]}`}
                >
                    {badge.label}
                </span>
            ))}
        </div>
    );
}

// ─── Zone renderers ───────────────────────────────────────────────────────────

/**
 * Renders trust-badge blocks inline (for use in the right column, near the title).
 */
export function PdpInlineBadges({ blocks }: { blocks: PdpBlock[] }) {
    const badgeBlocks = blocks.filter((b): b is PdpTrustBadgesBlock => b._type === "pdpTrustBadges");
    if (badgeBlocks.length === 0) return null;
    return (
        <>
            {badgeBlocks.map((b) => (
                <TrustBadgesBlock key={b._key} block={b} />
            ))}
        </>
    );
}

/**
 * Renders promo-banner blocks inline (for use in the right column, above Add to Cart).
 */
export function PdpInlinePromo({ blocks }: { blocks: PdpBlock[] }) {
    const promoBlocks = blocks.filter((b): b is PdpPromoBannerBlock => b._type === "pdpPromoBanner");
    if (promoBlocks.length === 0) return null;
    return (
        <div className="mb-5 space-y-3">
            {promoBlocks.map((b) => (
                <PromoBannerBlock key={b._key} block={b} />
            ))}
        </div>
    );
}

/**
 * Renders the full editorial zone (all blocks except trust badges and promo banners,
 * which are already shown inline in the right column above).
 * Rendered full-width below the product hero.
 */
export function PdpEditorialZone({ blocks }: { blocks: PdpBlock[] }) {
    const editorial = blocks.filter(
        (b) => b._type !== "pdpTrustBadges" && b._type !== "pdpPromoBanner"
    );
    if (editorial.length === 0) return null;

    return (
        <section className="border-t border-champagne/30">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2">
                {editorial.map((block) => {
                    switch (block._type) {
                        case "pdpFeatureStrip":
                            return <FeatureStripBlock key={block._key} block={block} />;
                        case "pdpRichDescription":
                            return <RichDescriptionBlock key={block._key} block={block} />;
                        case "pdpGalleryRow":
                            return <GalleryRowBlock key={block._key} block={block} />;
                        case "pdpFaqAccordion":
                            return <FaqAccordionBlock key={block._key} block={block} />;
                        default:
                            return null;
                    }
                })}
            </div>
        </section>
    );
}
