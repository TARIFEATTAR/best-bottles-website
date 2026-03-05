import { NextResponse } from "next/server";

/**
 * Generates a signed WebSocket URL for ElevenLabs Conversational AI.
 * Uses WebSocket (not WebRTC/LiveKit) — avoids LiveKit connection failures.
 */
export async function GET() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
        return NextResponse.json(
            { error: "ElevenLabs API key or Agent ID not configured" },
            { status: 503 }
        );
    }

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
            { headers: { "xi-api-key": apiKey } }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error("[elevenlabs/signed-url] ElevenLabs error:", response.status, errText);
            let detail = "Failed to get signed URL from ElevenLabs";
            try {
                const errJson = JSON.parse(errText) as {
                    detail?: string | { status?: string; message?: string };
                };
                const d = errJson.detail;
                if (typeof d === "string") detail = d;
                else if (d && typeof d === "object" && d.message) detail = d.message;
                else if (d && typeof d === "object" && d.status)
                    detail = `${d.status}: ${d.message ?? ""}`.trim();
            } catch {
                if (response.status === 401) detail = "Invalid API key. Check ELEVENLABS_API_KEY.";
                else if (response.status === 404)
                    detail = "Agent not found. Check ELEVENLABS_AGENT_ID.";
            }
            return NextResponse.json({ error: detail }, { status: 502 });
        }

        const data = (await response.json()) as { signed_url?: string };
        if (!data.signed_url) {
            return NextResponse.json(
                { error: "ElevenLabs did not return a signed URL" },
                { status: 502 }
            );
        }

        return NextResponse.json({ signedUrl: data.signed_url });
    } catch (err) {
        console.error("[elevenlabs/signed-url] Error:", err);
        return NextResponse.json(
            { error: "Internal error generating signed URL" },
            { status: 500 }
        );
    }
}
