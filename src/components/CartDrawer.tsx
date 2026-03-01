"use client";

import { useEffect, useRef } from "react";
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "./CartProvider";

const FREE_SHIPPING_THRESHOLD = 199;

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
    const { items, itemCount, removeItem, updateQuantity, checkout, isCheckingOut, checkoutError } = useCart();
    const drawerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0);
    const progressPercent = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
    const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
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

                    <motion.div
                        key="cart-drawer"
                        ref={drawerRef}
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 35 }}
                        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[420px] flex flex-col"
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
                        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                            <div className="absolute inset-0 liquid-shimmer" style={{ opacity: 0.4 }} />
                            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)" }} />
                        </div>

                        {/* Header */}
                        <div
                            className="relative flex items-center justify-between px-6 py-5 shrink-0"
                            style={{ borderBottom: "1px solid rgba(212, 197, 169, 0.35)" }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center bg-white"
                                    style={{
                                        border: "1px solid rgba(197, 160, 101, 0.3)",
                                        boxShadow: "0 2px 8px rgba(197, 160, 101, 0.15)",
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
                                style={{ border: "1px solid rgba(29, 29, 31, 0.08)" }}
                                aria-label="Close cart"
                            >
                                <X className="w-4 h-4 text-obsidian/70" />
                            </button>
                        </div>

                        {/* Progress Bar */}
                        {items.length > 0 && (
                            <div className="relative px-6 py-3 shrink-0 bg-white/40 border-b border-champagne/30">
                                <p className="font-sans text-[12px] text-obsidian font-medium mb-2">
                                    {amountToFreeShipping === 0
                                        ? "You've unlocked Free Shipping!"
                                        : `$${amountToFreeShipping.toFixed(2)} away from Free Shipping`}
                                </p>
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

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                                    <ShoppingBag className="w-12 h-12 text-champagne mb-4" strokeWidth={1} />
                                    <p className="font-serif text-lg text-obsidian/60 mb-2">Your cart is empty</p>
                                    <p className="text-sm text-slate">Browse our catalog or ask Grace, your AI Bottling Specialist, to find the right bottle and fitment.</p>
                                </div>
                            ) : (
                                items.map((item, i) => (
                                    <motion.div
                                        key={item.graceSku}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ delay: i * 0.04 }}
                                        className="group relative flex gap-3 p-3 rounded-xl bg-white/70"
                                        style={{ border: "1px solid rgba(212, 197, 169, 0.3)" }}
                                    >
                                        <div className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center bg-bone/80 border border-champagne/40">
                                            <ShoppingBag className="w-6 h-6 text-champagne" strokeWidth={1.5} />
                                        </div>

                                        <div className="flex-1 min-w-0 pr-6">
                                            <p className="text-[14px] font-medium text-obsidian leading-snug line-clamp-2 mb-0.5">
                                                {item.itemName}
                                            </p>
                                            {(item.family || item.capacity) && (
                                                <p className="text-[12px] text-slate mb-2">
                                                    {[item.family, item.capacity, item.color].filter(Boolean).join(" · ")}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1 rounded-md overflow-hidden bg-bone/50 border border-champagne/50">
                                                    <button
                                                        onClick={() => updateQuantity(item.graceSku, item.quantity - 1)}
                                                        className="w-7 h-7 flex items-center justify-center text-obsidian/60 hover:text-obsidian hover:bg-white transition-colors cursor-pointer"
                                                        aria-label="Decrease quantity"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="text-[12px] font-medium text-obsidian min-w-[20px] text-center">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => updateQuantity(item.graceSku, item.quantity + 1)}
                                                        className="w-7 h-7 flex items-center justify-center text-obsidian/60 hover:text-obsidian hover:bg-white transition-colors cursor-pointer"
                                                        aria-label="Increase quantity"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                {item.unitPrice != null && (
                                                    <span className="text-[14px] font-medium text-obsidian">
                                                        ${(item.unitPrice * item.quantity).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => removeItem(item.graceSku)}
                                            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full hover:bg-red-50"
                                            aria-label="Remove item"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-slate hover:text-red-500 transition-colors" />
                                        </button>

                                        {item.quantity % 12 !== 0 && (
                                            <div className="absolute -bottom-2 right-3 bg-amber-50 rounded text-[10px] text-amber-800 px-2 py-0.5 border border-amber-200 shadow-sm flex items-center gap-1 w-max opacity-0 group-hover:opacity-100 transition-opacity">
                                                <AlertCircle className="w-3 h-3" />
                                                Add {12 - (item.quantity % 12)} more to fill a case
                                            </div>
                                        )}
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        {items.length > 0 && (
                            <div className="shrink-0 px-6 py-5 bg-white border-t border-champagne/30">
                                {checkoutError && (
                                    <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                                        <div className="flex items-start gap-2">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p>{checkoutError}</p>
                                                <button
                                                    onClick={onClose}
                                                    className="mt-1.5 text-[11px] font-semibold text-obsidian underline underline-offset-2 hover:text-muted-gold transition-colors"
                                                >
                                                    Continue browsing
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[14px] text-slate font-sans uppercase tracking-widest text-xs">Total</span>
                                    <span className="font-serif text-2xl font-medium text-obsidian">${subtotal.toFixed(2)}</span>
                                </div>

                                <button
                                    onClick={checkout}
                                    disabled={isCheckingOut}
                                    className="group w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-medium text-[14px] tracking-wide transition-all duration-300 cursor-pointer relative overflow-hidden bg-obsidian text-bone hover:bg-obsidian/90 disabled:opacity-50"
                                    style={{ boxShadow: "0 4px 20px rgba(29,29,31,0.15)" }}
                                >
                                    <span className="absolute inset-0 liquid-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden="true" />
                                    <span className="relative">{isCheckingOut ? "Preparing Checkout…" : "Proceed to Checkout"}</span>
                                    <ArrowRight className="w-4 h-4 relative transition-transform duration-300 group-hover:translate-x-0.5" />
                                </button>

                                <p className="text-[11px] text-slate text-center mt-3 tracking-wide">
                                    Secure checkout · Terms apply
                                </p>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
