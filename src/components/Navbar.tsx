"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, User, ShoppingBag, Mic } from "lucide-react";
import { useGrace } from "./GraceProvider";
import { useCart } from "./CartProvider";
import CartDrawer from "./CartDrawer";

interface NavbarProps {
    variant?: "home" | "catalog";
    initialSearchValue?: string;
    /** @deprecated cart is now managed internally */
    onCartOpen?: () => void;
}

const NAV_LINKS = {
    home: [
        { label: "Shop", href: "/catalog" },
        { label: "Collections", href: "/catalog" },
        { label: "About", href: "/about" },
        { label: "Resources", href: "/resources" },
    ],
    catalog: [
        { label: "Home", href: "/" },
        { label: "Master Catalog", href: "/catalog", active: true },
        { label: "About", href: "/about" },
        { label: "Resources", href: "/resources" },
    ],
};

export default function Navbar({ variant = "home", initialSearchValue }: NavbarProps) {
    const router = useRouter();
    const { openPanel, isOpen: graceActive } = useGrace();
    const { itemCount } = useCart();
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

    return (
        <>
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                    scrolled ? "bg-bone/95 shadow-sm backdrop-blur-md" : "bg-bone"
                } ${variant === "catalog" ? "border-b border-champagne" : ""}`}
            >
                <div className="bg-obsidian py-1.5 text-center px-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-bone font-medium">
                        Free shipping on orders above $99
                    </p>
                </div>

                <div className="max-w-[1440px] mx-auto px-6 h-[72px] flex items-center justify-between gap-6">
                    <div className="flex items-center space-x-10 shrink-0">
                        <Link href="/" className="font-serif text-2xl font-medium tracking-tight text-obsidian">
                            BEST BOTTLES
                        </Link>
                        <nav className="hidden lg:flex items-center space-x-8 text-sm font-medium text-obsidian tracking-wide uppercase">
                            {links.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className={`hover:text-muted-gold transition-colors ${
                                        "active" in link && link.active ? "text-muted-gold" : ""
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
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
                            aria-label="Talk to Grace"
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
                            <span>Grace</span>
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
            </header>

            <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
        </>
    );
}
