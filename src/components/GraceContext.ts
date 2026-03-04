"use client";

/**
 * Shared Grace context — the single source of truth for the Grace hook and types.
 *
 * Both GraceProvider (OpenAI) and GraceElevenLabsProvider (ElevenLabs) import
 * this context and wrap their children with it. Components call useGrace()
 * from here (via the useGrace barrel) and get whichever provider is active.
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
    // ── Live conversational form ──────────────────────────────────────────────
    /** The active form being filled by Grace, or null when no form is open */
    activeForm: ActiveForm | null;
    /** Update (or create) a single field — called by Grace's updateFormField tool */
    updateFormField: (formType: FormType, fieldName: string, value: string) => void;
    /** Grace-initiated submit — fires the Convex mutation programmatically */
    submitActiveForm: () => Promise<void>;
    /** Customer (or Grace) dismisses / resets the active form */
    dismissActiveForm: () => void;
}

// ─── Shared context & hook ───────────────────────────────────────────────────

export const GraceContext = createContext<GraceContextValue | null>(null);

export function useGrace() {
    const ctx = useContext(GraceContext);
    if (!ctx) throw new Error("useGrace must be used within a Grace provider (GraceProviderSwitch)");
    return ctx;
}
