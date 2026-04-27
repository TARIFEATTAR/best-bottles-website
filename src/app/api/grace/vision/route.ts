import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * Grace vision endpoint — GPT-4o analyzes an uploaded reference image and
 * returns a description focused on catalog-relevant attributes (shape,
 * capacity, color, applicator). The description is then used as a
 * searchCatalog query to find matching bottles for Pattern H.
 *
 * Body:  { imageUrl: string }
 * Resp:  { description: string, searchTerms: string }
 */

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as { imageUrl?: string };
        const imageUrl = body.imageUrl?.trim();
        if (!imageUrl) {
            return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "OpenAI key not configured" }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 220,
            temperature: 0.2,
            messages: [
                {
                    role: "system",
                    content:
                        "You analyze packaging photos for a glass-bottle catalog search. " +
                        "Reply in two short lines:\n" +
                        "DESCRIPTION: 1-2 sentences in plain prose covering shape, color, applicator, and rough capacity.\n" +
                        "SEARCH: 4-6 keywords joined by spaces (e.g. '50ml clear cylinder fine mist sprayer'). " +
                        "Keywords should be searchable terms a wholesale bottle catalog would use — prefer 'roller' over 'roll-on', 'sprayer' over 'spray bottle'.",
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this reference image." },
                        { type: "image_url", image_url: { url: imageUrl } },
                    ],
                },
            ],
        });

        const raw = completion.choices[0]?.message?.content ?? "";
        // Parse the "DESCRIPTION: ... \n SEARCH: ..." shape.
        // [\s\S] is used instead of `.` + `s` (dotAll) flag because the `s`
        // flag requires ES2018+ and tsconfig targets ES2017.
        const descMatch = raw.match(/DESCRIPTION:\s*([\s\S]+?)(?:\n|SEARCH:|$)/i);
        const searchMatch = raw.match(/SEARCH:\s*([\s\S]+?)$/i);
        const description = (descMatch?.[1] ?? raw).trim();
        const searchTerms = (searchMatch?.[1] ?? "").trim();

        return NextResponse.json({ description, searchTerms });
    } catch (err) {
        console.error("[Grace vision] Error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Vision failed" },
            { status: 500 },
        );
    }
}
