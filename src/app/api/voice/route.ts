import { NextRequest } from "next/server";

// ─── ElevenLabs TTS proxy ─────────────────────────────────────────────────────

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

/**
 * Normalizes text for clearer TTS output — expands prices, dimensions,
 * and abbreviations that voice engines tend to garble.
 */
function prepareTtsText(raw: string): string {
    let t = raw;

    // "$1.50" → "1 dollar 50 cents", "$12.00" → "12 dollars"
    t = t.replace(/\$(\d+)\.(\d{2})/g, (_m, dollars, cents) => {
        const d = parseInt(dollars, 10);
        const c = parseInt(cents, 10);
        const dLabel = d === 1 ? "dollar" : "dollars";
        return c === 0 ? `${d} ${dLabel}` : `${d} ${dLabel} ${c} cents`;
    });

    // Bare "$5" → "5 dollars"
    t = t.replace(/\$(\d+)(?!\.\d)/g, (_m, dollars) => {
        const d = parseInt(dollars, 10);
        return d === 1 ? "1 dollar" : `${d} dollars`;
    });

    // Thread sizes: "18-415" → "18 dash 415"
    t = t.replace(/(\d{2})-(\d{3})/g, "$1 dash $2");

    // "ml" / "oz" unit abbreviations
    t = t.replace(/(\d+)\s*ml\b/gi, "$1 milliliter");
    t = t.replace(/(\d+)\s*oz\b/gi, "$1 ounce");

    // Trim excess whitespace
    t = t.replace(/\s{2,}/g, " ").trim();

    return t;
}

export async function POST(req: NextRequest) {
    const { text } = (await req.json()) as { text?: string };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
        return new Response("Missing text", { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
        return new Response("Voice not configured", { status: 503 });
    }

    const ttsText = prepareTtsText(text);

    const upstream = await fetch(`${ELEVENLABS_TTS_URL}/${voiceId}`, {
        method: "POST",
        headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
        },
        body: JSON.stringify({
            text: ttsText,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
                stability: 0.68,
                similarity_boost: 0.78,
                style: 0.20,
                use_speaker_boost: true,
            },
        }),
    });

    if (!upstream.ok) {
        const errorText = await upstream.text();
        console.error("[grace/voice] ElevenLabs error:", upstream.status, errorText);
        return new Response("Voice synthesis failed", { status: 502 });
    }

    return new Response(upstream.body, {
        headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
        },
    });
}
