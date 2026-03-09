"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Zap, ShoppingBag, Search, Compass, ChevronRight, Check, ShieldCheck, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import { useGrace } from "@/components/useGrace";
import { urlFor } from "@/sanity/lib/image";
import type { HomepageData } from "@/sanity/lib/queries";
import { APPLICATOR_NAV, applicatorNavHref, applicatorNavHrefMulti } from "@/lib/catalogFilters";
import type { ApplicatorNavValue } from "@/lib/catalogFilters";

const FadeUp = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
        className={className}
    >
        {children}
    </motion.div>
);

const DEFAULT_START_HERE = [
    { title: "essential oils & roll-ons", subtitle: "Roller-ready bottles for oils, topicals, and fragrance oils.", href: applicatorNavHref("rollon"), img: "/assets/vintage-spray.png", bg: "#DFD6C9" },
    { title: "skincare & serums", subtitle: "Dropper and pump formats for treatment-focused formulas.", href: applicatorNavHrefMulti(["dropper", "lotionpump"]), img: "/assets/collection_skincare.png", bg: "#EADDD1" },
    { title: "sample & discovery", subtitle: "Vials and compact formats for trial, travel, and discovery kits.", href: "/catalog?families=Vial", img: "/assets/Hero-BB.png", bg: "#EAE0D5" },
    { title: "gift & retail packaging", subtitle: "Presentation-ready packaging for launches, gifting, and retail shelves.", href: "/catalog?category=Packaging", img: "/assets/collection_amber.png", bg: "#F3E5D8" },
    { title: "components & closures", subtitle: "Caps, droppers, pumps, and fitments matched by thread size.", href: "/catalog?category=Component", img: "/assets/bottle_screwcap.png", bg: "#DCD0C0" },
    { title: "fine mist & spray bottles", subtitle: "Spray-forward bottle families for fragrance and room scent formats.", href: applicatorNavHref("spray"), img: "/assets/Cylinder-BB.png", bg: "#D5C5B1" },
];

const DEFAULT_FAMILIES = [
    { family: "Cylinder", title: "Cylinder", img: "/assets/Cylinder-BB.png" },
    { family: "Diva", title: "Diva", img: "/assets/collection_perfume.png" },
    { family: "Elegant", title: "Elegant", img: "/assets/vintage-spray.png" },
    { family: "Empire", title: "Empire", img: "/assets/collection_amber.png" },
    { family: "Boston Round", title: "Boston Round", img: "/assets/bottle_screwcap.png" },
    { family: "Round", title: "Round", img: "/assets/collection_skincare.png" },
    { family: "Sleek", title: "Sleek", img: "/assets/Slim-BB.png" },
    { family: "Circle", title: "Circle", img: "/assets/collection_skincare.png" },
    { family: "Atomizer", title: "Atomizers", img: "/assets/vintage-spray.png" },
];

const DEFAULT_ARTICLES = [
    { title: "Glass vs. Plastic: Why Material Matters for Your Brand", category: "Materials", excerpt: "Expert insights and strategies to elevate your brand's packaging presence.", img: "/assets/collection_perfume.png", slug: "/blog" },
    { title: "Finding Your Thread: A Complete Neck Size Compatibility Guide", category: "Technical", excerpt: "Expert insights and strategies to elevate your brand's packaging presence.", img: "/assets/family_cylinder.png", slug: "/blog" },
    { title: "From Etsy to Retail: Scaling Your Packaging Strategy", category: "Growth", excerpt: "Expert insights and strategies to elevate your brand's packaging presence.", img: "/assets/collection_amber.png", slug: "/blog" },
];

const CATEGORY_LABELS: Record<string, string> = {
    "packaging-101": "Packaging 101",
    "fragrance-guides": "Fragrance Guides",
    "brand-stories": "Brand Stories",
    "ingredient-science": "Ingredient Science",
    "how-to": "How-To",
    "industry-news": "Industry News",
};

type HeroSlide = NonNullable<HomepageData["heroSlides"]>[number];

const DEFAULT_HERO_SLIDE: Partial<HeroSlide> & { eyebrow: string; headline: string; subheadline: string; ctaText: string; ctaHref: string } = {
    eyebrow: "A Division of Nemat International",
    headline: "Beautifully Contained",
    subheadline: "Premium glass bottles and packaging for brands ready to scale.",
    ctaText: "Browse Catalog",
    ctaHref: "/catalog",
};

function Hero({ heroSlides, mobileHeroMode }: { heroSlides?: HomepageData["heroSlides"]; mobileHeroMode?: "categories" | "hero" }) {
    // Default to hero on mobile when not explicitly set to "categories"
    const showOnMobile = mobileHeroMode !== "categories";
    const slides: HeroSlide[] = heroSlides?.length ? heroSlides : [{ ...DEFAULT_HERO_SLIDE } as HeroSlide];
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [isMobile, setIsMobile] = React.useState(false);
    const slide = slides[currentIndex];
    const isMultiSlide = slides.length > 1;

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 1023px)");
        const handler = () => setIsMobile(mq.matches);
        handler();
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    React.useEffect(() => {
        if (!isMultiSlide) return;
        const t = setInterval(() => setCurrentIndex((i) => (i + 1) % slides.length), 6000);
        return () => clearInterval(t);
    }, [isMultiSlide, slides.length]);

    const mediaType = slide?.mediaType ?? "image";
    const videoUrl = isMobile && slide?.mobileVideo?.asset?.url
        ? slide.mobileVideo.asset.url
        : slide?.video?.asset?.url;
    const imageUrl = isMobile && slide?.mobileImage
        ? urlFor(slide.mobileImage)
        : slide?.image
            ? urlFor(slide.image)
            : "";
    const posterUrl = isMobile && slide?.mobileVideoPoster
        ? urlFor(slide.mobileVideoPoster)
        : slide?.videoPoster
            ? urlFor(slide.videoPoster)
            : imageUrl || "/assets/Hero-BB.png";
    const showVideo = mediaType === "video" && videoUrl;

    return (
        <section className={`${showOnMobile ? "flex" : "hidden lg:flex"} relative w-full h-[100dvh] pt-[160px] lg:pt-[120px] pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0 items-end lg:items-center bg-bone overflow-hidden`}>
            <div className="absolute inset-0 z-0 bg-travertine">
                {isMultiSlide ? (
                    slides.map((s, i) => {
                        const img = isMobile && s?.mobileImage
                            ? urlFor(s.mobileImage)
                            : s?.image
                                ? urlFor(s.image)
                                : "";
                        const vidUrl = isMobile && s?.mobileVideo?.asset?.url
                            ? s.mobileVideo.asset.url
                            : s?.video?.asset?.url;
                        const vidPoster = isMobile && s?.mobileVideoPoster
                            ? urlFor(s.mobileVideoPoster)
                            : s?.videoPoster
                                ? urlFor(s.videoPoster)
                                : img;
                        const isVideo = s?.mediaType === "video" && vidUrl;
                        return (
                            <div
                                key={i}
                                className={`absolute inset-0 transition-opacity duration-700 ${i === currentIndex ? "opacity-100 z-0" : "opacity-0 z-0 pointer-events-none"}`}
                            >
                                {isVideo && vidUrl ? (
                                    <video src={vidUrl} poster={vidPoster || "/assets/Hero-BB.png"} autoPlay muted loop playsInline className="w-full h-full object-cover object-[80%_center] md:object-[70%_center]" />
                                ) : (
                                    <Image src={img || "/assets/Hero-BB.png"} alt="" fill className="object-cover object-[80%_center] md:object-[70%_center]" unoptimized={!!img} />
                                )}
                            </div>
                        );
                    })
                ) : (
                    <motion.div initial={{ scale: 1.05 }} animate={{ scale: 1 }} transition={{ duration: 8, ease: "easeOut" }} className="relative w-full h-full">
                        {showVideo ? (
                            <video src={videoUrl} poster={posterUrl || undefined} autoPlay muted loop playsInline className="w-full h-full object-cover object-[80%_center] md:object-[70%_center]" />
                        ) : (
                            <Image src={imageUrl || "/assets/Hero-BB.png"} alt="Luxury perfume glass atomizer bottle" fill className="object-cover object-[80%_center] md:object-[70%_center]" priority unoptimized={!!imageUrl} />
                        )}
                    </motion.div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-obsidian/55 via-obsidian/25 to-transparent z-[1]" />
            </div>

            {isMultiSlide && (
                <>
                    <button
                        onClick={() => setCurrentIndex((i) => (i - 1 + slides.length) % slides.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                        aria-label="Previous slide"
                    >
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>
                    <button
                        onClick={() => setCurrentIndex((i) => (i + 1) % slides.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
                        aria-label="Next slide"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </button>
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                        {slides.map((_, i) => (
                            <button key={i} onClick={() => setCurrentIndex(i)} className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-white" : "bg-white/50"}`} aria-label={`Go to slide ${i + 1}`} />
                        ))}
                    </div>
                </>
            )}

            <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-16 relative z-10 pt-4 lg:pt-0 pb-20 lg:pb-0 mb-5 lg:mb-0">
                <div className="max-w-[600px]">
                    <FadeUp delay={0.2}>
                        {(() => {
                            const eyebrow = slide?.eyebrow ?? DEFAULT_HERO_SLIDE.eyebrow;
                            const hasOf = eyebrow?.includes(" of ");
                            const parts = hasOf && eyebrow
                                ? [eyebrow.split(" of ")[0]?.trim() ?? "", eyebrow.split(" of ")[1]?.trim() ?? ""]
                                : null;
                            return (
                                <div className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-white/90 font-bold mb-4 sm:mb-6 drop-shadow-sm space-y-1">
                                    {parts ? (
                                        <>
                                            {parts[0] && <p className="leading-tight">{parts[0]} OF</p>}
                                            {parts[1] && <p className="leading-tight">{parts[1]}</p>}
                                        </>
                                    ) : (
                                        <p className="leading-tight">{eyebrow}</p>
                                    )}
                                </div>
                            );
                        })()}
                    </FadeUp>
                    <FadeUp delay={0.3}>
                        <h1 className="font-display text-[56px] sm:text-[48px] lg:text-[87px] font-medium text-white leading-[1.05] sm:leading-[1.05] mb-6 sm:mb-8 drop-shadow-sm">
                            {(() => {
                                const headline = slide?.headline ?? DEFAULT_HERO_SLIDE.headline;
                                const spaceIdx = headline.indexOf(" ");
                                if (spaceIdx === -1) return headline;
                                return (
                                    <>
                                        <span className="block leading-tight">{headline.slice(0, spaceIdx)}</span>
                                        <span className="block leading-tight">{headline.slice(spaceIdx + 1)}</span>
                                    </>
                                );
                            })()}
                        </h1>
                    </FadeUp>
                    <FadeUp delay={0.4}>
                        {(() => {
                            const sub = slide?.subheadline ?? DEFAULT_HERO_SLIDE.subheadline;
                            const toTitleCase = (s: string) =>
                                s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(for|to|and)\b/gi, (m) => m.toLowerCase());
                            const parts = sub?.includes(" and ")
                                ? [sub.split(" and ")[0]?.trim() ?? "", sub.split(" and ")[1]?.trim().replace(/\.$/, "") ?? ""]
                                : null;
                            return (
                                <div className="text-base sm:text-lg lg:text-xl text-white/90 leading-[1.6] max-w-[480px] mb-8 sm:mb-12 space-y-1">
                                    {parts ? (
                                        <>
                                            {parts[0] && <p className="leading-snug">{toTitleCase(parts[0])}</p>}
                                            {parts[1] && <p className="leading-snug">{toTitleCase(parts[1])}</p>}
                                        </>
                                    ) : (
                                        <p className="leading-snug">{sub}</p>
                                    )}
                                </div>
                            );
                        })()}
                    </FadeUp>
                    <FadeUp delay={0.5} className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-8">
                        <Link href={slide?.ctaHref || DEFAULT_HERO_SLIDE.ctaHref} className="w-[200px] sm:w-auto px-8 py-4 bg-white/75 sm:bg-white text-obsidian uppercase text-sm font-semibold tracking-wider hover:bg-bone transition-colors duration-300 shadow-md text-center whitespace-nowrap">
                            {(slide?.ctaText === "Explore Collections" ? "Browse Catalog" : slide?.ctaText) || DEFAULT_HERO_SLIDE.ctaText}
                        </Link>
                    </FadeUp>
                </div>
            </div>
        </section>
    );
}

/* ─── Mobile Category Grid: replaces Hero on mobile ─── */

const DEFAULT_MOBILE_CATEGORIES = [
    { label: "Roll-On Bottles", href: "/catalog?applicators=rollon", img: "/assets/vintage-spray.png" },
    { label: "Spray Bottles", href: "/catalog?applicators=spray", img: "/assets/Cylinder-BB.png" },
    { label: "Dropper Bottles", href: "/catalog?applicators=dropper", img: "/assets/collection_skincare.png" },
    { label: "Lotion Pumps", href: "/catalog?applicators=lotionpump", img: "/assets/collection_amber.png" },
    { label: "Reducer Bottles", href: "/catalog?applicators=reducer", img: "/assets/bottle_screwcap.png" },
    { label: "Shop All 2,300+", href: "/catalog", img: "/assets/Hero-BB.png" },
];

function MobileCategoryGrid({ data }: { data?: HomepageData | null }) {
    // Only show category grid when Sanity explicitly sets "categories"; otherwise hero shows on mobile
    if (data?.mobileHeroMode !== "categories") return null;

    const tagline = data?.mobileTagline ?? "Premium glass packaging for beauty & wellness brands.";
    const sectionLabel = data?.mobileSectionLabel ?? "Shop by Application";

    const cards = data?.mobileCategoryCards?.length
        ? data.mobileCategoryCards.map((c) => ({
            label: c.label,
            href: c.href,
            img: c.image ? urlFor(c.image) : "",
        }))
        : DEFAULT_MOBILE_CATEGORIES;

    return (
        <section className="lg:hidden bg-bone">
            {/* Tagline */}
            <div className="px-5 pt-4 pb-3 text-center">
                <p className="font-serif text-sm text-slate leading-relaxed">{tagline}</p>
            </div>

            {/* Section label */}
            <div className="px-5 pb-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-gold font-bold">{sectionLabel}</p>
            </div>

            {/* 2-column grid */}
            <div className="grid grid-cols-2 gap-3 px-4 pb-5">
                {cards.map((card, i) => {
                    const imgSrc = card.img || DEFAULT_MOBILE_CATEGORIES[i % DEFAULT_MOBILE_CATEGORIES.length]?.img || "/assets/Hero-BB.png";
                    return (
                        <Link key={card.label + i} href={card.href} className="group relative aspect-[4/5] overflow-hidden rounded-sm bg-travertine">
                            <Image
                                src={imgSrc}
                                alt={card.label}
                                fill
                                className="object-cover object-center group-active:scale-105 transition-transform duration-300"
                                unoptimized={imgSrc.startsWith("http")}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-obsidian/60 via-obsidian/15 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                <h3 className="font-serif text-[15px] text-white leading-tight">{card.label}</h3>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}

function TrustBar() {
    const stats = useQuery(api.products.getHomepageStats);
    // Use live count when reasonable; cap at 2,300+ to reflect true catalog (2,310 variants)
    const raw = stats?.totalProducts ?? 0;
    const productCount = raw > 0 && raw <= 2500
        ? `${(Math.floor(raw / 100) * 100).toLocaleString()}+`
        : "2,300+";

    const items = [
        { stat: "$50 Order Minimum", statMobile: "$50 Order Min", label: "Order what you need", icon: Zap },
        { stat: `${productCount} Products`, label: "Premium bottles & closures", icon: ShoppingBag },
        { stat: "Fitment Verified", label: "Guaranteed compatibility", icon: ShieldCheck },
    ];

    return (
        <section className="hidden sm:block bg-linen border-y border-champagne/50 py-6 sm:py-8 relative z-20 min-h-[112px] mt-0 mb-0">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-3 gap-4 sm:gap-6 divide-x divide-champagne/60">
                    {items.map((item, i) => (
                        <FadeUp key={i} delay={0.2 + i * 0.1} className="flex flex-col sm:flex-row sm:items-center items-center text-center sm:text-left gap-2 sm:gap-4 sm:pl-6 first:sm:pl-0">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-bone flex items-center justify-center shrink-0 border border-champagne/30">
                                <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-gold" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-serif text-sm sm:text-lg text-obsidian font-medium leading-tight">
                                    <span className="sm:hidden">{"statMobile" in item ? item.statMobile : item.stat}</span>
                                    <span className="hidden sm:inline">{item.stat}</span>
                                </h4>
                                <p className="hidden sm:block text-[11px] sm:text-xs text-slate mt-0.5 leading-snug">{item.label}</p>
                            </div>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </section>
    );
}

const APPLICATOR_ICONS: Record<string, React.ReactNode> = {
    rollon: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <ellipse cx="20" cy="10" rx="7" ry="4" />
            <rect x="13" y="10" width="14" height="22" rx="2" />
            <ellipse cx="20" cy="32" rx="7" ry="4" />
            <circle cx="20" cy="10" r="3" fill="currentColor" stroke="none" opacity="0.4" />
        </svg>
    ),
    spray: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <rect x="11" y="14" width="13" height="20" rx="2" />
            <path d="M24 20h4M28 20l-3-3M28 20l-3 3" />
            <rect x="14" y="8" width="7" height="6" rx="1" />
            <path d="M24 12h3a1 1 0 011 1v7" />
        </svg>
    ),
    reducer: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <rect x="11" y="12" width="18" height="22" rx="2" />
            <rect x="14" y="7" width="12" height="5" rx="1" />
            <path d="M18 9h4" strokeWidth="2" />
            <path d="M20 34v3M17 37h6" />
        </svg>
    ),
    lotionpump: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <rect x="13" y="16" width="14" height="18" rx="2" />
            <path d="M20 16V8M16 8h8" />
            <path d="M20 8c0 0-4-3-4-5" />
            <rect x="16" y="12" width="8" height="4" rx="1" />
        </svg>
    ),
    dropper: (
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="1.5">
            <rect x="14" y="10" width="12" height="20" rx="3" />
            <rect x="16" y="6" width="8" height="4" rx="1" />
            <path d="M20 30v6" />
            <path d="M18 36c0 0 2 2 4 0" />
        </svg>
    ),
};

/* ─── Guided Selector: 3-step funnel (Use Case → Dispenser → Size) ─── */

const USE_CASES: Array<{ id: string; label: string; subtitle: string; icon: string; applicators: ApplicatorNavValue[] }> = [
    { id: "fragrance", label: "Fragrance & Perfume", subtitle: "Spray, rollerball, and splash formats", icon: "🌸", applicators: ["spray", "rollon", "reducer"] },
    { id: "essentials", label: "Essential Oils", subtitle: "Roll-on and dropper bottles for oils", icon: "💧", applicators: ["rollon", "dropper"] },
    { id: "skincare", label: "Skincare & Serums", subtitle: "Dropper and pump formats", icon: "🧴", applicators: ["dropper", "lotionpump"] },
    { id: "gift", label: "Gift & Retail", subtitle: "Presentation-ready packaging", icon: "🎁", applicators: ["spray", "rollon", "dropper", "lotionpump", "reducer"] },
    { id: "samples", label: "Samples & Travel", subtitle: "Vials and compact formats", icon: "🧪", applicators: ["spray", "rollon", "dropper"] },
    { id: "other", label: "Something Else", subtitle: "Browse the full catalog", icon: "✨", applicators: [] },
];

// Derive DISPENSERS from the shared APPLICATOR_NAV config (single source of truth)
const DISPENSERS = APPLICATOR_NAV.map((nav) => ({
    value: nav.value,
    label: nav.label,
    subtitle: nav.subtitle,
}));

const SIZE_RANGES = [
    { label: "Miniature", subtitle: "1–5 ml", params: "capacities=1+ml&capacities=2+ml&capacities=3+ml&capacities=5+ml" },
    { label: "Small", subtitle: "6–15 ml", params: "capacities=6+ml&capacities=8+ml&capacities=10+ml&capacities=12+ml&capacities=15+ml" },
    { label: "Medium", subtitle: "20–50 ml", params: "capacities=20+ml&capacities=25+ml&capacities=30+ml&capacities=50+ml" },
    { label: "Large", subtitle: "75–120 ml", params: "capacities=75+ml&capacities=100+ml&capacities=120+ml" },
    { label: "Any Size", subtitle: "Show all", params: "" },
];

function GuidedSelector({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [useCase, setUseCase] = useState<string | null>(null);
    const [applicator, setApplicator] = useState<string | null>(null);

    const selectedUseCase = USE_CASES.find((u) => u.id === useCase);
    const availableDispensers = selectedUseCase?.applicators.length
        ? DISPENSERS.filter((d) => selectedUseCase.applicators.includes(d.value))
        : DISPENSERS;

    const handleUseCaseSelect = useCallback((id: string) => {
        setUseCase(id);
        if (id === "other") {
            router.push("/catalog");
            onClose();
            return;
        }
        setStep(2);
    }, [router, onClose]);

    const handleDispenserSelect = useCallback((value: string) => {
        setApplicator(value);
        setStep(3);
    }, []);

    const handleSizeSelect = useCallback((sizeParams: string) => {
        // Resolve nav-level applicator to actual bucket values via shared config
        const nav = applicator ? APPLICATOR_NAV.find((n) => n.value === applicator) : null;
        const params = new URLSearchParams();
        if (nav) params.set("applicators", nav.buckets.join(","));
        const url = `/catalog?${params.toString()}${sizeParams ? `&${sizeParams}` : ""}`;
        router.push(url);
        onClose();
    }, [applicator, router, onClose]);

    const stepLabels = ["Use Case", "Dispenser", "Size"];

    return (
        <section className="bg-white border-y border-champagne/40">
            <div className="max-w-[1440px] mx-auto px-6 py-12 lg:py-16">
                {/* Step indicator */}
                <div className="flex items-center justify-center mb-10 gap-2">
                    {stepLabels.map((label, i) => {
                        const stepNum = i + 1;
                        const isActive = step === stepNum;
                        const isDone = step > stepNum;
                        return (
                            <React.Fragment key={label}>
                                {i > 0 && <ChevronRight className="w-4 h-4 text-champagne mx-1" />}
                                <button
                                    onClick={() => { if (isDone) setStep(stepNum); }}
                                    disabled={!isDone}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${isActive ? "bg-obsidian text-white" : isDone ? "bg-muted-gold/10 text-muted-gold cursor-pointer hover:bg-muted-gold/20" : "bg-travertine text-slate/50"
                                        }`}
                                >
                                    {isDone ? <Check className="w-3.5 h-3.5" /> : <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-xs">{stepNum}</span>}
                                    {label}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Step 1: Use Case */}
                {step === 1 && (
                    <FadeUp>
                        <div className="text-center mb-8">
                            <h2 className="font-serif text-3xl lg:text-4xl text-obsidian font-medium">What are you packaging?</h2>
                            <p className="text-slate text-sm mt-2">Pick the closest match — we&apos;ll narrow the catalog for you.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                            {USE_CASES.map((uc) => (
                                <button
                                    key={uc.id}
                                    onClick={() => handleUseCaseSelect(uc.id)}
                                    className="group flex flex-col items-center text-center p-6 bg-bone border border-champagne/50 rounded-sm hover:border-muted-gold hover:shadow-md transition-all duration-300"
                                >
                                    <span className="text-3xl mb-3">{uc.icon}</span>
                                    <h3 className="font-serif text-lg text-obsidian font-medium mb-1 leading-snug">{uc.label}</h3>
                                    <p className="text-xs text-slate leading-relaxed">{uc.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </FadeUp>
                )}

                {/* Step 2: Dispenser */}
                {step === 2 && (
                    <FadeUp>
                        <div className="text-center mb-8">
                            <h2 className="font-serif text-3xl lg:text-4xl text-obsidian font-medium">How should it dispense?</h2>
                            <p className="text-slate text-sm mt-2">Choose a dispensing method for your {selectedUseCase?.label.toLowerCase()} products.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
                            {availableDispensers.map((d) => (
                                <button
                                    key={d.value}
                                    onClick={() => handleDispenserSelect(d.value)}
                                    className="group flex flex-col h-full bg-bone border border-champagne/50 rounded-sm p-6 hover:border-muted-gold hover:shadow-md transition-all duration-300"
                                >
                                    <div className="text-obsidian/40 group-hover:text-muted-gold transition-colors duration-300 mb-4">
                                        {APPLICATOR_ICONS[d.value]}
                                    </div>
                                    <h3 className="font-serif text-lg text-obsidian font-medium mb-1 leading-snug">{d.label}</h3>
                                    <p className="text-xs text-slate leading-relaxed">{d.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </FadeUp>
                )}

                {/* Step 3: Size */}
                {step === 3 && (
                    <FadeUp>
                        <div className="text-center mb-8">
                            <h2 className="font-serif text-3xl lg:text-4xl text-obsidian font-medium">What size?</h2>
                            <p className="text-slate text-sm mt-2">Pick a size range — you can always refine in the catalog.</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
                            {SIZE_RANGES.map((s) => (
                                <button
                                    key={s.label}
                                    onClick={() => handleSizeSelect(s.params)}
                                    className="group flex flex-col items-center p-6 bg-bone border border-champagne/50 rounded-sm hover:border-muted-gold hover:shadow-md transition-all duration-300 w-[140px]"
                                >
                                    <h3 className="font-serif text-lg text-obsidian font-medium mb-1">{s.label}</h3>
                                    <p className="text-xs text-slate">{s.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </FadeUp>
                )}

                {/* Close / Skip */}
                <div className="text-center mt-8">
                    <button onClick={onClose} className="text-xs text-slate hover:text-obsidian transition-colors uppercase tracking-wider">
                        Skip — browse the full catalog
                    </button>
                </div>
            </div>
        </section>
    );
}

/* ─── PathChooser: 3 clear entry paths ─── */

function PathChooser() {
    const { open: openGrace } = useGrace();
    const router = useRouter();
    const [showGuided, setShowGuided] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const handleSearchSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (searchValue.trim()) {
            router.push(`/catalog?search=${encodeURIComponent(searchValue.trim())}`);
        }
    }, [searchValue, router]);

    if (showGuided) {
        return <GuidedSelector onClose={() => setShowGuided(false)} />;
    }

    return (
        <section className="bg-white border-b border-champagne/40 py-14 lg:py-16">
            <div className="max-w-[1440px] mx-auto px-6">
                <FadeUp className="text-center mb-10">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-2">Find Your Bottle</p>
                    <h2 className="font-serif text-3xl lg:text-4xl text-obsidian font-medium tracking-tight">How would you like to start?</h2>
                </FadeUp>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
                    {/* Path 1: I Know What I Need — search-first */}
                    <FadeUp delay={0.1}>
                        <div className="group flex flex-col items-center text-center p-8 bg-bone border border-champagne/50 rounded-sm hover:border-muted-gold hover:shadow-lg transition-all duration-300">
                            <div className="w-14 h-14 rounded-full bg-white border border-champagne/40 flex items-center justify-center mb-5 group-hover:border-muted-gold transition-colors">
                                <Search className="w-6 h-6 text-obsidian/50 group-hover:text-muted-gold transition-colors" />
                            </div>
                            <h3 className="font-serif text-xl text-obsidian font-medium mb-2">I Know What I Need</h3>
                            <p className="text-xs text-slate leading-relaxed mb-5">Search by name, SKU, size, or color.</p>
                            <form onSubmit={handleSearchSubmit} className="w-full">
                                <div className={`flex border rounded-full overflow-hidden transition-all duration-300 ${searchFocused ? "border-muted-gold ring-2 ring-muted-gold/20" : "border-champagne"}`}>
                                    <input
                                        type="text"
                                        value={searchValue}
                                        onChange={(e) => setSearchValue(e.target.value)}
                                        onFocus={() => setSearchFocused(true)}
                                        onBlur={() => setSearchFocused(false)}
                                        placeholder="e.g. 9ml clear cylinder roll-on"
                                        className="flex-1 px-4 py-2.5 text-sm bg-white focus:outline-none placeholder-slate/50 text-obsidian min-w-0"
                                    />
                                    <button type="submit" className="px-4 bg-obsidian text-white hover:bg-muted-gold transition-colors">
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </FadeUp>

                    {/* Path 2: Help Me Choose */}
                    <FadeUp delay={0.2}>
                        <button
                            onClick={() => setShowGuided(true)}
                            className="group flex flex-col items-center text-center p-8 bg-bone border border-champagne/50 rounded-sm hover:border-muted-gold hover:shadow-lg transition-all duration-300 w-full"
                        >
                            <div className="w-14 h-14 rounded-full bg-white border border-champagne/40 flex items-center justify-center mb-5 group-hover:border-muted-gold transition-colors">
                                <Compass className="w-6 h-6 text-obsidian/50 group-hover:text-muted-gold transition-colors" />
                            </div>
                            <h3 className="font-serif text-xl text-obsidian font-medium mb-2">Help Me Choose</h3>
                            <p className="text-xs text-slate leading-relaxed mb-5">3 quick questions to find your perfect bottle.</p>
                            <span className="text-xs font-semibold text-muted-gold uppercase tracking-wider flex items-center group-hover:gap-2 transition-all duration-300">
                                Start <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </span>
                        </button>
                    </FadeUp>

                    {/* Path 3: Talk to Grace */}
                    <FadeUp delay={0.3}>
                        <button
                            onClick={openGrace}
                            className="group flex flex-col items-center text-center p-8 bg-bone border border-champagne/50 rounded-sm hover:border-muted-gold hover:shadow-lg transition-all duration-300 w-full"
                        >
                            <div className="w-14 h-14 rounded-full bg-white border border-champagne/40 flex items-center justify-center mb-5 group-hover:border-muted-gold transition-colors">
                                <MessageCircle className="w-6 h-6 text-obsidian/50 group-hover:text-muted-gold transition-colors" />
                            </div>
                            <h3 className="font-serif text-xl text-obsidian font-medium mb-2">Talk to Grace</h3>
                            <p className="text-xs text-slate leading-relaxed mb-5">Your AI bottling specialist for fitment and product guidance.</p>
                            <span className="text-xs font-semibold text-muted-gold uppercase tracking-wider flex items-center group-hover:gap-2 transition-all duration-300">
                                Ask Now <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </span>
                        </button>
                    </FadeUp>
                </div>

                {/* Browse All CTA */}
                <FadeUp delay={0.4} className="text-center mt-8">
                    <Link
                        href="/catalog"
                        className="inline-flex items-center gap-2 text-sm text-slate hover:text-obsidian transition-colors font-medium underline underline-offset-4 decoration-champagne hover:decoration-muted-gold"
                    >
                        Browse All Products <ArrowRight className="w-4 h-4" />
                    </Link>
                </FadeUp>
            </div>
        </section>
    );
}

function DesignFamilies({ designFamilyCards }: { designFamilyCards?: HomepageData["designFamilyCards"] }) {
    const stats = useQuery(api.products.getHomepageStats);
    const families = designFamilyCards?.length
        ? designFamilyCards.map((f) => ({ family: f.family, title: f.title, img: f.image ? urlFor(f.image) : "" }))
        : DEFAULT_FAMILIES;

    return (
        <section className="py-24 bg-warm-white overflow-hidden">
            <div className="pl-6 lg:pl-[max(1.5rem,calc((100vw-1440px)/2+1.5rem))]">
                <FadeUp className="mb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-3">Already Know Your Style?</p>
                    <h2 className="font-serif text-4xl text-obsidian font-medium">Shop by design family</h2>
                </FadeUp>
                <div className="flex overflow-x-auto gap-6 pb-12 snap-x snap-mandatory hide-scroll pr-[10vw]">
                    {families.map((fam, i) => {
                        const count = stats?.familyCounts?.[fam.family] ?? 0;
                        const imgSrc = fam.img || (DEFAULT_FAMILIES.find((d) => d.family === fam.family)?.img ?? "/assets/Cylinder-BB.png");
                        return (
                            <FadeUp key={fam.family} delay={i * 0.08} className="w-[85vw] sm:w-[400px] lg:w-[400px] xl:w-[420px] shrink-0 snap-center lg:snap-start">
                                <Link href={`/catalog?families=${encodeURIComponent(fam.family)}`}>
                                    <div className="group relative aspect-[3/4] rounded-[10px] overflow-hidden bg-travertine cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500">
                                        <Image
                                            src={imgSrc}
                                            alt={fam.title}
                                            fill
                                            className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-in-out"
                                            unoptimized={imgSrc.startsWith("http")}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-obsidian/20 to-transparent" />
                                        <div className="absolute bottom-8 left-8 right-8">
                                            <h3 className="font-serif text-[26px] text-white leading-tight mb-2">{fam.title}</h3>
                                            <div className="flex items-center justify-between">
                                                <p className="text-[14px] text-bone/90 font-medium">{count > 0 ? `${count} products` : "Loading..."}</p>
                                                <span className="flex items-center text-muted-gold text-sm font-semibold opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                                    Explore <ArrowRight className="w-4 h-4 ml-1" />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </FadeUp>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function SocialProof() {
    const testimonials = [
        { quote: "Best Bottles transformed our unboxing experience. The glass quality is impeccable and their volume pricing scales perfectly with our growth.", name: "Sarah L.", brand: "Aura Botanica", segment: "Graduate" },
        { quote: "Grace helped us navigate a complex dropper fitment issue in minutes. It's like having an in-house packaging engineer on staff.", name: "Marcus T.", brand: "Veda Skincare", segment: "Scaler" },
        { quote: "Consistent lead times and zero tariff surprises. They are the only supply chain partner we trust completely.", name: "Elena R.", brand: "Lumiere Fragrance", segment: "Professional" },
    ];

    return (
        <section className="bg-parchment/20 py-24 overflow-hidden border-b border-champagne/40">
            <div className="max-w-[1440px] mx-auto px-6">
                <FadeUp className="text-center mb-16">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-3">Who Trusts Best Bottles</p>
                    <h2 className="font-serif text-4xl text-obsidian font-medium mb-4">Serving 500+ Brands</h2>
                    <p className="text-slate max-w-2xl mx-auto">From boutique indie perfumers to enterprise retail labels.</p>
                </FadeUp>
                <div className="flex overflow-x-auto gap-6 pb-12 snap-x snap-mandatory hide-scroll">
                    {testimonials.map((test, i) => (
                        <FadeUp key={i} delay={i * 0.1} className="w-[85vw] sm:w-[400px] shrink-0 snap-center">
                            <div className="bg-white p-8 rounded-sm shadow-sm border border-champagne/50 h-full flex flex-col justify-between hover:border-muted-gold transition-colors duration-300">
                                <p className="font-serif italic text-[20px] text-obsidian leading-relaxed mb-8">&quot;{test.quote}&quot;</p>
                                <div>
                                    <div className="flex items-center space-x-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-travertine flex items-center justify-center text-sm font-semibold text-muted-gold">
                                            {test.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-obsidian">{test.name}</p>
                                            <p className="text-xs text-slate">{test.brand}</p>
                                        </div>
                                    </div>
                                    <span className="inline-block mt-2 px-3 py-1 bg-muted-gold/10 text-muted-gold text-[10px] uppercase tracking-wider font-bold rounded-full">{test.segment}</span>
                                </div>
                            </div>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </section>
    );
}

function EducationPreview({ educationPreview: edu }: { educationPreview?: HomepageData["educationPreview"] }) {
    const articles = edu?.featuredArticles?.length
        ? edu.featuredArticles.map((a) => ({
            title: a.title,
            category: a.category ? (CATEGORY_LABELS[a.category] ?? a.category) : "Insights",
            excerpt: a.excerpt ?? "Expert insights and strategies to elevate your brand's packaging presence.",
            img: a.image ? urlFor(a.image) : "/assets/collection_perfume.png",
            slug: a.slug ? `/blog/${a.slug}` : "#",
        }))
        : DEFAULT_ARTICLES;

    const sectionTitle = edu?.sectionTitle ?? "Packaging Insights";
    const sectionEyebrow = edu?.sectionEyebrow ?? "From the Lab";
    const viewAllHref = edu?.viewAllHref ?? "/blog";

    return (
        <section className="bg-linen py-24">
            <div className="max-w-[1440px] mx-auto px-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
                    <FadeUp>
                        <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-3">{sectionEyebrow}</p>
                        <h2 className="font-serif text-4xl text-obsidian font-medium">{sectionTitle}</h2>
                    </FadeUp>
                    <FadeUp delay={0.2} className="mt-6 md:mt-0">
                        <Link href={viewAllHref} className="text-sm font-semibold text-muted-gold hover:text-obsidian transition-colors uppercase tracking-widest flex items-center">
                            View All Articles <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                    </FadeUp>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {articles.map((article, i) => (
                        <FadeUp key={i} delay={i * 0.1}>
                            <Link href={article.slug} className="group cursor-pointer block">
                                <div className="relative aspect-[16/9] bg-travertine rounded-sm overflow-hidden mb-6 shadow-sm">
                                    <Image
                                        src={article.img}
                                        alt={article.title}
                                        fill
                                        className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-in-out"
                                        unoptimized={article.img.startsWith("http")}
                                    />
                                </div>
                                <span className="inline-block mb-4 px-3 py-1 bg-bone text-muted-gold text-[11px] uppercase tracking-wider font-bold rounded-full border border-champagne/50">{article.category}</span>
                                <h3 className="font-serif text-2xl text-obsidian leading-tight mb-3 group-hover:text-muted-gold transition-colors">{article.title}</h3>
                                <p className="text-sm text-slate mb-4">{article.excerpt}</p>
                                <span className="text-sm font-medium text-obsidian flex items-center group-hover:text-muted-gold transition-colors">
                                    Read More <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                </span>
                            </Link>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </section>
    );
}

function Newsletter() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const email = new FormData(form).get("email") as string;
        if (email?.trim()) {
            // TODO: wire up to email service (Mailchimp, ConvertKit, etc.)
            setSubmitted(true);
        }
    }, []);

    return (
        <section className="bg-linen py-24 border-t border-champagne/30 text-center">
            <div className="max-w-xl mx-auto px-6">
                <FadeUp>
                    <h2 className="font-serif text-3xl text-obsidian font-medium mb-4">Stay in the Know</h2>
                    <p className="text-slate mb-8">Packaging insights, new arrivals, and scaling strategies. No spam—just expertise.</p>
                    {submitted ? (
                        <p className="text-muted-gold font-semibold text-sm">Thanks for subscribing! We&apos;ll be in touch.</p>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex w-full items-center border border-champagne bg-white p-1 rounded-full shadow-sm hover:border-muted-gold transition-colors focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/20">
                            <input type="email" name="email" placeholder="Your email address" className="flex-1 px-6 py-3 bg-transparent text-sm focus:outline-none placeholder-slate/60 text-obsidian" required />
                            <button type="submit" className="px-6 py-3 bg-muted-gold text-white uppercase text-xs font-bold tracking-wider rounded-full hover:bg-obsidian transition-colors duration-300">
                                Subscribe
                            </button>
                        </form>
                    )}
                </FadeUp>
            </div>
        </section>
    );
}

function Footer() {
    return (
        <footer className="bg-obsidian text-bone/70 pt-20 pb-8">
            <div className="max-w-[1440px] mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    <div>
                        <h4 className="font-serif text-2xl text-white mb-6">BEST BOTTLES</h4>
                        <p className="text-sm italic font-serif text-muted-gold mb-6">Beautifully Contained.</p>
                        <div className="flex space-x-4">
                            <a href="https://www.instagram.com/nematinternational/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-muted-gold transition-colors" aria-label="Instagram">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                            </a>
                            <a href="https://www.facebook.com/NematInternational" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-muted-gold transition-colors" aria-label="Facebook">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            </a>
                            <a href="https://www.linkedin.com/company/nematinternational/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-muted-gold transition-colors" aria-label="LinkedIn">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                            </a>
                        </div>
                    </div>
                    <div>
                        <h5 className="text-white text-sm font-semibold uppercase tracking-wider mb-6">Shop</h5>
                        <ul className="space-y-4 text-sm">
                            {["By Usage", "By Product Type", "By Collection", "New Arrivals", "Best Sellers"].map((label) => (
                                <li key={label}>
                                    <Link href="/catalog" className="hover:text-muted-gold transition-colors">{label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h5 className="text-white text-sm font-semibold uppercase tracking-wider mb-6">Support</h5>
                        <ul className="space-y-4 text-sm">
                            <li><Link href="/contact" className="hover:text-muted-gold transition-colors">Contact</Link></li>
                            <li><Link href="/resources" className="hover:text-muted-gold transition-colors">Shipping & Returns</Link></li>
                            <li><Link href="/resources" className="hover:text-muted-gold transition-colors">FAQ</Link></li>
                            <li><Link href="/resources" className="hover:text-muted-gold transition-colors">Compatibility Guides</Link></li>
                            <li><Link href="/resources" className="hover:text-muted-gold transition-colors">Spec Sheets</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h5 className="text-white text-sm font-semibold uppercase tracking-wider mb-6">Company</h5>
                        <ul className="space-y-4 text-sm">
                            <li><Link href="/about" className="hover:text-muted-gold transition-colors">About / Heritage</Link></li>
                            <li><a href="https://www.nematinternational.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-gold transition-colors">Nemat International</a></li>
                            <li><Link href="/blog" className="hover:text-muted-gold transition-colors">Journal</Link></li>
                            <li><Link href="/request-quote" className="hover:text-muted-gold transition-colors">Wholesale Inquiry</Link></li>
                            <li><Link href="/contact" className="hover:text-muted-gold transition-colors">Careers</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-xs space-y-4 md:space-y-0 text-white/40">
                    <div className="flex items-center space-x-6">
                        <span>1-800-936-3628</span>
                        <span>sales@nematinternational.com</span>
                    </div>
                    <div className="flex items-center space-x-6">
                        <Link href="/resources" className="hover:text-muted-gold transition-colors">Privacy</Link>
                        <Link href="/resources" className="hover:text-muted-gold transition-colors">Terms</Link>
                        <span>© 2026 Nemat International</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default function HomePage({ homepageData }: { homepageData: HomepageData | null }) {
    return (
        <main className="min-h-screen">
            <Navbar variant="home" />
            <Hero heroSlides={homepageData?.heroSlides} mobileHeroMode={homepageData?.mobileHeroMode} />
            <MobileCategoryGrid data={homepageData} />
            <TrustBar />
            <PathChooser />
            <DesignFamilies designFamilyCards={homepageData?.designFamilyCards} />
            <SocialProof />
            <EducationPreview educationPreview={homepageData?.educationPreview} />
            <Newsletter />
            <Footer />
        </main>
    );
}
