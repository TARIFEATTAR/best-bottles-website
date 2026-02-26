import { NextRequest } from "next/server";

// ─── OpenAI TTS proxy ─────────────────────────────────────────────────────────

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

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

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return new Response("Voice not configured", { status: 503 });
    }

    const ttsText = prepareTtsText(text);

    const upstream = await fetch(OPENAI_TTS_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "tts-1",
            input: ttsText,
            voice: "sage",
            response_format: "mp3",
        }),
    });

    if (!upstream.ok) {
        const errorText = await upstream.text();
        console.error("[grace/voice] OpenAI TTS error:", upstream.status, errorText);
        return new Response("Voice synthesis failed", { status: 502 });
    }

    return new Response(upstream.body, {
        headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
        },
    });
}
