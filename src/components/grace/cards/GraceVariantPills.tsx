"use client";

/**
 * Variant pill row for Pattern B (family card) and Pattern D (kit composer).
 *
 * Each pill is a 2px-radius rectangle (per PRD — no chat-app rounding).
 * Selected variant gets a 2px Antiqued Gold border + soft Bone tint background.
 * Unselected pills are ghost (1px stone border, transparent background).
 *
 * Reuses the same visual language as the PDP's `capColorOptions` row (see
 * `src/app/products/[slug]/page.tsx:471`) so the inline drawer feels coherent
 * with the catalog UI.
 */
export interface VariantPillOption<T = string> {
    value: T;
    label: string;
    /** Optional sub-label rendered as caption below `label` (e.g. price). */
    sub?: string;
    disabled?: boolean;
}

export interface GraceVariantPillsProps<T extends string = string> {
    options: VariantPillOption<T>[];
    value: T | null;
    onChange: (next: T) => void;
    size?: "sm" | "md";
    /** Optional eyebrow rendered above the row (e.g. "Capacity"). */
    label?: string;
}

export default function GraceVariantPills<T extends string = string>({
    options,
    value,
    onChange,
    size = "md",
    label,
}: GraceVariantPillsProps<T>) {
    return (
        <div>
            {label && (
                <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate mb-1.5">
                    {label}
                </div>
            )}
            <div className="flex flex-wrap gap-1.5">
                {options.map((opt) => {
                    const selected = value === opt.value;
                    const padding = size === "sm" ? "5px 9px" : "7px 12px";
                    const fontSize = size === "sm" ? 11 : 12;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            disabled={opt.disabled}
                            onClick={() => !opt.disabled && onChange(opt.value)}
                            aria-pressed={selected}
                            className="rounded-[2px] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                                fontSize,
                                fontWeight: selected ? 600 : 500,
                                letterSpacing: "0.04em",
                                padding,
                                background: selected ? "rgba(245, 243, 239, 0.7)" : "transparent",
                                border: selected
                                    ? "2px solid var(--color-muted-gold)"
                                    : "1px solid rgba(99, 117, 136, 0.28)",
                                color: selected ? "var(--color-gold-dim)" : "var(--color-obsidian)",
                                lineHeight: 1.1,
                            }}
                        >
                            {opt.label}
                            {opt.sub && (
                                <span
                                    className="block mt-0.5"
                                    style={{
                                        fontSize: fontSize - 2,
                                        fontWeight: 500,
                                        opacity: 0.7,
                                        letterSpacing: "0.02em",
                                    }}
                                >
                                    {opt.sub}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
