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

export type GraceAction =
    | { type: "showProducts"; products: ProductCard[] }
    | { type: "compareProducts"; products: ProductCard[] }
    | { type: "showProductPresentation"; products: ProductCard[]; headline?: string }
    | { type: "buildKit"; items: KitItem[]; totalPrice?: number }
    | { type: "proposeCartAdd"; products: Array<ProductCard & { quantity: number }>; awaitingConfirmation: boolean }
    | { type: "navigateToPage"; path: string; title: string; description?: string; autoNavigate?: boolean }
    | { type: "prefillForm"; formType: "sample" | "quote" | "contact" | "newsletter"; fields: Record<string, string> };

export interface GraceMessage {
    role: "user" | "grace";
    content: string;
    id: string;
    action?: GraceAction;
}

export type PanelMode = "closed" | "strip" | "open";

// ─── Page context (what the customer is currently viewing) ───────────────────

export interface PageContext {
    pageType: "home" | "catalog" | "pdp" | "cart" | "contact" | "about" | "other";
    pathname: string;
    currentProduct?: {
        name: string;
        family: string;
        capacity: string;
        color: string;
        neckThreadSize: string | null;
        graceSku: string;
        webPrice1pc?: number | null;
        webPrice12pc?: number | null;
        applicator?: string;
        stockStatus?: string;
        slug?: string;
    };
    currentCollection?: string;
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

export interface GraceContextValue {
    panelMode: PanelMode;
    openPanel: () => void;
    closePanel: () => void;
    minimizeToStrip: () => void;
    isOpen: boolean;
    open: () => void;
    close: () => void;
    status: GraceStatus;
    messages: GraceMessage[];
    /** Partial agent response being streamed in real-time */
    streamingText: string;
    input: string;
    setInput: (v: string) => void;
    voiceEnabled: boolean;
    toggleVoice: () => void;
    send: (text?: string, fromVoice?: boolean) => Promise<void>;
    startDictation: () => Promise<void>;
    stopDictation: () => void;
    stopSpeaking: () => void;
    errorMessage: string;
    conversationActive: boolean;
    startConversation: () => void;
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
    isOpen: false,
    open: NOOP,
    close: NOOP,
    status: "idle",
    messages: [],
    streamingText: "",
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
