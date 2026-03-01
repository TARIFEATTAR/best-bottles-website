"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Zap, Star, ShoppingBag, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Navbar from "@/components/Navbar";
import { useGrace } from "@/components/GraceProvider";
import { urlFor } from "@/sanity/lib/image";
import type { HomepageData } from "@/sanity/lib/queries";

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
    { title: "essential oils & roll-ons", subtitle: "Roller-ready bottles for oils, topicals, and fragrance oils.", href: "/catalog?applicators=rollon", img: "/assets/vintage-spray.png", bg: "#DFD6C9" },
    { title: "skincare & serums", subtitle: "Dropper and pump formats for treatment-focused formulas.", href: "/catalog?applicators=dropper&applicators=lotionpump", img: "/assets/collection_skincare.png", bg: "#EADDD1" },
    { title: "sample & discovery", subtitle: "Vials and compact formats for trial, travel, and discovery kits.", href: "/catalog?families=Vial", img: "/assets/Hero-BB.png", bg: "#EAE0D5" },
    { title: "gift & retail packaging", subtitle: "Presentation-ready packaging for launches, gifting, and retail shelves.", href: "/catalog?category=Packaging", img: "/assets/collection_amber.png", bg: "#F3E5D8" },
    { title: "components & closures", subtitle: "Caps, droppers, pumps, and fitments matched by thread size.", href: "/catalog?category=Component", img: "/assets/bottle_screwcap.png", bg: "#DCD0C0" },
    { title: "fine mist & spray bottles", subtitle: "Spray-forward bottle families for fragrance and room scent formats.", href: "/catalog?applicators=spray", img: "/assets/Cylinder-BB.png", bg: "#D5C5B1" },
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
    { title: "Glass vs. Plastic: Why Material Matters for Your Brand", category: "Materials", img: "/assets/collection_perfume.png", slug: "#" },
    { title: "Finding Your Thread: A Complete Neck Size Compatibility Guide", category: "Technical", img: "/assets/family_cylinder.png", slug: "#" },
    { title: "From Etsy to Sephora: Scaling Your Packaging Strategy", category: "Growth", img: "/assets/collection_amber.png", slug: "#" },
];

function Hero({ hero }: { hero?: HomepageData["hero"] }) {
    const { open: openGrace } = useGrace();
    const mediaType = hero?.mediaType ?? "image";
    const videoUrl = hero?.video?.asset?.url;
    const imageUrl = hero?.image ? urlFor(hero.image) : "";
    const posterUrl = hero?.videoPoster ? urlFor(hero.videoPoster) : imageUrl || "/assets/Hero-BB.png";
    const showVideo = mediaType === "video" && videoUrl;

    return (
        <section className="relative min-h-[80vh] lg:h-[82vh] lg:min-h-[650px] pt-[156px] lg:pt-[104px] flex items-center bg-bone overflow-hidden">
            <div className="absolute inset-0 z-0 bg-travertine">
                <motion.div initial={{ scale: 1.05 }} animate={{ scale: 1 }} transition={{ duration: 8, ease: "easeOut" }} className="relative w-full h-full">
                    {showVideo ? (
                        <video
                            src={videoUrl}
                            poster={posterUrl || undefined}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover object-center lg:object-right"
                        />
                    ) : (
                        <Image
                            src={imageUrl || "/assets/Hero-BB.png"}
                            alt="Luxury perfume glass atomizer bottle"
                            fill
                            className="object-cover object-center lg:object-right"
                            priority
                            unoptimized={!!imageUrl}
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-obsidian/55 via-obsidian/25 to-transparent" />
                </motion.div>
            </div>

            <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-16 relative z-10 pt-16 lg:pt-0 pb-16 lg:pb-0">
                <div className="max-w-[600px]">
                    <FadeUp delay={0.2}>
                        <p className="text-xs uppercase tracking-[0.25em] text-white/90 font-bold mb-6 drop-shadow-sm">
                            {hero?.eyebrow ?? "A Division of Nemat International"}
                        </p>
                    </FadeUp>
                    <FadeUp delay={0.3}>
                        <h1 className="font-display text-[60px] lg:text-[87px] font-medium text-white leading-[1.05] mb-8 drop-shadow-sm">
                            {hero?.headline ?? "Beautifully Contained"}
                        </h1>
                    </FadeUp>
                    <FadeUp delay={0.4}>
                        <p className="text-lg lg:text-xl text-white/90 leading-[1.6] max-w-[480px] mb-12">
                            {hero?.subheadline ?? "Premium glass bottles and packaging for brands ready to scale."}
                        </p>
                    </FadeUp>
                    <FadeUp delay={0.5} className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-8">
                        <Link href="/catalog" className="w-full sm:w-auto px-8 py-4 bg-white text-obsidian uppercase text-sm font-semibold tracking-wider hover:bg-bone transition-colors duration-300 shadow-md text-center">
                            Explore Collections
                        </Link>
                        <button onClick={openGrace} className="group flex items-center space-x-2 text-white text-sm font-bold hover:text-muted-gold transition-colors duration-300">
                            <span className="text-shimmer border-b-2 border-white group-hover:border-muted-gold transition-colors pb-1">Ask Grace — AI Bottling Specialist</span>
                        </button>
                    </FadeUp>
                </div>
            </div>
        </section>
    );
}

function TrustBar() {
    const stats = useQuery(api.products.getHomepageStats);
    const productCount = stats?.totalProducts ? `${(Math.floor(stats.totalProducts / 100) * 100).toLocaleString()}+` : "2,300+";

    return (
        <section className="bg-linen border-y border-champagne/50 py-8 relative z-20">
            <div className="max-w-[1440px] mx-auto px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 divide-x-0 lg:divide-x divide-champagne/50">
                    {[
                        { stat: "No Order Minimum", label: "Scale from 1 unit to 10,000+", icon: Zap },
                        { stat: productCount, label: "Premium Products", icon: ShoppingBag },
                        { stat: "Free Sample Kits", label: "Touch & feel before you commit", icon: Star },
                        { stat: "Made in USA", label: "No Tariff Surprises", icon: MapPin },
                    ].map((item, i) => (
                        <FadeUp key={i} delay={0.2 + i * 0.1} className="flex items-center space-x-4 lg:pl-8 first:lg:pl-0">
                            <div className="w-10 h-10 rounded-full bg-bone flex items-center justify-center shrink-0 border border-champagne/30">
                                <item.icon className="w-5 h-5 text-muted-gold" strokeWidth={1.5} />
                            </div>
                            <div>
                                <h4 className="font-serif text-lg text-obsidian font-medium leading-tight">{item.stat}</h4>
                                <p className="text-xs text-slate mt-0.5">{item.label}</p>
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

function ShopByApplication() {
    const entries = [
        { value: "rollon", label: "Roll-ons", subtitle: "Essential oils, perfume oils, topicals" },
        { value: "spray", label: "Sprays", subtitle: "Fine mist, atomizers, antique bulb" },
        { value: "reducer", label: "Splash & Reducer", subtitle: "Aftershave, cologne, beard oil" },
        { value: "lotionpump", label: "Lotion Pumps", subtitle: "Skincare, body care, serums" },
        { value: "dropper", label: "Droppers", subtitle: "Serums, tinctures, CBD, essential oils" },
    ];

    return (
        <section className="bg-bone py-16 border-b border-champagne/40">
            <div className="max-w-[1440px] mx-auto px-6">
                <FadeUp className="mb-10">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-2">Applicator Type</p>
                    <h2 className="font-serif text-4xl text-obsidian font-medium tracking-tight leading-tight">Choose an applicator</h2>
                </FadeUp>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {entries.map((entry, i) => (
                        <FadeUp key={entry.value} delay={i * 0.07}>
                            <Link
                                href={`/catalog?applicators=${entry.value}`}
                                className="group flex flex-col h-full bg-white border border-champagne/50 rounded-sm p-6 hover:border-muted-gold hover:shadow-md transition-all duration-300 cursor-pointer"
                            >
                                <div className="text-obsidian/40 group-hover:text-muted-gold transition-colors duration-300 mb-5">
                                    {APPLICATOR_ICONS[entry.value]}
                                </div>
                                <h3 className="font-serif text-xl text-obsidian font-medium mb-1 leading-snug">{entry.label}</h3>
                                <p className="text-xs text-slate leading-relaxed mb-4 flex-1">{entry.subtitle}</p>
                                <span className="text-xs font-semibold text-muted-gold uppercase tracking-wider flex items-center group-hover:gap-2 transition-all duration-300">
                                    Browse <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                </span>
                            </Link>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </section>
    );
}

function CuratedCollections({ startHereCards }: { startHereCards?: HomepageData["startHereCards"] }) {
    const cards = startHereCards?.length
        ? startHereCards.map((c) => {
              const bg = c.backgroundColor?.startsWith("#") ? c.backgroundColor : c.backgroundColor ? `#${c.backgroundColor}` : "#DFD6C9";
              return {
                  title: c.title,
                  subtitle: c.subtitle ?? "",
                  href: c.href,
                  img: c.image ? urlFor(c.image) : "",
                  bg,
              };
          })
        : DEFAULT_START_HERE.map((c) => ({ ...c, bg: c.bg }));

    return (
        <section className="pt-16 pb-20 bg-white border-y border-champagne/40">
            <div className="max-w-[1440px] mx-auto px-6">
                <FadeUp className="mb-8">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-2">Guided Browsing</p>
                    <h2 className="font-serif text-4xl text-obsidian font-medium tracking-tight">Start Here</h2>
                    <p className="text-[14px] text-slate mt-2">Choose your use case to narrow the catalog faster.</p>
                </FadeUp>
            </div>
            <div className="pl-6 lg:pl-[max(1.5rem,calc((100vw-1440px)/2+1.5rem))] overflow-hidden">
                <div className="flex overflow-x-auto gap-4 pb-8 snap-x snap-mandatory hide-scroll pr-[10vw]">
                    {cards.map((card, i) => (
                        <FadeUp key={card.title} delay={i * 0.08} className="w-[80vw] sm:w-[280px] xl:w-[240px] lg:w-[260px] shrink-0 snap-center lg:snap-start">
                            <Link
                                href={card.href}
                                className="group relative flex flex-col h-[280px] rounded-[10px] overflow-hidden cursor-pointer shadow-sm"
                                style={{ backgroundColor: card.bg }}
                            >
                                <div className="absolute inset-0 z-0">
                                    <Image
                                        src={card.img || "/assets/Hero-BB.png"}
                                        alt={card.title}
                                        fill
                                        className="object-cover object-bottom group-hover:scale-105 transition-transform duration-700 ease-out"
                                        unoptimized={!!card.img?.startsWith("http")}
                                    />
                                </div>
                                <div className="relative z-10 p-5 mt-1 flex flex-col h-full justify-between">
                                    <h3 className="font-bold text-obsidian text-[18px] lowercase leading-snug tracking-tight drop-shadow-sm">{card.title}</h3>
                                    <p className="text-[11px] uppercase tracking-wider font-semibold text-obsidian/70 mt-auto leading-relaxed">{card.subtitle}</p>
                                </div>
                            </Link>
                        </FadeUp>
                    ))}
                </div>
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
        <section className="py-24 bg-bone overflow-hidden">
            <div className="pl-6 lg:pl-[max(1.5rem,calc((100vw-1440px)/2+1.5rem))]">
                <FadeUp className="mb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate font-semibold mb-3">The Collection</p>
                    <h2 className="font-serif text-4xl text-obsidian font-medium">Design families</h2>
                </FadeUp>
                <div className="flex overflow-x-auto gap-6 pb-12 snap-x snap-mandatory hide-scroll pr-[10vw]">
                    {families.map((fam, i) => {
                        const count = stats?.familyCounts?.[fam.family] ?? 0;
                        const imgSrc = fam.img || (DEFAULT_FAMILIES.find((d) => d.family === fam.family)?.img ?? "/assets/Cylinder-BB.png");
                        return (
                            <FadeUp key={fam.family} delay={i * 0.08} className="w-[80vw] sm:w-[360px] lg:w-[340px] xl:w-[360px] shrink-0 snap-center lg:snap-start">
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
        <section className="bg-bone py-24 overflow-hidden border-b border-champagne/40">
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
                                        <div className="w-10 h-10 rounded-full bg-travertine" />
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
              category: a.category ?? "Insights",
              img: a.image ? urlFor(a.image) : "/assets/collection_perfume.png",
              slug: a.slug ? `/blog/${a.slug}` : "#",
          }))
        : DEFAULT_ARTICLES;

    const sectionTitle = edu?.sectionTitle ?? "Packaging Insights";
    const sectionEyebrow = edu?.sectionEyebrow ?? "From the Lab";
    const viewAllHref = edu?.viewAllHref ?? "/resources";

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
                                <p className="text-sm text-slate mb-4">Expert insights and strategies to elevate your brand&apos;s packaging presence.</p>
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
    return (
        <section className="bg-linen py-24 border-t border-champagne/30 text-center">
            <div className="max-w-xl mx-auto px-6">
                <FadeUp>
                    <h2 className="font-serif text-3xl text-obsidian font-medium mb-4">Stay in the Know</h2>
                    <p className="text-slate mb-8">Packaging insights, new arrivals, and scaling strategies. No spam—just expertise.</p>
                    <form className="flex w-full items-center border border-champagne bg-white p-1 rounded-full shadow-sm hover:border-muted-gold transition-colors focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/20">
                        <input type="email" placeholder="Your email address" className="flex-1 px-6 py-3 bg-transparent text-sm focus:outline-none placeholder-slate/60 text-obsidian" required />
                        <button type="submit" className="px-6 py-3 bg-muted-gold text-white uppercase text-xs font-bold tracking-wider rounded-full hover:bg-obsidian transition-colors duration-300">
                            Subscribe
                        </button>
                    </form>
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
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-muted-gold transition-colors cursor-pointer" />
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-muted-gold transition-colors cursor-pointer" />
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-muted-gold transition-colors cursor-pointer" />
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
                            <li><Link href="/resources" className="hover:text-muted-gold transition-colors">Blog</Link></li>
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
            <Hero hero={homepageData?.hero} />
            <TrustBar />
            <ShopByApplication />
            <CuratedCollections startHereCards={homepageData?.startHereCards} />
            <DesignFamilies designFamilyCards={homepageData?.designFamilyCards} />
            <SocialProof />
            <EducationPreview educationPreview={homepageData?.educationPreview} />
            <Newsletter />
            <Footer />
        </main>
    );
}
