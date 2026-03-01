"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Search, User, ShoppingBag, Mic, ChevronDown, Menu, X,
    Sparkles, FlaskConical, Gem, ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGrace } from "./GraceProvider";
import { useCart } from "./CartProvider";
import CartDrawer from "./CartDrawer";
import { useMegaMenuPanels } from "./SanityMegaMenuProvider";
import { urlFor } from "@/sanity/lib/image";

interface NavbarProps {
    variant?: "home" | "catalog";
    initialSearchValue?: string;
    /** @deprecated cart is now managed internally */
    onCartOpen?: () => void;
}

// ─── Mega Menu Data ──────────────────────────────────────────────────────────

type MegaMenuId = "bottles" | "closures" | "specialty";

interface MenuColumn {
    heading: string;
    links: Array<{ label: string; href: string; badge?: string }>;
}

interface FeaturedCard {
    title: string;
    subtitle: string;
    href: string;
    placeholderIcon: LucideIcon;
    accentColor: string;
}

interface MegaPanel {
    columns: MenuColumn[];
    featured: FeaturedCard;
    footerLinks: Array<{ label: string; href: string }>;
}

const MEGA_PANELS: Record<MegaMenuId, MegaPanel> = {
    bottles: {
        columns: [
            {
                heading: "Applicator Type",
                links: [
                    { label: "Roll-On", href: "/catalog?applicators=rollon", badge: "28" },
                    { label: "Dropper", href: "/catalog?applicators=dropper", badge: "19" },
                    { label: "Fine Mist Spray", href: "/catalog?applicators=spray", badge: "53" },
                    { label: "Reducer & Orifice", href: "/catalog?applicators=reducer", badge: "28" },
                    { label: "Lotion & Treatment Pump", href: "/catalog?applicators=lotionpump", badge: "32" },
                ],
            },
            {
                heading: "Design Families",
                links: [
                    { label: "Diva", href: "/catalog?families=Diva" },
                    { label: "Slim", href: "/catalog?families=Slim" },
                    { label: "Sleek", href: "/catalog?families=Sleek" },
                    { label: "Circle", href: "/catalog?families=Circle" },
                    { label: "Empire", href: "/catalog?families=Empire" },
                    { label: "Elegant", href: "/catalog?families=Elegant" },
                    { label: "Cylinder", href: "/catalog?families=Cylinder" },
                    { label: "Boston Round", href: "/catalog?families=Boston+Round" },
                    { label: "View All Families", href: "/catalog?category=Glass+Bottle" },
                ],
            },
            {
                heading: "Capacity",
                links: [
                    { label: "Miniature — 1 to 5 ml", href: "/catalog?capacities=1+ml+(0.03+oz)&capacities=2+ml+(0.07+oz)&capacities=3+ml+(0.1+oz)&capacities=4+ml+(0.14+oz)&capacities=5+ml+(0.17+oz)" },
                    { label: "Small — 6 to 15 ml", href: "/catalog?capacities=6+ml+(0.2+oz)&capacities=8+ml+(0.27+oz)&capacities=9+ml+(0.3+oz)&capacities=10+ml+(0.34+oz)&capacities=13+ml+(0.44+oz)&capacities=14+ml+(0.47+oz)&capacities=15+ml+(0.51+oz)" },
                    { label: "Medium — 25 to 50 ml", href: "/catalog?capacities=25+ml+(0.85+oz)&capacities=28+ml+(0.95+oz)&capacities=30+ml+(1.01+oz)&capacities=46+ml+(1.56+oz)&capacities=50+ml+(1.69+oz)" },
                    { label: "Large — 55 to 120 ml", href: "/catalog?capacities=55+ml+(1.86+oz)&capacities=60+ml+(2.03+oz)&capacities=78+ml+(2.64+oz)&capacities=100+ml+(3.38+oz)&capacities=118+ml+(3.99+oz)&capacities=120+ml+(4.06+oz)" },
                    { label: "Bulk — 128 ml+", href: "/catalog?capacities=128+ml+(4.33+oz)&capacities=355+ml+(12+oz)&capacities=500+ml+(16.91+oz)" },
                ],
            },
        ],
        featured: {
            title: "New: Grace Collection",
            subtitle: "Refined 55 ml silhouette with premium spray, reducer, and lotion pump options.",
            href: "/catalog?families=Grace",
            placeholderIcon: Sparkles,
            accentColor: "bg-gradient-to-br from-muted-gold/20 to-champagne/40",
        },
        footerLinks: [
            { label: "Browse All 276 Products", href: "/catalog" },
            { label: "Shop by Glass Color", href: "/catalog" },
        ],
    },
    closures: {
        columns: [
            {
                heading: "Spray & Pump Mechanisms",
                links: [
                    { label: "Fine Mist Sprayers", href: "/catalog?category=Component&search=fine+mist", badge: "26" },
                    { label: "Antique Bulb Atomizers", href: "/catalog?category=Component&search=antique+bulb", badge: "18" },
                    { label: "Treatment & Lotion Pumps", href: "/catalog?category=Component&search=lotion+pump", badge: "11" },
                ],
            },
            {
                heading: "Caps, Rollers & Droppers",
                links: [
                    { label: "Screw Caps", href: "/catalog?category=Component&search=closure", badge: "26" },
                    { label: "Dropper Assemblies", href: "/catalog?category=Component&search=dropper", badge: "21" },
                    { label: "Glass Stoppers & Rods", href: "/catalog?search=stopper" },
                    { label: "Roll-On Fitments & Caps", href: "/catalog?category=Component&search=roll-on+fitment", badge: "25" },
                ],
            },
            {
                heading: "Helpful Resources",
                links: [
                    { label: "How Assemblies Work", href: "/catalog" },
                    { label: "Thread Size Reference", href: "/catalog" },
                    { label: "Fitment Compatibility Guide", href: "/catalog" },
                ],
            },
        ],
        featured: {
            title: "Find Compatible Parts",
            subtitle: "Every bottle page shows its compatible closures. Or ask Grace to match parts by thread size.",
            href: "/catalog?category=Component",
            placeholderIcon: FlaskConical,
            accentColor: "bg-gradient-to-br from-slate/10 to-champagne/30",
        },
        footerLinks: [
            { label: "All Components & Closures", href: "/catalog?category=Component" },
            { label: "Ask Grace for Help", href: "/catalog" },
        ],
    },
    specialty: {
        columns: [
            {
                heading: "Unique & Artisan Bottles",
                links: [
                    { label: "Metal Atomizers", href: "/catalog?families=Atomizer", badge: "20" },
                    { label: "Aluminum Bottles", href: "/catalog?category=Aluminum+Bottle" },
                    { label: "Plastic Spray Bottles", href: "/catalog?families=Plastic+Bottle" },
                    { label: "Apothecary Collection", href: "/catalog?families=Apothecary" },
                    { label: "Decorative & Shaped Glass", href: "/catalog?families=Decorative" },
                ],
            },
            {
                heading: "Skincare & Body Care",
                links: [
                    { label: "Cream & Cosmetic Jars", href: "/catalog?families=Cream+Jar", badge: "17" },
                    { label: "Sample Vials & Testers", href: "/catalog?families=Vial", badge: "23" },
                    { label: "Lotion & Serum Bottles", href: "/catalog?families=Lotion+Bottle" },
                ],
            },
            {
                heading: "Packaging & Presentation",
                links: [
                    { label: "Gift Bags", href: "/catalog?search=gift+bag", badge: "21" },
                    { label: "Gift Boxes", href: "/catalog?search=gift+box", badge: "14" },
                    { label: "Packaging Supplies", href: "/catalog?search=packaging+supply", badge: "12" },
                    { label: "Tools & Filling Accessories", href: "/catalog?search=tool" },
                ],
            },
        ],
        featured: {
            title: "Decorative Collection",
            subtitle: "Heart, Tola, Marble, Genie, Eternal Flame, and Pear — exquisite artisan shapes.",
            href: "/catalog?families=Decorative",
            placeholderIcon: Gem,
            accentColor: "bg-gradient-to-br from-rose-50 to-champagne/40",
        },
        footerLinks: [
            { label: "Browse Full Catalog", href: "/catalog" },
            { label: "Request Custom Quote", href: "/contact" },
        ],
    },
};

type NavLinkDef =
    | { label: string; href: string; megaId: MegaMenuId }
    | { label: string; href: string };

const NAV_LINKS: Record<string, NavLinkDef[]> = {
    home: [
        { label: "Bottles", href: "/catalog?category=Glass+Bottle", megaId: "bottles" as MegaMenuId },
        { label: "Closures", href: "/catalog?category=Component", megaId: "closures" as MegaMenuId },
        { label: "Specialty", href: "/catalog", megaId: "specialty" as MegaMenuId },
        { label: "About", href: "/about" },
        { label: "Resources", href: "/resources" },
    ],
    catalog: [
        { label: "Bottles", href: "/catalog?category=Glass+Bottle", megaId: "bottles" as MegaMenuId },
        { label: "Closures", href: "/catalog?category=Component", megaId: "closures" as MegaMenuId },
        { label: "Specialty", href: "/catalog", megaId: "specialty" as MegaMenuId },
        { label: "About", href: "/about" },
        { label: "Resources", href: "/resources" },
    ],
};

export default function Navbar({ variant = "home", initialSearchValue }: NavbarProps) {
    const router = useRouter();
    const { openPanel, isOpen: graceActive } = useGrace();
    const { itemCount } = useCart();
    const megaMenuPanels = useMegaMenuPanels();
    const [cartOpen, setCartOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isDictating, setIsDictating] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [micErrorMsg, setMicErrorMsg] = useState("");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        if (initialSearchValue !== undefined) {
            setSearchValue(initialSearchValue);
        }
    }, [initialSearchValue]);

    const stopDictation = () => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        setIsDictating(false);
    };

    const startDictation = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/mp4")
                ? "audio/mp4"
                : "";
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(audioChunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });
                if (blob.size < 500) return;
                setIsTranscribing(true);
                try {
                    const fd = new FormData();
                    fd.append("audio", blob, "recording.webm");
                    const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
                    if (!res.ok) return;
                    const { text } = (await res.json()) as { text: string };
                    if (text?.trim()) setSearchValue(text.trim());
                } catch {
                    // silent fail
                } finally {
                    setIsTranscribing(false);
                }
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsDictating(true);

            try {
                const audioCtx = new AudioContext();
                audioContextRef.current = audioCtx;
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                audioCtx.createMediaStreamSource(stream).connect(analyser);
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                const SILENCE_THRESHOLD = 8;
                const SILENCE_DELAY_MS = 1500;

                const checkSilence = () => {
                    if (mediaRecorderRef.current?.state !== "recording") return;
                    analyser.getByteFrequencyData(dataArray);
                    const rms = Math.sqrt(
                        dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length
                    );
                    if (rms < SILENCE_THRESHOLD) {
                        if (!silenceTimerRef.current) {
                            silenceTimerRef.current = setTimeout(() => {
                                silenceTimerRef.current = null;
                                stopDictation();
                            }, SILENCE_DELAY_MS);
                        }
                    } else {
                        if (silenceTimerRef.current) {
                            clearTimeout(silenceTimerRef.current);
                            silenceTimerRef.current = null;
                        }
                    }
                    requestAnimationFrame(checkSilence);
                };
                requestAnimationFrame(checkSilence);
            } catch {
                // AudioContext unavailable
            }
        } catch (err) {
            console.error("[Search STT] Failed to start recording:", err);
            const msg =
                err instanceof Error && err.name === "NotAllowedError"
                    ? "Mic access denied — check browser settings"
                    : "Could not start microphone";
            setMicErrorMsg(msg);
            setTimeout(() => setMicErrorMsg(""), 3500);
        }
    };

    const handleSearchSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        const term = searchValue.trim();
        if (term) {
            router.push(`/catalog?search=${encodeURIComponent(term)}`);
        } else {
            router.push("/catalog");
        }
    };

    const handleMicClick = () => {
        if (isDictating) stopDictation();
        else startDictation();
    };

    const links = NAV_LINKS[variant];
    const [activeMega, setActiveMega] = useState<MegaMenuId | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileOpenSection, setMobileOpenSection] = useState<MegaMenuId | null>(null);
    const megaRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openMega = useCallback((id: MegaMenuId) => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setActiveMega(id);
    }, []);

    const closeMega = useCallback(() => {
        closeTimerRef.current = setTimeout(() => setActiveMega(null), 180);
    }, []);

    const cancelClose = useCallback(() => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
                setActiveMega(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setActiveMega(null);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    useEffect(() => {
        document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [mobileMenuOpen]);

    return (
        <>
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    scrolled ? "bg-bone/95 shadow-sm backdrop-blur-md" : "bg-bone"
                } ${variant === "catalog" ? "border-b border-champagne" : ""}`}
            >
                <div className="bg-obsidian py-1.5 text-center px-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-bone font-medium">
                        <span>Free shipping on orders above $99</span>
                        <span className="hidden md:inline"> · Need fitment help? Ask Grace, AI Bottling Specialist</span>
                    </p>
                </div>

                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4 sm:gap-6">
                    <div className="flex items-center space-x-10 shrink-0">
                        <button
                            aria-label="Open menu"
                            className="lg:hidden p-2 -ml-2 text-obsidian hover:text-muted-gold transition-colors"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <Menu className="w-5 h-5" strokeWidth={1.75} />
                        </button>
                        <Link href="/" className="font-display text-2xl font-medium tracking-tight text-obsidian">
                            BEST BOTTLES
                        </Link>
                        <nav
                            className="hidden lg:flex items-center space-x-8 text-sm font-medium text-obsidian tracking-wide uppercase"
                            ref={megaRef}
                        >
                            {links.map((link) => {
                                const hasMega = "megaId" in link;
                                const megaId = hasMega ? (link as NavLinkDef & { megaId: MegaMenuId }).megaId : null;
                                const isOpen = megaId !== null && activeMega === megaId;

                                return hasMega && megaId ? (
                                    <div
                                        key={link.label}
                                        className="relative"
                                        onMouseEnter={() => openMega(megaId)}
                                        onMouseLeave={closeMega}
                                    >
                                        <button
                                            onClick={() => setActiveMega(isOpen ? null : megaId)}
                                            className={`flex items-center gap-1 transition-colors ${
                                                isOpen ? "text-muted-gold" : "hover:text-muted-gold"
                                            }`}
                                        >
                                            {link.label}
                                            <ChevronDown
                                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                                    isOpen ? "rotate-180" : ""
                                                }`}
                                            />
                                        </button>

                                        {isOpen && (
                                            <div
                                                className="fixed left-0 right-0 mt-[22px] z-50"
                                                onMouseEnter={cancelClose}
                                                onMouseLeave={closeMega}
                                            >
                                                <MegaMenuPanel
                                                    panel={MEGA_PANELS[megaId]}
                                                    sanityFeatured={megaMenuPanels?.[megaId]}
                                                    onClose={() => setActiveMega(null)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        className="hover:text-muted-gold transition-colors"
                                        onMouseEnter={() => setActiveMega(null)}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <form
                        onSubmit={handleSearchSubmit}
                        className="hidden lg:flex flex-1 max-w-[460px] items-center border border-champagne rounded-xl px-4 py-2 bg-white/60 focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/15 transition-all duration-200 space-x-2"
                        suppressHydrationWarning
                    >
                        <Search className="w-4 h-4 text-slate shrink-0" />
                        <input
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder={
                                micErrorMsg ? micErrorMsg :
                                isDictating ? "Listening…" :
                                isTranscribing ? "Transcribing…" :
                                "Search bottles, closures, families..."
                            }
                            className="bg-transparent text-sm focus:outline-none flex-1 placeholder-slate/60 text-obsidian"
                            aria-label="Search products"
                            suppressHydrationWarning
                        />
                        <button
                            type="button"
                            onClick={handleMicClick}
                            disabled={isTranscribing}
                            aria-label={isDictating ? "Stop recording" : "Search by voice"}
                            className={`shrink-0 p-1 rounded-lg transition-all duration-200 disabled:cursor-not-allowed ${
                                isDictating
                                    ? "text-muted-gold animate-grace-pulse"
                                    : isTranscribing
                                    ? "text-muted-gold/60 animate-bounce"
                                    : "text-slate/40 hover:text-slate"
                            }`}
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                        <button type="submit" className="sr-only">Search</button>
                    </form>

                    <div className="flex items-center space-x-2 shrink-0">
                        <button
                            onClick={openPanel}
                            aria-label="Ask Grace"
                            title="AI Bottling Specialist"
                            className={`hidden sm:flex items-center space-x-2 text-sm font-medium px-3.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer ${
                                graceActive
                                    ? "bg-obsidian text-bone border-obsidian shadow-md"
                                    : "bg-white text-obsidian border-champagne hover:border-muted-gold shadow-sm"
                            }`}
                        >
                            {graceActive ? (
                                <span className="grace-voice-bars grace-voice-bars--light" aria-hidden="true">
                                    <span /><span /><span /><span />
                                </span>
                            ) : (
                                <span className="w-2 h-2 rounded-full bg-muted-gold animate-grace-pulse shrink-0" />
                            )}
                            <span>Ask Grace</span>
                        </button>

                        <button aria-label="Account" className="p-2 hover:text-muted-gold transition-colors">
                            <User className="w-5 h-5 text-obsidian" strokeWidth={1.5} />
                        </button>

                        <button
                            aria-label="Cart"
                            onClick={() => setCartOpen(true)}
                            className="p-2 hover:text-muted-gold transition-colors relative cursor-pointer"
                        >
                            <ShoppingBag className="w-5 h-5 text-obsidian" strokeWidth={1.5} />
                            {itemCount > 0 && (
                                <span className="absolute top-0.5 right-0.5 bg-muted-gold text-white text-[10px] w-[16px] h-[16px] flex items-center justify-center rounded-full font-semibold">
                                    {itemCount > 99 ? "99" : itemCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <form
                    onSubmit={handleSearchSubmit}
                    className="lg:hidden px-4 sm:px-6 pb-3"
                    suppressHydrationWarning
                >
                    <div className="flex items-center border border-champagne rounded-xl px-3 py-2 bg-white/80 focus-within:border-muted-gold focus-within:ring-2 focus-within:ring-muted-gold/15 transition-all duration-200 space-x-2">
                        <Search className="w-4 h-4 text-slate shrink-0" />
                        <input
                            type="text"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder="Search bottles, closures, families..."
                            className="bg-transparent text-sm focus:outline-none flex-1 placeholder-slate/60 text-obsidian"
                            aria-label="Search products"
                            suppressHydrationWarning
                        />
                        <button
                            type="button"
                            onClick={handleMicClick}
                            disabled={isTranscribing}
                            aria-label={isDictating ? "Stop recording" : "Search by voice"}
                            className={`shrink-0 p-1 rounded-lg transition-all duration-200 disabled:cursor-not-allowed ${
                                isDictating
                                    ? "text-muted-gold animate-grace-pulse"
                                    : isTranscribing
                                    ? "text-muted-gold/60 animate-bounce"
                                    : "text-slate/40 hover:text-slate"
                            }`}
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            </header>

            <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

            {/* Overlay */}
            {activeMega && (
                <div
                    className="fixed inset-0 bg-obsidian/10 z-40 transition-opacity duration-300"
                    onClick={() => setActiveMega(null)}
                />
            )}

            {mobileMenuOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-obsidian/40 z-[60] lg:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    <div className="fixed top-0 left-0 bottom-0 z-[61] w-[360px] max-w-[88vw] bg-bone border-r border-champagne shadow-2xl lg:hidden flex flex-col">
                        <div className="h-[44px] bg-obsidian" />
                        <div className="h-[72px] px-4 flex items-center justify-between border-b border-champagne">
                            <span className="font-display text-2xl tracking-tight text-obsidian">BEST BOTTLES</span>
                            <button
                                aria-label="Close menu"
                                onClick={() => setMobileMenuOpen(false)}
                                className="p-2 text-obsidian hover:text-muted-gold transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4">
                            <nav className="space-y-2">
                                {links.map((link) => {
                                    if (!("megaId" in link)) {
                                        return (
                                            <Link
                                                key={link.label}
                                                href={link.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="flex items-center justify-between py-3 text-sm font-semibold uppercase tracking-wide text-obsidian border-b border-champagne/40"
                                            >
                                                {link.label}
                                                <ArrowRight className="w-4 h-4 text-slate" />
                                            </Link>
                                        );
                                    }

                                    const isExpanded = mobileOpenSection === link.megaId;
                                    const panel = MEGA_PANELS[link.megaId];

                                    return (
                                        <div key={link.label} className="border-b border-champagne/40 pb-2">
                                            <button
                                                onClick={() => setMobileOpenSection(isExpanded ? null : link.megaId)}
                                                className="w-full flex items-center justify-between py-3 text-sm font-semibold uppercase tracking-wide text-obsidian"
                                                aria-expanded={isExpanded}
                                            >
                                                {link.label}
                                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                            </button>
                                            {isExpanded && (
                                                <div className="pb-2 space-y-4">
                                                    {panel.columns.map((col) => (
                                                        <div key={col.heading}>
                                                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate font-bold mb-2">
                                                                {col.heading}
                                                            </p>
                                                            <div className="space-y-1">
                                                                {col.links.slice(0, 6).map((item) => (
                                                                    <Link
                                                                        key={item.label}
                                                                        href={item.href}
                                                                        onClick={() => setMobileMenuOpen(false)}
                                                                        className="flex items-center justify-between py-2 text-[13px] text-obsidian"
                                                                    >
                                                                        <span>{item.label}</span>
                                                                        {item.badge && (
                                                                            <span className="text-[10px] text-slate/60">{item.badge}</span>
                                                                        )}
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="p-4 border-t border-champagne bg-white/60">
                            <Link
                                href="/catalog"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-obsidian text-white text-xs uppercase tracking-wider font-bold"
                            >
                                Browse Full Catalog
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

// ─── Mega Menu Panel Component ───────────────────────────────────────────────

type SanityFeatured = {
    featuredImage?: { asset?: { _ref: string } };
    title?: string;
    subtitle?: string;
    href?: string;
};

function MegaMenuPanel({
    panel,
    sanityFeatured,
    onClose,
}: {
    panel: MegaPanel;
    sanityFeatured?: SanityFeatured | null;
    onClose: () => void;
}) {
    const FeaturedIcon = panel.featured.placeholderIcon;
    const title = sanityFeatured?.title ?? panel.featured.title;
    const subtitle = sanityFeatured?.subtitle ?? panel.featured.subtitle;
    const href = sanityFeatured?.href ?? panel.featured.href;
    const featuredImageUrl = sanityFeatured?.featuredImage ? urlFor(sanityFeatured.featuredImage) : "";

    return (
        <div className="bg-white border-t border-b border-champagne shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-w-[1440px] mx-auto px-8 py-8">
                <div className="flex gap-8">
                    {/* Link Columns */}
                    <div className="flex-1 grid grid-cols-3 gap-8">
                        {panel.columns.map((col) => (
                            <div key={col.heading}>
                                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate font-semibold mb-4 normal-case">
                                    {col.heading}
                                </h3>
                                <ul className="space-y-1">
                                    {col.links.map((item) => (
                                        <li key={item.label}>
                                            <Link
                                                href={item.href}
                                                onClick={onClose}
                                                className="group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md hover:bg-linen transition-colors duration-150"
                                            >
                                                <span className="text-[13px] text-obsidian normal-case font-normal group-hover:text-muted-gold transition-colors">
                                                    {item.label}
                                                </span>
                                                {item.badge && (
                                                    <span className="text-[10px] text-slate/60 font-medium tabular-nums">
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Featured Card */}
                    <Link
                        href={href}
                        onClick={onClose}
                        className={`group w-[280px] shrink-0 rounded-lg p-6 ${panel.featured.accentColor} border border-champagne/30 hover:border-muted-gold/40 transition-all duration-200 flex flex-col justify-between overflow-hidden`}
                    >
                        <div>
                            {featuredImageUrl ? (
                                <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-4 -mx-2 -mt-2">
                                    <Image
                                        src={featuredImageUrl}
                                        alt={title}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-white/70 flex items-center justify-center mb-4 shadow-sm">
                                    <FeaturedIcon className="w-5 h-5 text-muted-gold" strokeWidth={1.5} />
                                </div>
                            )}
                            <h4 className="font-serif text-lg text-obsidian font-medium normal-case mb-2 group-hover:text-muted-gold transition-colors">
                                {title}
                            </h4>
                            <p className="text-[12px] text-slate normal-case leading-relaxed">
                                {subtitle}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-gold">
                            <span className="normal-case">Explore</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>
                </div>

                {/* Footer Links */}
                <div className="border-t border-champagne/50 mt-6 pt-4 flex items-center justify-between">
                    {panel.footerLinks.map((fl) => (
                        <Link
                            key={fl.label}
                            href={fl.href}
                            onClick={onClose}
                            className="text-[11px] uppercase tracking-wider text-slate hover:text-muted-gold transition-colors font-semibold normal-case flex items-center gap-1"
                        >
                            {fl.label}
                            <ArrowRight className="w-3 h-3" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
