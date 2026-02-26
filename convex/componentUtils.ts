type RawComponent = Record<string, unknown>;

export interface NormalizedComponent {
    graceSku: string;
    itemName: string;
    imageUrl: string | null;
    webPrice1pc: number | null;
    webPrice12pc: number | null;
    capColor: string | null;
    stockStatus: string | null;
}

function asRecord(value: unknown): RawComponent | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as RawComponent)
        : null;
}

function toStringOrEmpty(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function toNumberOrNull(value: unknown): number | null {
    return typeof value === "number" ? value : null;
}

export function inferComponentType(graceSku: string, itemName?: string): string {
    const sku = graceSku.toUpperCase();
    const name = (itemName ?? "").toLowerCase();
    if (sku.includes("DRP")) return "Dropper";
    if (sku.includes("ROC")) return "Roll-On Cap";
    if (sku.includes("AST") || sku.includes("ASP") || sku.includes("SPR") || sku.includes("ATM")) return "Sprayer";
    if (sku.includes("LPM")) return "Lotion Pump";
    if (sku.includes("RDC")) return "Reducer";
    if (sku.includes("ROL") || sku.includes("MRL") || sku.includes("RON") || sku.includes("MRO") || sku.includes("RBL")) return "Roller";
    if (name.includes("sprayer") || name.includes("bulb") || name.includes("atomizer")) return "Sprayer";
    if (name.includes("lotion") && name.includes("pump")) return "Lotion Pump";
    if (name.includes("dropper")) return "Dropper";
    if (name.includes("reducer")) return "Reducer";
    if (name.includes("cap") || name.includes("closure")) return "Cap";
    return "Accessory";
}

export function normalizeComponent(value: unknown): NormalizedComponent {
    const item = asRecord(value) ?? {};
    const graceSku = toStringOrEmpty(item.graceSku) || toStringOrEmpty(item.grace_sku);
    const itemName = toStringOrEmpty(item.itemName) || toStringOrEmpty(item.item_name);
    return {
        graceSku,
        itemName,
        imageUrl: toStringOrEmpty(item.imageUrl) || toStringOrEmpty(item.image_url) || null,
        webPrice1pc: toNumberOrNull(item.webPrice1pc) ?? toNumberOrNull(item.web_price_1pc) ?? toNumberOrNull(item.price_1),
        webPrice12pc: toNumberOrNull(item.webPrice12pc) ?? toNumberOrNull(item.web_price_12pc) ?? toNumberOrNull(item.price_12),
        capColor: toStringOrEmpty(item.capColor) || toStringOrEmpty(item.cap_color) || null,
        stockStatus: toStringOrEmpty(item.stockStatus) || toStringOrEmpty(item.stock_status) || null,
    };
}

export function normalizeComponentsByType(
    components: unknown,
): Record<string, NormalizedComponent[]> {
    const grouped: Record<string, NormalizedComponent[]> = {};

    if (Array.isArray(components)) {
        for (const raw of components) {
            const normalized = normalizeComponent(raw);
            const type = inferComponentType(normalized.graceSku, normalized.itemName);
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(normalized);
        }
        return grouped;
    }

    const map = asRecord(components);
    if (!map) return grouped;

    for (const [type, items] of Object.entries(map)) {
        if (!Array.isArray(items)) continue;
        grouped[type] = items.map((item) => normalizeComponent(item));
    }

    return grouped;
}
