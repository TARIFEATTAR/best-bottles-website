"use client";

/**
 * Reusable voice-mode glyph — 4 vertical bars with a tall center, mirroring
 * Claude's voice toggle. This is the "tap to talk with Grace" affordance,
 * NOT a dictation icon. We deliberately use bars (not a microphone) to
 * signal full voice conversation, not voice-to-text capture.
 *
 * `active` makes the bars taller + animated, used during a live voice session.
 */
export interface VoiceWaveGlyphProps {
    size?: number;
    active?: boolean;
    color?: string;
}

export default function VoiceWaveGlyph({
    size = 16,
    active = false,
    color = "currentColor",
}: VoiceWaveGlyphProps) {
    // Heights as fractions of size — tall center, tapering sides
    const heights = active
        ? [0.45, 0.85, 1.0, 0.85, 0.45]
        : [0.30, 0.55, 0.70, 0.55, 0.30];
    const barWidth = Math.max(1.5, size / 8);
    const gap = Math.max(1, size / 12);

    return (
        <span
            className="inline-flex items-center justify-center"
            style={{ width: size, height: size, gap }}
            aria-hidden
        >
            {heights.map((h, i) => (
                <span
                    key={i}
                    style={{
                        width: barWidth,
                        height: Math.round(h * size),
                        background: color,
                        borderRadius: barWidth / 2,
                        animation: active ? `grace-wave-bar 1.1s ease-in-out ${i * 0.08}s infinite` : undefined,
                        transformOrigin: "center",
                        display: "block",
                    }}
                />
            ))}
        </span>
    );
}
