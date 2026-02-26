import { NextResponse } from "next/server";

/**
 * Diagnostic endpoint: returns whether the Realtime token route can run.
 * Does not expose the API key. Use for debugging "voice not working" issues.
 */
export async function GET() {
    const hasKey = !!process.env.OPENAI_API_KEY;
    return NextResponse.json({
        configured: hasKey,
        message: hasKey
            ? "OpenAI API key is set. Token route should work."
            : "OPENAI_API_KEY is missing. Add it to .env.local.",
    });
}
