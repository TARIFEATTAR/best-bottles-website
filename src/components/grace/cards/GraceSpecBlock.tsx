"use client";

import type { ReactNode } from "react";

/**
 * Compact key/value spec block used by Patterns A, B, F.
 * Renders a 2-up or 3-up grid depending on density. All values are short strings;
 * use `kv()` helper to build the rows from a product object.
 */
export interface SpecRow {
    key: string;
    value: string;
}

export interface GraceSpecBlockProps {
    rows: SpecRow[];
    columns?: 2 | 3 | 4;
    /** Optional content rendered below the spec grid (e.g. tier badge). */
    footer?: ReactNode;
}

export default function GraceSpecBlock({ rows, columns = 2, footer }: GraceSpecBlockProps) {
    const gridCols = { 2: "repeat(2, 1fr)", 3: "repeat(3, 1fr)", 4: "repeat(4, 1fr)" }[columns];

    return (
        <div
            className="rounded-[2px] px-3 py-2.5"
            style={{
                background: "rgba(238, 230, 212, 0.4)",
                border: "1px solid rgba(212, 197, 169, 0.4)",
            }}
        >
            <div className="grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: gridCols }}>
                {rows.map((r) => (
                    <div key={r.key} className="min-w-0">
                        <div className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-slate">
                            {r.key}
                        </div>
                        <div className="mt-0.5 text-[12px] font-medium text-obsidian leading-tight truncate">
                            {r.value}
                        </div>
                    </div>
                ))}
            </div>
            {footer && <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(212, 197, 169, 0.4)" }}>{footer}</div>}
        </div>
    );
}
