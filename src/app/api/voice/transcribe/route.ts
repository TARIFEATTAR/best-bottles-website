import { NextRequest } from "next/server";

// ─── ElevenLabs STT proxy ─────────────────────────────────────────────────────
// Keeps ELEVENLABS_API_KEY server-side. GraceAtelier POSTs an audio blob here
// and receives a JSON transcript back: { text: string }

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export async function POST(req: NextRequest) {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
        return new Response("Voice not configured", { status: 503 });
    }

    const body = await req.formData();
    const audio = body.get("audio") as Blob | null;

    if (!audio || audio.size === 0) {
        return new Response("Missing audio", { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("file", audio, "recording.webm");
    upstream.append("model_id", "scribe_v1");

    const response = await fetch(ELEVENLABS_STT_URL, {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: upstream,
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("[grace/transcribe] ElevenLabs error:", response.status, error);
        return new Response("Transcription failed", { status: 502 });
    }

    const data = (await response.json()) as { text?: string };
    return Response.json({ text: data.text ?? "" });
}
