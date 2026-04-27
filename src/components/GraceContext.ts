"use client";

/**
 * Shared Grace context — the single source of truth for the Grace hook and types.
 *
 * This context is shared across the ElevenLabs provider and any 
 * text-only fallbacks. Components call useGrace() from here and 
 * get the active provider state.
 */

import { createContext, useContext } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GraceStatus =
    | "idle"
    | "connecting"
    | "listening"
    | "transcribing"
    | "thinking"
    | "speaking"
    | "error";

export interface ProductCard {
    graceSku: string;
    itemName: string;
    family?: string;
    capacity?: string;
    /** Present on searchCatalog results; use for numeric size checks when available */
    capacityMl?: number | null;
    color?: string;
    applicator?: string;
    neckThreadSize?: string;
    webPrice1pc?: number;
    webPrice12pc?: number;
    slug?: string;
}

export interface KitItem {
    role: "bottle" | "closure" | "applicator";
    product: ProductCard;
}

/** A bottle family aggregate (Pattern B / L). Mirrors the shape Convex returns from `getFamilyOverview` + group rollups. */
export interface FamilyCardPayload {
    family: string;
    tagline?: string;
    heroImageUrl?: string | null;
    /** All variants in the family. Each one maps to a `ProductCard`. */
    variants: Array<ProductCard & { capacityMl?: number | null; heroImageUrl?: string | null }>;
    /** Default variant graceSku — drives initial selection on the variant pill row. */
    defaultGraceSku?: string;
    threadSizes?: string[];
    /** Family-level price floor, surfaced on the card header. */
    priceFromCents?: number | null;
}

/** Compatibility tray (Pattern C). One row of fitment-verified components for a given bottle. */
export interface CompatibilityPayload {
    bottle: ProductCard;
    threadSize: string;
    components: Array<ProductCard & {
        componentType?: string;
        heroImageUrl?: string | null;
        fitmentVerified?: boolean;
    }>;
}

/** Build-a-kit (Pattern D). Three slots — bottle, closure, applicator — each swappable. */
export interface BuildKitPayload {
    bottle: ProductCard;
    closure?: ProductCard | null;
    applicator?: ProductCard | null;
    /** Per-row swap candidates the user can pick from. Indexed by role. */
    alternatives?: {
        bottle?: ProductCard[];
        closure?: ProductCard[];
        applicator?: ProductCard[];
    };
    subtotalCents?: number | null;
}

/** Anatomical bottle view (Pattern E). Pin labels overlay the hero image. */
export interface AnatomyPayload {
    product: ProductCard & { heroImageUrl?: string | null; paperDollBodyUrl?: string | null };
    pins: Array<{
        /** 0-1 ratios relative to the image box. */
        x: number;
        y: number;
        label: string;
        value?: string;
    }>;
}

/** Deep spec comparison (Pattern F). True-scale toggle handled by the same payload via `dimensions`. */
export interface ComparisonPayload {
    products: Array<ProductCard & { heroImageUrl?: string | null; paperDollBodyUrl?: string | null; heightMm?: number | null }>;
    /** Optional rendering hints — `"trueScale"` flips Pattern F into Pattern G. */
    dimensions?: Array<"trueScale" | "spec">;
}

/** Catalog discovery strip (Pattern L). 37-family overview with category chips. */
export interface CatalogStripPayload {
    families: Array<{
        family: string;
        heroImageUrl?: string | null;
        variantCount: number;
    }>;
    activeCategory?: string;
    categories: string[];
}

/** Shortlist build + share (Pattern J). */
export interface ShortlistPayload {
    shortlistId: string;
    items: Array<ProductCard & { heroImageUrl?: string | null }>;
    shareUrl?: string;
    expiresAt?: number;
}

/** Reference image match (Pattern H). Stub-friendly: matches array can be empty during processing. */
export interface ReferenceMatchPayload {
    referenceUrl: string;
    description?: string;
    matches: Array<ProductCard & { heroImageUrl?: string | null; reasoning?: string }>;
}

/** Brand mockup (Pattern I). v1 stub renders the bottle with the logo as a translucent decal. */
export interface BrandMockupPayload {
    product: ProductCard & { heroImageUrl?: string | null };
    logoUrl: string;
    /** Optional finish refinement chosen by the user. */
    capFinish?: string;
}

export type GraceAction =
    | { type: "showProducts"; products: ProductCard[] }
    | { type: "compareProducts"; products: ProductCard[] }
    | { type: "showProductPresentation"; products: ProductCard[]; headline?: string }
    | { type: "buildKit"; items: KitItem[]; totalPrice?: number }
    | { type: "proposeCartAdd"; products: Array<ProductCard & { quantity: number }>; awaitingConfirmation: boolean }
    | { type: "navigateToPage"; path: string; title: string; description?: string; autoNavigate?: boolean }
    | { type: "prefillForm"; formType: "sample" | "quote" | "contact" | "newsletter"; fields: Record<string, string> }
    /* ── v3 inline display actions (PRD patterns A–L) ─── */
    | { type: "displayProductCard"; product: ProductCard & { heroImageUrl?: string | null } }
    | { type: "displayFamilyCard"; payload: FamilyCardPayload }
    | { type: "displayCompatibility"; payload: CompatibilityPayload }
    | { type: "displayBuildKit"; payload: BuildKitPayload }
    | { type: "displayAnatomy"; payload: AnatomyPayload }
    | { type: "displayComparison"; payload: ComparisonPayload }
    | { type: "displayCatalogStrip"; payload: CatalogStripPayload }
    | { type: "displayShortlist"; payload: ShortlistPayload }
    | { type: "displayReferenceMatch"; payload: ReferenceMatchPayload }
    | { type: "displayBrandMockup"; payload: BrandMockupPayload };

/** A user-uploaded file attached to the conversation (PRD state 17 + Patterns H, I). */
export interface GraceAttachment {
    id: string;
    name: string;
    mime: string;
    size: number;
    /** Convex storage URL once uploaded. Undefined while still uploading. */
    url?: string;
    kind?: "reference" | "logo";
}

export interface GraceMessage {
    role: "user" | "grace";
    content: string;
    id: string;
    action?: GraceAction;
    /** Pinned voice notes (Pattern K). Renders with a 2px gold left border. */
    pinned?: boolean;
    attachments?: GraceAttachment[];
}

export type PanelMode = "closed" | "strip" | "open";

// ─── Page context (what the customer is currently viewing) ───────────────────

export interface PageContext {
    pageType: "home" | "catalog" | "pdp" | "cart" | "contact" | "about" | "other";
    pathname: string;
    /** Path + query (client-safe) for agent grounding */
    pageUrl?: string;
    currentProduct?: {
        name: string;
        family: string;
        capacity: string;
        color: string;
        neckThreadSize: string | null;
        graceSku: string;
        webPrice1pc?: number | null;
        webPrice12pc?: number | null;
        /** Representative applicator only; prefer applicatorTypes for the full line */
        applicator?: string;
        /** All applicator types available on this PDP product group */
        applicatorTypes?: string[];
        /** Catalog category for this line (e.g. Glass Bottle) */
        category?: string;
        variantCount?: number;
        /** Distinct cap heights / styles / colors across variants (for closure questions) */
        capsSummary?: string;
        stockStatus?: string;
        slug?: string;
    };
    currentCollection?: string;
    /** URL `category` filter when on /catalog */
    catalogCategory?: string;
    catalogSearch?: string;
    cartItems: Array<{ graceSku: string; name: string; quantity: number; unitPrice?: number | null }>;
    /** Total cart value in dollars */
    cartTotal?: number;
}

// ─── Browsing history (session-level page tracking) ─────────────────────────

export interface BrowsingHistoryEntry {
    pathname: string;
    pageType: PageContext["pageType"];
    /** Product name if on a PDP */
    productName?: string;
    /** Product family if on a PDP */
    productFamily?: string;
    /** Product capacity if on a PDP */
    productCapacity?: string;
    /** Catalog search term if on catalog page */
    searchTerm?: string;
    /** ISO timestamp */
    visitedAt: string;
}

// ─── Live form state ──────────────────────────────────────────────────────────

export type FormType = "sample" | "quote" | "contact" | "newsletter";

export interface ActiveForm {
    formType: FormType;
    /** Fields collected so far — grows one at a time as Grace fills them */
    fields: Record<string, string>;
    /** Filled field names in the order Grace collected them — drives animation */
    filledOrder: string[];
    /** Whether Grace has triggered a submit programmatically */
    submitting: boolean;
    /** True once the Convex mutation has resolved successfully */
    submitted: boolean;
    /** Convex mutation error, if any */
    error: string;
}

// ─── Full context shape ───────────────────────────────────────────────────────

/** Contextual tooltip shown beside the floating launcher when Grace
 * auto-minimizes during navigation (e.g. "I narrowed the catalog for you").
 * Auto-clears after `expiresAt`. */
export interface LauncherTooltip {
    message: string;
    expiresAt: number;
}

export interface GraceContextValue {
    panelMode: PanelMode;
    openPanel: () => void;
    closePanel: () => void;
    minimizeToStrip: () => void;
    /** Tooltip currently displayed beside the launcher disc, or null. */
    launcherTooltip: LauncherTooltip | null;
    /** Called by clientTools when Grace navigates the user; auto-minimizes the drawer
     * and parks a brief contextual hint beside the launcher for ~3 seconds. */
    minimizeWithTooltip: (message: string) => void;
    /** Append a message + optional action directly to the conversation,
     * bypassing ElevenLabs. Used by client-side flows like image-upload
     * vision analysis that don't need round-trip narration. */
    appendInlineMessage: (msg: { role: "user" | "grace"; content: string; action?: GraceAction; attachments?: GraceAttachment[] }) => void;
    isOpen: boolean;
    open: () => void;
    close: () => void;
    status: GraceStatus;
    messages: GraceMessage[];
    /** Partial agent response being streamed in real-time */
    streamingText: string;
    /** True from user send until the first assistant token arrives */
    isAwaitingReply: boolean;
    input: string;
    setInput: (v: string) => void;
    voiceEnabled: boolean;
    toggleVoice: () => void | Promise<void>;
    send: (text?: string, fromVoice?: boolean) => Promise<void>;
    startDictation: () => Promise<void>;
    stopDictation: () => void;
    stopSpeaking: () => void;
    errorMessage: string;
    conversationActive: boolean;
    startConversation: (forceTextOnly?: boolean) => void | Promise<boolean>;
    endConversation: () => void;
    confirmAction: (messageId: string) => void;
    dismissAction: (messageId: string) => void;
    onNavigate: (path: string) => void;
    pendingNavigation: string | null;
    clearPendingNavigation: () => void;
    activeForm: ActiveForm | null;
    updateFormField: (formType: FormType, fieldName: string, value: string) => void;
    submitActiveForm: () => Promise<void>;
    dismissActiveForm: () => void;
    voiceFailed: boolean;
    graceQuery: string;
    pageContext: PageContext | null;
    browsingHistory: BrowsingHistoryEntry[];
}

// ─── Shared context & hook ───────────────────────────────────────────────────

export const GraceContext = createContext<GraceContextValue | null>(null);

const NOOP = () => {};
const NOOP_ASYNC = async () => {};

const GRACE_NOOP: GraceContextValue = {
    panelMode: "closed",
    openPanel: NOOP,
    closePanel: NOOP,
    minimizeToStrip: NOOP,
    launcherTooltip: null,
    minimizeWithTooltip: NOOP,
    appendInlineMessage: NOOP,
    isOpen: false,
    open: NOOP,
    close: NOOP,
    status: "idle",
    messages: [],
    streamingText: "",
    isAwaitingReply: false,
    input: "",
    setInput: NOOP,
    voiceEnabled: false,
    toggleVoice: NOOP,
    send: NOOP_ASYNC,
    startDictation: NOOP_ASYNC,
    stopDictation: NOOP,
    stopSpeaking: NOOP,
    errorMessage: "",
    conversationActive: false,
    startConversation: NOOP,
    endConversation: NOOP,
    confirmAction: NOOP,
    dismissAction: NOOP,
    onNavigate: NOOP,
    pendingNavigation: null,
    clearPendingNavigation: NOOP,
    activeForm: null,
    updateFormField: NOOP,
    submitActiveForm: NOOP_ASYNC,
    dismissActiveForm: NOOP,
    voiceFailed: false,
    graceQuery: "",
    pageContext: null,
    browsingHistory: [],
};

export function useGrace(): GraceContextValue {
    const ctx = useContext(GraceContext);
    return ctx ?? GRACE_NOOP;
}
