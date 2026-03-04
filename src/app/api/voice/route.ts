import { NextRequest } from "next/server";

// ─── TTS: ElevenLabs (preferred) or OpenAI fallback ─────────────────────────────



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

    const ttsText = prepareTtsText(text);
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    const elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID;

    // Require ElevenLabs TTS
    if (!elevenLabsKey || !elevenLabsVoiceId) {
        return new Response("Voice not configured (missing ElevenLabs keys)", { status: 503 });
    }

    const upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}?output_format=mp3_44100_128`,
        {
            method: "POST",
            headers: {
                "xi-api-key": elevenLabsKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text: ttsText,
                model_id: "eleven_turbo_v2_5",
            }),
        }
    );

    if (!upstream.ok) {
        const errorText = await upstream.text();
        console.error("[grace/voice] ElevenLabs TTS error:", upstream.status, errorText);
        return new Response("Voice synthesis failed", { status: 502 });
    }

    return new Response(upstream.body, {
        headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
        },
    });
}
