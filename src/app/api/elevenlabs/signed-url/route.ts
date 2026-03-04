import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

/**
 * Generates a WebRTC conversation token for ElevenLabs Conversational AI.
 *
 * WebRTC (the recommended connection type) uses a short-lived conversation
 * token rather than a signed WebSocket URL. This token is passed directly
 * to startSession({ conversationToken, connectionType: "webrtc" }).
 */

let _convex: ConvexHttpClient | null = null;

function getConvex(): ConvexHttpClient {
    if (!_convex) {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
        _convex = new ConvexHttpClient(url);
    }
    return _convex;
}

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
        // Fetch conversation token from the WebRTC token endpoint
        const [elResponse] = await Promise.all([
            fetch(
                `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
                { headers: { "xi-api-key": apiKey } }
            ),
        ]);

        if (!elResponse.ok) {
            const errText = await elResponse.text();
            console.error("[elevenlabs/signed-url] ElevenLabs error:", elResponse.status, errText);
            let detail = "Failed to get conversation token from ElevenLabs";
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
                if (elResponse.status === 401) detail = "Invalid API key. Check ELEVENLABS_API_KEY.";
                else if (elResponse.status === 404)
                    detail =
                        "Agent not found. Check ELEVENLABS_AGENT_ID — use a Conversational AI agent ID from elevenlabs.io/app/conversational-ai";
            }
            return NextResponse.json({ error: detail }, { status: 502 });
        }

        const data = (await elResponse.json()) as { token?: string };
        if (!data.token) {
            return NextResponse.json(
                { error: "ElevenLabs did not return a conversation token" },
                { status: 502 }
            );
        }

        return NextResponse.json({
            conversationToken: data.token,
        });
    } catch (err) {
        console.error("[elevenlabs/signed-url] Error:", err);
        return NextResponse.json(
            { error: "Internal error generating signed URL" },
            { status: 500 }
        );
    }
}
