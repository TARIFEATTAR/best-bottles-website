import React from "react";
import { cn } from "@/lib/utils";

// ─── Divider ──────────────────────────────────────────────────────────────────

export function GoldRule({ className = "" }: { className?: string }) {
    return <div className={cn("h-px bg-neutral-200", className)} />;
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="font-sans text-[11px] font-medium tracking-wide uppercase text-neutral-400 mb-1.5">
            {children}
        </p>
    );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

export function PageHeader({
    eyebrow,
    title,
    subtitle,
    children,
}: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex items-end justify-between mb-6">
            <div>
                {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
                <h1 className="font-sans text-[22px] font-semibold text-neutral-900 leading-tight">
                    {title}
                </h1>
                {subtitle && (
                    <p className="font-sans text-sm text-neutral-500 mt-1">
                        {subtitle}
                    </p>
                )}
            </div>
            {children && <div className="shrink-0">{children}</div>}
        </div>
    );
}

// ─── PortalTag ────────────────────────────────────────────────────────────────

type TagVariant = "gold" | "green" | "muted" | "blue";

const tagStyles: Record<TagVariant, string> = {
    gold: "bg-amber-50 text-amber-700 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    muted: "bg-neutral-100 text-neutral-600 border-neutral-200",
    blue: "bg-champagne/20 text-muted-gold border-champagne",
};

export function PortalTag({
    children,
    variant = "gold",
}: {
    children: React.ReactNode;
    variant?: TagVariant;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 font-sans text-[11px] font-medium px-2 py-0.5 rounded-md border whitespace-nowrap",
                tagStyles[variant]
            )}
        >
            {children}
        </span>
    );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({
    label,
    value,
    numericValue,
    sub,
    highlight = false,
    format,
}: {
    label: string;
    value?: string;
    numericValue?: number;
    sub?: string;
    highlight?: boolean;
    format?: (n: number) => string;
}) {
    const displayValue = numericValue !== undefined
        ? (format ?? ((n: number) => n.toLocaleString()))(numericValue)
        : value;

    return (
        <div
            className={cn(
                "bg-white rounded-lg border border-neutral-200 px-5 py-4",
                highlight && "border-l-2 border-l-amber-500"
            )}
        >
            <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1">
                {label}
            </p>
            <p className="font-sans text-2xl font-semibold text-neutral-900 leading-tight">
                {displayValue}
            </p>
            {sub && (
                <p className="font-sans text-xs text-neutral-500 mt-1">{sub}</p>
            )}
        </div>
    );
}

// ─── PortalCard ───────────────────────────────────────────────────────────────

export function PortalCard({
    children,
    dark = false,
    className = "",
}: {
    children: React.ReactNode;
    dark?: boolean;
    className?: string;
}) {
    if (dark) {
        return (
            <div
                className={cn(
                    "rounded-lg px-6 py-5 bg-neutral-900 text-white border border-neutral-800",
                    className
                )}
            >
                {children}
            </div>
        );
    }

    return (
        <div className={cn("rounded-lg px-6 py-5 bg-white border border-neutral-200", className)}>
            {children}
        </div>
    );
}

// ─── PortalButton ─────────────────────────────────────────────────────────────

type BtnVariant = "solid" | "outline" | "ghost";
type BtnSize = "sm" | "md";

export function PortalButton({
    children,
    variant = "solid",
    size = "md",
    onClick,
    type,
    disabled,
    className,
}: {
    children: React.ReactNode;
    variant?: BtnVariant;
    size?: BtnSize;
    onClick?: () => void;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    className?: string;
}) {
    const variantClass: Record<BtnVariant, string> = {
        solid: "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800",
        outline: "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400",
        ghost: "bg-transparent text-neutral-500 border-transparent hover:bg-neutral-100 hover:text-neutral-700",
    };

    const sizeClass: Record<BtnSize, string> = {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4 text-sm",
    };

    return (
        <button
            onClick={onClick}
            type={type ?? "button"}
            disabled={disabled}
            className={cn(
                "inline-flex items-center justify-center gap-2 font-sans font-medium rounded-md border transition-colors duration-100 whitespace-nowrap disabled:opacity-50",
                variantClass[variant],
                sizeClass[size],
                className
            )}
        >
            {children}
        </button>
    );
}
