"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Search, User, ShoppingBag, ArrowRight, ArrowLeft, Shield, Zap, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

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
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-bone/95 shadow-sm backdrop-blur-md" : "bg-bone"}`}>
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
                        <Link href="/" className="hover:text-muted-gold transition-colors">Collections</Link>
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

// -- Product Configurator Data --
const fitments = [
    {
        id: "dropper",
        name: "Black Glass Dropper",
        priceUnit: 0.45,
        summary: "UV protection ready, ideal for essential oils and premium serums.",
        image: "/assets/bottle_dropper.png"
    },
    {
        id: "sprayer",
        name: "Gold Fine Mist Sprayer",
        priceUnit: 0.85,
        summary: "Ultra-fine atomization. Perfect for luxury room sprays and perfumes.",
        image: "/assets/bottle_sprayer.png"
    },
    {
        id: "screwcap",
        name: "Ribbed Phenolic Screw Cap",
        priceUnit: 0.15,
        summary: "Industry standard secure closure with polycone liner.",
        image: "/assets/bottle_screwcap.png"
    }
];

const b2bTiers = [
    { name: "Graduate", volume: "12–499", discount: 0 },
    { name: "Scaler", volume: "500–4,999", discount: 0.15 },
    { name: "Professional", volume: "5,000+", discount: 0.35 }
];

export default function ProductPage() {
    const [activeFitment, setActiveFitment] = useState(fitments[0]);
    const [quantity, setQuantity] = useState(500);

    const basePriceUnit = 1.15; // Price of the bottle alone
    const calculatedUnitPrice = basePriceUnit + activeFitment.priceUnit;

    // Determine active tier based on quantity
    let activeTier = b2bTiers[0];
    if (quantity >= 500 && quantity < 5000) activeTier = b2bTiers[1];
    if (quantity >= 5000) activeTier = b2bTiers[2];

    const finalUnitPrice = calculatedUnitPrice * (1 - activeTier.discount);
    const totalEstimation = finalUnitPrice * quantity;

    return (
        <main className="min-h-screen bg-bone pt-[156px] lg:pt-[104px]">
            <Navbar />

            <div className="max-w-[1440px] mx-auto px-6 py-8">
                {/* Breadcrumb */}
                <div className="flex items-center text-xs text-slate uppercase tracking-wider font-semibold mb-8">
                    <Link href="/" className="hover:text-muted-gold transition-colors">Shop</Link>
                    <span className="mx-2">/</span>
                    <Link href="/" className="hover:text-muted-gold transition-colors">By Collection</Link>
                    <span className="mx-2">/</span>
                    <span className="text-obsidian">Amber Boston Round 30ml</span>
                </div>

                <div className="flex flex-col lg:flex-row gap-16">

                    {/* Left: Product Stage (Paper Doll Image Swap) */}
                    <div className="w-full lg:w-1/2 relative bg-travertine rounded-sm min-h-[500px] lg:min-h-[750px] shadow-sm flex items-center justify-center overflow-hidden border border-champagne/30">
                        {/* Contextual Badges */}
                        <div className="absolute top-6 left-6 z-20 flex space-x-2">
                            <span className="px-3 py-1 bg-white/80 backdrop-blur-sm shadow-sm text-obsidian text-[10px] uppercase tracking-wider font-bold rounded-full border border-champagne/50">
                                In Stock
                            </span>
                            <span className="px-3 py-1 bg-obsidian/5 backdrop-blur-sm text-obsidian text-[10px] uppercase tracking-wider font-bold rounded-full border border-champagne/50">
                                Domestically Sourced
                            </span>
                        </div>

                        {/* Image Swap Animation Container */}
                        <AnimatePresence mode="popLayout">
                            <motion.div
                                key={activeFitment.id}
                                initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
                                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)", position: "absolute" }}
                                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                                className="w-full h-full relative"
                            >
                                <Image
                                    src={activeFitment.image}
                                    alt={`Boston Round assembled with ${activeFitment.name}`}
                                    fill
                                    className="object-cover object-center"
                                    priority
                                />
                            </motion.div>
                        </AnimatePresence>

                        {/* Subtle Gradient overlay for grounded lighting */}
                        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/10 to-transparent pointer-events-none mix-blend-multiply"></div>
                    </div>

                    {/* Right: Product Configurator */}
                    <div className="w-full lg:w-1/2 flex flex-col pt-4 lg:pr-[4vw] pb-24">

                        <h1 className="font-serif text-4xl lg:text-5xl text-obsidian font-medium leading-[1.1] mb-4">
                            Amber Boston Round <span className="text-slate italic font-light">30ml</span>
                        </h1>

                        <p className="text-slate text-sm leading-relaxed mb-8 max-w-lg">
                            The industry standard, elevated. Our signature UV-resistant amber glass is moulded domestically to ensure uniform wall thickness and absolute stability for your formulations.
                        </p>

                        {/* Spec grid */}
                        <div className="grid grid-cols-3 gap-6 py-6 border-y border-champagne/40 mb-10">
                            <div>
                                <p className="text-xs text-slate uppercase tracking-wider font-semibold mb-1">Neck Finish</p>
                                <p className="text-sm font-medium text-obsidian">20/400</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate uppercase tracking-wider font-semibold mb-1">Material</p>
                                <p className="text-sm font-medium text-obsidian">Type III Glass</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate uppercase tracking-wider font-semibold mb-1">Origin</p>
                                <p className="text-sm font-medium text-obsidian flex items-center">USA <Shield className="w-3 h-3 ml-1 text-muted-gold" /></p>
                            </div>
                        </div>

                        {/* Paper Doll: Fitment Selection */}
                        <div className="mb-10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-serif text-xl text-obsidian font-medium">Select Cap / Fitment</h3>
                                <span className="text-xs font-medium text-slate">Neck Size: 20/400</span>
                            </div>

                            <div className="space-y-3">
                                {fitments.map((fitment) => {
                                    const isActive = activeFitment.id === fitment.id;
                                    return (
                                        <div
                                            key={fitment.id}
                                            onClick={() => setActiveFitment(fitment)}
                                            className={`relative w-full p-4 rounded-sm border cursor-pointer transition-all duration-300 flex items-start group ${isActive
                                                    ? "bg-white border-muted-gold shadow-[0_0_0_1px_#C5A065]"
                                                    : "bg-transparent border-champagne hover:border-obsidian/30 hover:bg-white/50"
                                                }`}
                                        >
                                            {/* Custom Radio Button */}
                                            <div className={`mt-0.5 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center mr-4 transition-colors ${isActive ? "border-muted-gold bg-muted-gold" : "border-slate/40 group-hover:border-obsidian/50"
                                                }`}>
                                                {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className={`text-sm font-medium ${isActive ? "text-obsidian" : "text-slate group-hover:text-obsidian transition-colors"}`}>
                                                        {fitment.name}
                                                    </p>
                                                    <p className="text-[13px] text-slate font-ibm">
                                                        +${fitment.priceUnit.toFixed(2)} /unit
                                                    </p>
                                                </div>
                                                <p className={`text-[13px] leading-relaxed transition-colors ${isActive ? "text-slate" : "text-slate/60"}`}>
                                                    {fitment.summary}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* B2B Tier Pricing Display */}
                        <div className="bg-white p-6 rounded-sm border border-champagne/60 shadow-sm mb-10 relative overflow-hidden">
                            <h3 className="font-serif text-[18px] text-obsidian font-medium mb-4">Volume Pricing Tier</h3>

                            <div className="grid grid-cols-3 gap-2 mb-6">
                                {b2bTiers.map((tier) => {
                                    const isTierActive = activeTier.name === tier.name;
                                    return (
                                        <div key={tier.name} className={`text-center py-2 px-1 border-b-2 transition-colors ${isTierActive ? "border-muted-gold" : "border-transparent"
                                            }`}>
                                            <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${isTierActive ? "text-muted-gold" : "text-slate/60"
                                                }`}>{tier.name}</p>
                                            <p className={`text-[13px] font-medium ${isTierActive ? "text-obsidian" : "text-slate/60"
                                                }`}>{tier.volume}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Configure Quantity */}
                            <div className="flex items-end justify-between border-t border-champagne/40 pt-6">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider font-semibold text-slate mb-2">Order Quantity</label>
                                    <div className="flex items-center border border-champagne rounded-sm overflow-hidden bg-bone">
                                        <input
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                                            className="w-24 px-4 py-2 bg-transparent text-center text-sm font-medium text-obsidian focus:outline-none focus:bg-white transition-colors"
                                            min="1"
                                        />
                                        <div className="w-px h-6 bg-champagne"></div>
                                        <span className="px-3 text-xs text-slate font-medium">Units</span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-xs uppercase tracking-wider font-semibold text-slate mb-1">Estimated Total</p>
                                    <div className="flex items-baseline space-x-2">
                                        <p className="text-sm font-medium text-slate line-through opacity-60">
                                            ${(calculatedUnitPrice * quantity).toFixed(2)}
                                        </p>
                                        <p className="font-serif text-3xl font-medium text-obsidian">
                                            ${totalEstimation.toFixed(2)}
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-gold font-medium mt-1 inline-flex items-center">
                                        <Check className="w-3 h-3 mr-1" />
                                        Unit price: ${finalUnitPrice.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            {/* Grace Interjection Overlay (Subtle) */}
                            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                <Zap className="w-24 h-24 text-muted-gold" />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button className="flex-1 py-4 bg-obsidian text-white uppercase text-sm font-bold tracking-wider hover:bg-muted-gold transition-colors duration-300 shadow-md">
                                Add Configuration to Cart
                            </button>
                            <button className="px-6 py-4 border border-champagne bg-white text-obsidian hover:border-obsidian transition-colors flex items-center justify-center duration-300 shadow-sm">
                                Request Samples
                            </button>
                        </div>

                        {/* Grace Context Interjection */}
                        <div className="mt-8 p-4 bg-bone/50 border border-muted-gold/20 rounded-sm flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-travertine shrink-0 overflow-hidden relative border border-champagne/50">
                                <Image src="/assets/grace_avatar.png" alt="Grace" fill className="object-cover" />
                            </div>
                            <div>
                                <p className="text-[13px] text-slate leading-relaxed">
                                    <span className="font-medium text-obsidian flex items-center"><Zap className="w-3 h-3 mr-1 text-muted-gold" /> Grace AI Suggestion</span>
                                    You&apos;ve selected the {activeFitment.name}. If your product contains high percentages of essential oils, the phenolic cap or glass dropper are optimal. The sprayer mechanism is best for water-based or low-viscosity solutions.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </main>
    );
}
