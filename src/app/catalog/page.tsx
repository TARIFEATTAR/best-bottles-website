"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, User, ShoppingBag, ArrowRight, Filter } from "lucide-react";
import { motion } from "framer-motion";

// -- Navbar Component --
function Navbar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-bone/95 shadow-sm backdrop-blur-md" : "bg-bone border-b border-champagne"}`}>
            <div className="bg-bone border-b border-champagne py-1.5 text-center px-4">
                <p className="text-xs uppercase tracking-[0.15em] text-slate font-medium">Free shipping on orders above $199.00</p>
            </div>
            <div className="max-w-[1440px] mx-auto px-6 h-[72px] flex items-center justify-between">
                <div className="flex items-center space-x-12">
                    <Link href="/" className="font-serif text-2xl font-medium tracking-tight text-obsidian">
                        BEST BOTTLES
                    </Link>
                    <nav className="hidden lg:flex items-center space-x-8 text-sm font-medium text-obsidian tracking-wide uppercase">
                        <Link href="/" className="hover:text-muted-gold transition-colors">Shop</Link>
                        <Link href="/" className="text-muted-gold transition-colors">Master Catalog</Link>
                        <Link href="/" className="hover:text-muted-gold transition-colors">About</Link>
                        <Link href="/" className="hover:text-muted-gold transition-colors">Resources</Link>
                    </nav>
                </div>
                <div className="flex items-center space-x-6">
                    <div className="hidden lg:flex items-center border border-champagne rounded-full px-4 py-1.5 bg-white/50 space-x-2">
                        <Search className="w-4 h-4 text-slate" />
                        <input type="text" placeholder="Search..." className="bg-transparent text-sm focus:outline-none w-32 placeholder-slate/70" />
                    </div>
                    <button className="hidden sm:flex items-center space-x-2 text-sm font-medium text-obsidian bg-[#FFF] border border-champagne px-3 py-1.5 rounded-full hover:border-muted-gold transition-colors shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-muted-gold animate-pulse"></span>
                        <span>Ask Grace</span>
                    </button>
                    <div className="flex items-center space-x-4">
                        <button aria-label="Account" className="hover:text-muted-gold transition-colors">
                            <User className="w-5 h-5 text-obsidian" strokeWidth={1.5} />
                        </button>
                        <button aria-label="Cart" className="hover:text-muted-gold transition-colors relative">
                            <ShoppingBag className="w-5 h-5 text-obsidian" strokeWidth={1.5} />
                            <span className="absolute -top-1.5 -right-1.5 bg-muted-gold text-white text-[10px] w-[16px] h-[16px] flex items-center justify-center rounded-full font-semibold">2</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}

const SHAPES = ["Boston Round", "Cylinder", "Square", "Oval", "Specialty"];
const MATERIALS = ["Flint Glass", "Amber Glass", "Frosted Glass", "Opal Glass"];
const NECK_SIZES = ["18/415", "20/400", "24/410", "28/400"];

const MOCK_CATALOG = [
    {
        usage: "Perfume & Fragrance",
        collections: [
            {
                name: "Elegant Collection",
                id: "perfume-elegant",
                desc: "Refined profiles and heavier bottom weights ideal for fine niche fragrance lines.",
                products: [
                    { name: "50ml Rectangular Perfume", sku: "PERF-ELEG-50-R", image: "/assets/collection_perfume.png", price: "$1.45/ea", moq: "500 units" },
                    { name: "30ml Cylinder Perfume", sku: "PERF-CYL-30-C", image: "/assets/family_cylinder.png", price: "$1.20/ea", moq: "500 units" },
                    { name: "15ml Travel Spray", sku: "PERF-TRV-15-S", image: "/assets/hero_bottles.png", price: "$0.85/ea", moq: "1,000 units" },
                    { name: "100ml Heavy Base Flacon", sku: "PERF-Hvy-100", image: "/assets/collection_perfume.png", price: "$2.15/ea", moq: "500 units" }
                ]
            }
        ]
    },
    {
        usage: "Skincare & Serum",
        collections: [
            {
                name: "Circle Collection",
                id: "skin-circle",
                desc: "Soft approachable rounded silhouettes optimized for dropper and treatment pump fitments.",
                products: [
                    { name: "30ml Frosted Boston Round", sku: "SKIN-FRST-30", image: "/assets/collection_skincare.png", price: "$1.15/ea", moq: "500 units" },
                    { name: "50ml Frosted Serum Pump", sku: "SKIN-FRST-50-P", image: "/assets/hero_bottles.png", price: "$1.85/ea", moq: "1,000 units" },
                    { name: "15ml Dropper Essential", sku: "SKIN-FRST-15-D", image: "/assets/collection_skincare.png", price: "$0.95/ea", moq: "1,000 units" },
                    { name: "100ml Frosted Toner", sku: "SKIN-FRST-100", image: "/assets/family_cylinder.png", price: "$1.50/ea", moq: "500 units" }
                ]
            },
            {
                name: "Amber Apothecary",
                id: "skin-amber",
                desc: "The timeless standard in essential oil protection. UV resistant domestically sourced amber glass.",
                products: [
                    { name: "30ml Amber Round (Dropper)", sku: "SKIN-AMB-30-D", image: "/assets/bottle_dropper.png", price: "$1.60/ea", moq: "500 units", link: "/collections/boston-round-30ml" },
                    { name: "30ml Amber Round (Sprayer)", sku: "SKIN-AMB-30-S", image: "/assets/bottle_sprayer.png", price: "$2.00/ea", moq: "500 units" },
                    { name: "30ml Amber Round (Cap)", sku: "SKIN-AMB-30-C", image: "/assets/bottle_screwcap.png", price: "$1.30/ea", moq: "500 units" },
                    { name: "15ml Botanical Dropper", sku: "SKIN-AMB-15-E", image: "/assets/collection_amber.png", price: "$1.10/ea", moq: "1,000 units" },
                    { name: "100ml Amber Room Spray", sku: "SKIN-AMB-100-RS", image: "/assets/bottle_sprayer.png", price: "$2.80/ea", moq: "500 units" },
                    { name: "5ml Sample Vial", sku: "SKIN-AMB-05", image: "/assets/collection_amber.png", price: "$0.45/ea", moq: "2,500 units" }
                ]
            }
        ]
    }
];

export default function CatalogPage() {
    const [activeSegment, setActiveSegment] = useState("");

    // A simple spy logic - normally you'd use IntersectionObserver
    useEffect(() => {
        const handleScroll = () => {
            let current = "";
            const sections = document.querySelectorAll('section[id]');
            sections.forEach(section => {
                const sectionTop = (section as HTMLElement).offsetTop;
                if (scrollY >= sectionTop - 150) {
                    current = section.getAttribute('id') || "";
                }
            });
            if (current) setActiveSegment(current);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            window.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' });
        }
    };

    return (
        <main className="min-h-screen bg-bone pt-[104px]">
            <Navbar />

            <div className="max-w-[1440px] mx-auto px-6 py-8">

                {/* Catalog Header */}
                <div className="mb-12 border-b border-champagne/50 pb-8 flex flex-col md:flex-row md:items-end justify-between">
                    <div>
                        <h1 className="font-serif text-4xl lg:text-5xl text-obsidian font-medium leading-[1.1] mb-2">Master Catalog</h1>
                        <p className="text-slate text-sm max-w-xl">
                            An infinite scroll of our entire 3,100+ product inventory. Or, let Grace guide you directly to the perfect vessel.
                        </p>
                    </div>
                    <div className="mt-6 md:mt-0 flex items-center space-x-4">
                        <p className="text-xs uppercase tracking-wider font-semibold text-slate">Filter By:</p>
                        <button className="flex items-center space-x-2 text-xs font-semibold uppercase border border-champagne px-4 py-2 rounded-sm bg-white hover:border-obsidian transition-colors">
                            <Filter className="w-4 h-4" /> <span>Material</span>
                        </button>
                        <button className="flex items-center space-x-2 text-xs font-semibold uppercase border border-champagne px-4 py-2 rounded-sm bg-white hover:border-obsidian transition-colors">
                            <Filter className="w-4 h-4" /> <span>Neck Size</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row items-start lg:space-x-12">

                    {/* Sticky Sidebar Taxonomy */}
                    <aside className="hidden lg:block w-72 shrink-0 sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto hide-scroll pb-12">
                        <h3 className="font-serif text-xl text-obsidian border-b border-champagne pb-3 mb-6">Taxonomy</h3>

                        {MOCK_CATALOG.map((usageGroup, i) => (
                            <div key={i} className="mb-8">
                                <p className="text-xs uppercase tracking-wider font-bold text-slate mb-4">
                                    Axis 1: {usageGroup.usage}
                                </p>
                                <div className="space-y-2 border-l border-champagne ml-2 pl-4">
                                    {usageGroup.collections.map((col) => (
                                        <button
                                            key={col.id}
                                            onClick={() => scrollTo(col.id)}
                                            className={`block text-left text-sm transition-colors w-full ${activeSegment === col.id ? "text-muted-gold font-semibold" : "text-obsidian hover:text-muted-gold"
                                                }`}
                                        >
                                            {col.name} ({col.products.length})
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Simulated Additional Filters to show depth */}
                        <div className="mt-12 pt-8 border-t border-champagne/40 opacity-50 pointer-events-none">
                            <p className="text-xs uppercase tracking-wider font-bold text-slate mb-4">Axis 2: Shape Family</p>
                            <div className="space-y-3">
                                {SHAPES.map(s => <p key={s} className="text-sm text-obsidian">{s}</p>)}
                            </div>
                        </div>
                    </aside>

                    {/* Long-form Infinite Scroll Content Area */}
                    <div className="flex-1 w-full pb-32 border-l-0 lg:border-l border-champagne/30 lg:pl-12">

                        {MOCK_CATALOG.map((usageGroup, i) => (
                            <div key={i} className="mb-24 last:mb-0">

                                {/* Usage Category Header (Sticky to the viewport conditionally?) */}
                                <div className="sticky top-[104px] z-30 bg-bone/95 backdrop-blur-md pt-4 pb-2 mb-8 border-b-2 border-obsidian">
                                    <p className="text-xs uppercase tracking-[0.2em] text-muted-gold font-bold mb-1">Category</p>
                                    <h2 className="font-serif text-3xl font-medium text-obsidian">{usageGroup.usage}</h2>
                                </div>

                                {/* Sub-sections / Collections */}
                                <div className="space-y-20">
                                    {usageGroup.collections.map((collection) => (
                                        <section id={collection.id} key={collection.id} className="scroll-mt-[180px]">

                                            {/* Family Header */}
                                            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 border-b border-champagne pb-4">
                                                <div>
                                                    <h3 className="font-serif text-2xl font-medium text-obsidian mb-2">{collection.name}</h3>
                                                    <p className="text-sm text-slate max-w-lg">{collection.desc}</p>
                                                </div>
                                                <span className="mt-4 md:mt-0 px-3 py-1 bg-white border border-champagne text-xs font-semibold text-slate uppercase rounded-full inline-flex max-w-max">
                                                    {collection.products.length} Products
                                                </span>
                                            </div>

                                            {/* Product Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {collection.products.map((product, pIndex) => (
                                                    <Link
                                                        href={product.link || "/collections/boston-round-30ml"}
                                                        key={pIndex}
                                                    >
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            whileInView={{ opacity: 1, y: 0 }}
                                                            viewport={{ once: true, margin: "-50px" }}
                                                            transition={{ duration: 0.5, delay: pIndex * 0.05 }}
                                                            className="group cursor-pointer flex flex-col h-full bg-white rounded-sm border border-champagne/40 overflow-hidden hover:border-muted-gold hover:shadow-lg transition-all duration-300"
                                                        >
                                                            <div className="relative aspect-[4/5] bg-travertine w-full overflow-hidden">
                                                                <Image
                                                                    src={product.image}
                                                                    alt={product.name}
                                                                    fill
                                                                    className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                                                                />
                                                                <div className="absolute inset-0 bg-transparent group-hover:bg-obsidian/5 transition-colors duration-300 pointer-events-none"></div>

                                                                {/* Quick Add Layer */}
                                                                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-white/95 to-white/60 backdrop-blur-sm border-t border-white/50">
                                                                    <button className="w-full py-2 bg-obsidian text-white text-[11px] uppercase font-bold tracking-wider hover:bg-muted-gold transition-colors">
                                                                        Quick Configure
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="p-5 flex flex-col flex-1">
                                                                <p className="text-[10px] text-slate uppercase tracking-wider font-bold mb-1">{product.sku}</p>
                                                                <h4 className="font-serif text-lg text-obsidian font-medium mb-4 flex-1">{product.name}</h4>
                                                                <div className="flex items-end justify-between mt-auto">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-slate">Tier 1 Pricing</span>
                                                                        <span className="font-semibold text-obsidian">{product.price}</span>
                                                                    </div>
                                                                    <span className="text-[10px] text-slate uppercase font-medium bg-travertine px-2 py-1 rounded-sm border border-champagne">
                                                                        MOQ: {product.moq}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    </Link>
                                                ))}
                                            </div>

                                        </section>
                                    ))}
                                </div>

                            </div>
                        ))}

                        {/* Infinite Scroll Loader Mock */}
                        <div className="flex justify-center py-16 border-t border-champagne/40">
                            <div className="flex flex-col items-center opacity-60">
                                <div className="w-8 h-8 rounded-full border-2 border-champagne border-t-muted-gold animate-spin mb-4"></div>
                                <p className="text-xs uppercase tracking-widest font-semibold text-slate">Loading more collections...</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </main>
    );
}
