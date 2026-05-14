"use client";

/**
 * ProductImageGallery
 *
 * Generic gallery component for the PDP image panel. Designed to coexist
 * with the eventual paper-doll configurator: the consuming code chooses
 * whether to render this for the main slot, the thumbnail strip alone, or
 * both — see `mode` prop.
 *
 * Visual layout
 *   ┌─────────────────────────┐
 *   │                         │   ← main image, aspect-[10/11] by default
 *   │       hero image        │     (matches Madison render output)
 *   │   click → lightbox      │
 *   └─────────────────────────┘
 *   [ thumb 1 ] [ thumb 2 ]       ← only renders when images.length > 1
 *
 * Image schema
 *   images: Array<{ url, label, alt? }>
 *   - First entry is the initial active view.
 *   - `label` shows on the active thumbnail's footer chip (e.g. "Cap on").
 *   - Caller controls order; the component does not sort.
 *
 * Lightbox
 *   - Click main image → opens lightbox (cursor-zoom-in).
 *   - Click backdrop / close button / Esc → dismisses.
 *   - ←/→ keys navigate when more than one image is in the gallery.
 *
 * Future: when paper-doll arrives for the family, the parent renders
 * <PaperDollImage> in the main slot and passes `mode="thumbs-only"` to
 * keep the static gallery thumbs below as editorial alternates. No
 * changes to this component are needed — only how it's invoked.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
/* eslint-disable @next/next/no-img-element */

export type GalleryImage = {
    url: string;
    /** Short label shown on the active thumbnail (e.g. "Cap on", "Cap off"). */
    label: string;
    /** Accessibility alt text. Defaults to label if omitted. */
    alt?: string;
};

export type GalleryMode =
    /** Default — render main image area, thumb strip, and lightbox. */
    | "full"
    /** Render only the thumb strip — used when paper-doll fills the main slot. */
    | "thumbs-only";

interface ProductImageGalleryProps {
    images: GalleryImage[];
    /** Fallback alt text used when an image has no `alt`. */
    primaryAlt: string;
    /** Optional badge overlaid top-left on the main image (e.g. variant count). */
    badge?: React.ReactNode;
    /** Optional watermark overlaid bottom-right on the main image (e.g. SKU). */
    watermark?: React.ReactNode;
    /** Container aspect ratio. Default 10/11 matches Madison render output. */
    aspectRatio?: string;
    /** Padding applied to the main image inside the container. */
    mainPadding?: string;
    /** Layout mode — see GalleryMode. */
    mode?: GalleryMode;
    /** Optional callback when the active thumbnail changes. */
    onActiveChange?: (index: number, image: GalleryImage) => void;
}

export default function ProductImageGallery({
    images,
    primaryAlt,
    badge,
    watermark,
    aspectRatio = "10/11",
    mainPadding = "p-6 sm:p-12",
    mode = "full",
    onActiveChange,
}: ProductImageGalleryProps) {
    const [activeUrl, setActiveUrl] = useState<string | null>(images[0]?.url ?? null);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const resolvedActiveIndex = images.findIndex((image) => image.url === activeUrl);
    const activeIndex = resolvedActiveIndex >= 0 ? resolvedActiveIndex : 0;
    const activeImage = images[activeIndex];

    // Notify parent when active image changes — lets the PDP track which
    // view the customer is looking at (analytics, e.g.).
    useEffect(() => {
        if (activeImage && onActiveChange) {
            onActiveChange(activeIndex, activeImage);
        }
    }, [activeIndex, activeImage, onActiveChange]);

    // Keyboard handling — only active when lightbox is open.
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!lightboxOpen) return;
            if (e.key === "Escape") {
                setLightboxOpen(false);
                return;
            }
            if (images.length <= 1) return;
            if (e.key === "ArrowLeft") {
                const previousIndex = Math.max(0, activeIndex - 1);
                setActiveUrl(images[previousIndex]?.url ?? null);
            } else if (e.key === "ArrowRight") {
                const nextIndex = Math.min(images.length - 1, activeIndex + 1);
                setActiveUrl(images[nextIndex]?.url ?? null);
            }
        },
        [activeIndex, lightboxOpen, images],
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    if (!activeImage) return null;

    const showMain = mode === "full";
    const showThumbs = images.length > 1;

    return (
        <>
            {/* ── Main image ───────────────────────────────────────────── */}
            {showMain && (
                <motion.div
                    key={activeImage.url}
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{ aspectRatio }}
                    className="bg-travertine rounded-none sm:rounded-sm border-0 sm:border border-champagne/50 flex items-center justify-center relative overflow-hidden cursor-zoom-in"
                    onClick={() => setLightboxOpen(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setLightboxOpen(true);
                        }
                    }}
                    aria-label={`Open ${activeImage.label} image at full size`}
                >
                    <img
                        src={activeImage.url}
                        alt={activeImage.alt ?? primaryAlt}
                        loading="eager"
                        fetchPriority="high"
                        className={`w-full h-full object-contain ${mainPadding}`}
                    />
                    {badge && (
                        <div className="absolute top-4 left-4 pointer-events-none">
                            {badge}
                        </div>
                    )}
                    {watermark && (
                        <div className="absolute bottom-4 right-4 pointer-events-none">
                            {watermark}
                        </div>
                    )}
                </motion.div>
            )}

            {/* ── Thumbnail strip ──────────────────────────────────────── */}
            {showThumbs && (
                <div
                    className={`${showMain ? "mt-3 sm:mt-4" : ""} flex gap-2 sm:gap-3`}
                    role="tablist"
                    aria-label="Product image views"
                >
                    {images.map((img, i) => {
                        const isActive = i === activeIndex;
                        return (
                            <button
                                key={img.url}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-label={`Show ${img.label} view`}
                                onClick={() => setActiveUrl(img.url)}
                                className={`
                                    relative aspect-[10/11] w-16 sm:w-20 shrink-0
                                    bg-travertine rounded-sm overflow-hidden
                                    border transition-all duration-200
                                    ${
                                        isActive
                                            ? "border-obsidian ring-2 ring-muted-gold/40"
                                            : "border-champagne/40 hover:border-champagne"
                                    }
                                `}
                            >
                                <img
                                    src={img.url}
                                    alt={img.label}
                                    className="w-full h-full object-contain p-1.5"
                                />
                                {isActive && (
                                    <span className="absolute inset-x-0 bottom-0 bg-obsidian/85 text-white text-[8px] uppercase tracking-wider py-0.5 text-center font-medium select-none">
                                        {img.label}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Lightbox ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {lightboxOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] bg-obsidian backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
                        onClick={() => setLightboxOpen(false)}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Product image lightbox"
                    >
                        <motion.div
                            initial={{ scale: 0.96 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.96 }}
                            transition={{ duration: 0.2 }}
                            className="relative max-w-5xl w-full flex flex-col items-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={activeImage.url}
                                alt={activeImage.alt ?? primaryAlt}
                                className="max-w-full max-h-[80vh] object-contain"
                            />

                            {/* Footer controls — prev / label / next */}
                            <div className="mt-4 flex items-center gap-4 min-h-[28px]">
                                {images.length > 1 ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const previousIndex = Math.max(0, activeIndex - 1);
                                                setActiveUrl(images[previousIndex]?.url ?? null);
                                            }}
                                            disabled={activeIndex === 0}
                                            className="text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs uppercase tracking-widest font-medium px-3 py-1"
                                        >
                                            ← Prev
                                        </button>
                                        <span className="text-white/60 text-[10px] uppercase tracking-widest font-medium select-none">
                                            {activeImage.label} · {activeIndex + 1}/{images.length}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextIndex = Math.min(images.length - 1, activeIndex + 1);
                                                setActiveUrl(images[nextIndex]?.url ?? null);
                                            }}
                                            disabled={activeIndex === images.length - 1}
                                            className="text-white/80 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs uppercase tracking-widest font-medium px-3 py-1"
                                        >
                                            Next →
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-white/60 text-[10px] uppercase tracking-widest font-medium select-none">
                                        {activeImage.label}
                                    </span>
                                )}
                            </div>

                            {/* Close button */}
                            <button
                                type="button"
                                onClick={() => setLightboxOpen(false)}
                                className="absolute top-2 right-2 sm:-top-12 sm:right-0 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white text-2xl leading-none rounded-full hover:bg-white/10 transition-colors"
                                aria-label="Close lightbox"
                            >
                                ×
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
