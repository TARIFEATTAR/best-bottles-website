"use client";

/**
 * GraceProviderSwitch — always uses ElevenLabs Conversational AI.
 * 
 * If ElevenLabs is unavailable, Grace falls back gracefully to 
 * text-only mode (Convex / Claude).
 * To force text-only mode, set NEXT_PUBLIC_GRACE_VOICE_PROVIDER=text.
 */

import type { ReactNode } from "react";
import GraceElevenLabsProvider from "./GraceElevenLabsProvider";

interface Props {
    children: ReactNode;
}

export default function GraceProviderSwitch({ children }: Props) {
    // Voice provider is ElevenLabs. The only opt-out is setting
    // NEXT_PUBLIC_GRACE_VOICE_PROVIDER=text to get text-only mode.
    const isTextOnly = process.env.NEXT_PUBLIC_GRACE_VOICE_PROVIDER === "text";

    if (isTextOnly) {
        // Text-only: ElevenLabs provider still handles text chat via Convex,
        // but voice is disabled at the provider level.
        return <GraceElevenLabsProvider forceTextOnly>{children}</GraceElevenLabsProvider>;
    }

    return <GraceElevenLabsProvider>{children}</GraceElevenLabsProvider>;
}
