"use client";

import { useState, useEffect, useRef } from "react";
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CartItem {
    id: string;
    name: string;
    sku: string;
    price: number;
    quantity: number;
    image?: string;
    variant?: string;
}

export interface UpsellItem {
    id: string;
    name: string;
    sku: string;
    price: number;
    image?: string;
    compatibility: string;
    isCompatible: boolean;
}

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    items?: CartItem[];
}

// ─── Mock Data ─────────────────

const DEMO_ITEMS: CartItem[] = [
    {
        id: "1",
        name: "Elegant 30ml Clear Glass Bottle",
        sku: "GBT-ELG-CLR-30ML-18415",
        price: 1.85,
        quantity: 12,
        variant: "18-415 Neck · Clear",
    },
    {
        id: "3",
        name: "Boston Round 30ml Amber",
        sku: "GBST-AMB-30ML",
        price: 0.68,
        quantity: 48,
        variant: "20-400 Neck · Amber",
    },
];

const DEMO_UPSELLS: UpsellItem[] = [
    {
        id: "u1",
        name: "Black Glass Dropper Pivot",
        sku: "CMP-DRP-BLK-18-415",
        price: 1.10,
        compatibility: "Perfect match for Elegant 30ml (18-415)",
        isCompatible: true,
    },
    {
        id: "u2",
        name: "Gold Antique Bulb Sprayer",
        sku: "CMP-SPR-GLD-18-415",
        price: 4.25,
        compatibility: "Premium pairing for Elegant 30ml (18-415)",
        isCompatible: true,
    },
    {
        id: "u3",
        name: "Phenolic Ribbed Cap w/ Cone",
        sku: "CMP-CAP-PHR-20-400",
        price: 0.15,
        compatibility: "Fits Boston Round 30ml Amber (20-400)",
        isCompatible: true,
    },
];

const FREE_SHIPPING_THRESHOLD = 199;

// ─── Cart Drawer Component ─────────────────────────────────────────────────────

export default function CartDrawer({ isOpen, onClose, items = DEMO_ITEMS }: CartDrawerProps) {
    const [cartItems, setCartItems] = useState<CartItem[]>(items);
    const drawerRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    const updateQty = (id: string, delta: number) => {
        setCartItems((prev) =>
            prev
                .map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
                .filter((item) => item.quantity > 0)
        );
    };

    const removeItem = (id: string) => {
        setCartItems((prev) => prev.filter((item) => item.id !== id));
    };

    const handleAddUpsell = (upsell: UpsellItem) => {
        setCartItems((prev) => {
            const existing = prev.find((i) => i.id === upsell.id);
            if (existing) {
                return prev.map((i) => i.id === upsell.id ? { ...i, quantity: i.quantity + 12 } : i);
            }
            return [...prev, {
                id: upsell.id,
                name: upsell.name,
                sku: upsell.sku,
                price: upsell.price,
                quantity: 12,
                image: upsell.image,
                variant: 'Added from compatibility',
            }];
        });
    };

    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    const progressPercent = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
    const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* ── Backdrop ── */}
                    <motion.div
                        key="cart-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50"
                        style={{ background: "rgba(29, 29, 31, 0.45)", backdropFilter: "blur(4px)" }}
                        aria-hidden="true"
                    />

                    {/* ── Drawer Panel ── */}
                    <motion.div
                        key="cart-drawer"
                        ref={drawerRef}
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 35 }}
                        // Note the wider form factor on md screens
                        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[420px] md:max-w-[760px] flex flex-col"
                        style={{
                            background: "rgba(250, 248, 245, 0.95)",
                            backdropFilter: "blur(28px) saturate(180%)",
                            WebkitBackdropFilter: "blur(28px) saturate(180%)",
                            borderLeft: "1px solid rgba(212, 197, 169, 0.4)",
                            boxShadow: "-24px 0 80px rgba(29, 29, 31, 0.18), -2px 0 0 rgba(255,255,255,0.6) inset",
                        }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Shopping cart"
                    >
                        {/* Liquid glass shimmer layer */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-none" aria-hidden="true">
                            <div className="absolute inset-0 liquid-shimmer" style={{ opacity: 0.4 }} />
                            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)" }} />
                        </div>

                        {/* ── Header ── */}
                        <div
                            className="relative flex items-center justify-between px-6 py-5 shrink-0"
                            style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.35)" }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center bg-white"
                                    style={{
                                        border: "1px solid rgba(197, 160, 101, 0.3)",
                                        boxShadow: "0 2px 8px rgba(197, 160, 101, 0.15)"
                                    }}
                                >
                                    <ShoppingBag className="w-4 h-4 text-muted-gold" />
                                </div>
                                <div>
                                    <h2 className="font-serif text-[17px] font-medium text-obsidian tracking-wide">Your Cart</h2>
                                    <p className="font-sans text-[11px] text-slate mt-0.5 tracking-wider uppercase">{itemCount} items</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-black/5"
                                style={{
                                    border: "1px solid rgba(29, 29, 31, 0.08)",
                                }}
                                aria-label="Close cart"
                            >
                                <X className="w-4 h-4 text-obsidian/70" />
                            </button>
                        </div>

                        {/* ── Progress Bar ── */}
                        {cartItems.length > 0 && (
                            <div className="relative px-6 py-3 shrink-0 bg-white/40 border-b border-champagne/30">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-sans text-[12px] text-obsidian font-medium">
                                        {amountToFreeShipping === 0
                                            ? "🎉 You've unlocked Free Shipping!"
                                            : `You're $${amountToFreeShipping.toFixed(2)} away from Free Shipping`}
                                    </p>
                                </div>
                                <div className="h-1.5 w-full bg-champagne/30 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-muted-gold"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercent}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── Main Layout (Two Columns on Desktop) ── */}
                        <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden">

                            {/* LEFT COLUMN: Cart Items */}
                            <div className="flex-1 flex flex-col h-full overflow-hidden">
                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                                    {cartItems.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center py-16">
                                            <ShoppingBag className="w-12 h-12 text-champagne mb-4" strokeWidth={1} />
                                            <p className="font-serif text-lg text-obsidian/60 mb-2">Your cart is empty</p>
                                            <p className="text-sm text-slate">Browse our catalog to find the perfect bottles for your brand.</p>
                                        </div>
                                    ) : (
                                        cartItems.map((item, i) => (
                                            <motion.div
                                                key={item.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ delay: i * 0.04 }}
                                                className="group relative flex gap-3 p-3 rounded-xl bg-white/70"
                                                style={{
                                                    border: "1px solid rgba(212, 197, 169, 0.3)",
                                                }}
                                            >
                                                {/* Product image placeholder */}
                                                <div
                                                    className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center bg-bone/80 border border-champagne/40"
                                                >
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="w-full h-full object-contain rounded-lg" />
                                                    ) : (
                                                        <ShoppingBag className="w-6 h-6 text-champagne" strokeWidth={1.5} />
                                                    )}
                                                </div>

                                                {/* Item info */}
                                                <div className="flex-1 min-w-0 pr-6">
                                                    <p className="text-[14px] font-medium text-obsidian leading-snug line-clamp-2 mb-0.5">
                                                        {item.name}
                                                    </p>
                                                    {item.variant && (
                                                        <p className="text-[12px] text-slate mb-2">{item.variant}</p>
                                                    )}
                                                    <div className="flex items-center justify-between">
                                                        {/* Qty controls */}
                                                        <div
                                                            className="flex items-center gap-1 rounded-md overflow-hidden bg-bone/50 border border-champagne/50"
                                                        >
                                                            <button
                                                                onClick={() => updateQty(item.id, -1)}
                                                                className="w-7 h-7 flex items-center justify-center text-obsidian/60 hover:text-obsidian hover:bg-white transition-colors cursor-pointer"
                                                                aria-label="Decrease quantity"
                                                            >
                                                                <Minus className="w-3 h-3" />
                                                            </button>
                                                            <span className="text-[12px] font-medium text-obsidian min-w-[20px] text-center">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                onClick={() => updateQty(item.id, 1)}
                                                                className="w-7 h-7 flex items-center justify-center text-obsidian/60 hover:text-obsidian hover:bg-white transition-colors cursor-pointer"
                                                                aria-label="Increase quantity"
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        {/* Line price */}
                                                        <span className="text-[14px] font-medium text-obsidian">
                                                            ${(item.price * item.quantity).toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Remove button */}
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full hover:bg-red-50"
                                                    aria-label="Remove item"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-slate hover:text-red-500 transition-colors" />
                                                </button>

                                                {/* Case quantity nudge */}
                                                {item.quantity % 12 !== 0 && (
                                                    <div className="absolute -bottom-2 right-3 left-22 bg-amber-50 rounded text-[10px] text-amber-800 px-2 py-0.5 border border-amber-200 shadow-sm flex items-center gap-1 w-max opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Add {12 - (item.quantity % 12)} more to fill a case
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))
                                    )}
                                </div>

                                {/* ── Footer / Checkout area ── */}
                                {cartItems.length > 0 && (
                                    <div className="shrink-0 px-6 py-5 bg-white border-t border-champagne/30">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[14px] text-slate font-sans uppercase tracking-widest text-xs">Total</span>
                                            <span className="font-serif text-2xl font-medium text-obsidian">${subtotal.toFixed(2)}</span>
                                        </div>

                                        <button
                                            className="group w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-medium text-[14px] tracking-wide transition-all duration-300 cursor-pointer relative overflow-hidden bg-obsidian text-bone hover:bg-obsidian/90"
                                            style={{
                                                boxShadow: "0 4px 20px rgba(29,29,31,0.15)",
                                            }}
                                        >
                                            <span className="absolute inset-0 liquid-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden="true" />
                                            <span className="relative">Proceed to Checkout</span>
                                            <ArrowRight className="w-4 h-4 relative transition-transform duration-300 group-hover:translate-x-0.5" />
                                        </button>

                                        <p className="text-[11px] text-slate text-center mt-3 tracking-wide">
                                            🔒 Secure checkout · Terms apply
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT COLUMN: Engineered Compatibility (Hidden on mobile, visible on md) */}
                            {cartItems.length > 0 && (
                                <div className="hidden md:flex flex-col w-[320px] shrink-0 border-l border-champagne/30 bg-[#F2EDE4]/50 h-full overflow-hidden">
                                    <div className="py-4 px-5 border-b border-champagne/30 bg-white/40 flex items-center gap-2 shrink-0">
                                        <div className="p-1.5 bg-muted-gold/10 rounded-lg text-muted-gold">
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-serif text-[15px] text-obsidian font-medium">Engineered Compatibility</h3>
                                            <p className="text-[11px] text-slate font-sans mt-0.5 leading-tight">Caps & closures guaranteed to fit the bottles in your cart.</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {Object.values(DEMO_UPSELLS).map((upsell, i) => (
                                            <motion.div
                                                key={upsell.id}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.1 + (i * 0.05) }}
                                                className="bg-white rounded-xl p-3 border border-champagne/40 shadow-sm relative group hover:border-muted-gold/50 transition-colors"
                                            >
                                                <div className="flex gap-3">
                                                    <div className="w-12 h-12 bg-bone rounded-lg border border-champagne/50 shrink-0 flex items-center justify-center">
                                                        {upsell.image ? (
                                                            <img src={upsell.image} alt={upsell.name} className="w-full h-full object-contain" />
                                                        ) : (
                                                            <ShoppingBag className="w-5 h-5 text-slate/40" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-sans text-[13px] font-medium text-obsidian leading-tight">{upsell.name}</h4>
                                                        <span className="text-[13px] text-slate mt-1 block">${upsell.price.toFixed(2)}/ea</span>
                                                    </div>
                                                </div>

                                                <div className="mt-3 bg-green-50/50 border border-green-100 rounded flex items-start gap-1.5 p-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                                                    <p className="text-[10px] text-green-800 font-medium leading-snug">{upsell.compatibility}</p>
                                                </div>

                                                <button
                                                    onClick={() => handleAddUpsell(upsell)}
                                                    className="mt-3 w-full py-2 bg-bone hover:bg-champagne/40 text-obsidian text-[12px] font-medium rounded-lg border border-champagne transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <Plus className="w-3 h-3" /> Add Case (12)
                                                </button>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
