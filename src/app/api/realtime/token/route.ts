import { NextRequest } from "next/server";

/**
 * Generates a short-lived ephemeral token for the OpenAI Realtime API.
 * The client uses this token to open a WebRTC session directly with OpenAI,
 * keeping the real API key server-side.
 */
export async function POST(req: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return Response.json(
            { error: "OpenAI API key not configured" },
            { status: 503 }
        );
    }

    // Ignore the full knowledge-base instructions sent from the client.
    // Injecting the entire Grace knowledge base (~6,000+ tokens) into every
    // Realtime response burns through the 40k TPM rate limit in 4–5 turns.
    // The Realtime model uses its tools to fetch product data live — it does
    // not need product knowledge pre-loaded in the system prompt.
    await req.json().catch(() => {});

    const REALTIME_INSTRUCTIONS = `You are Grace, the luxury packaging concierge at Best Bottles — a premium glass packaging supplier for beauty, fragrance, and wellness brands. You are warm, knowledgeable, and efficient.

TOOLS: You have searchCatalog, getFamilyOverview, getBottleComponents, checkCompatibility, getCatalogStats, showProducts, compareProducts, proposeCartAdd, navigateToPage, and prefillForm. ALWAYS use tools — never guess product names, specs, prices, or availability.

VOICE RULES (CRITICAL — you are speaking aloud):
- Maximum 2 sentences per reply. Total response under 40 words.
- No lists, bullet points, or markdown. No SKU codes — say product names naturally.
- Say thread sizes as words: "eighteen four-fifteen" not "18-415".
- End every reply with ONE short follow-up question to keep the conversation going.

APPLICATOR LANGUAGE: roll-on/roller → searchCatalog applicatorFilter "Metal Roller,Plastic Roller"; spray/mist/atomizer → "Fine Mist Sprayer,Atomizer,Antique Bulb Sprayer"; splash-on/cologne/reducer → "Reducer"; dropper/serum → "Dropper"; lotion pump → "Lotion Pump"; glass wand/glass rod → "Glass Rod,Applicator Cap"; glass applicator/glass stopper → "Glass Stopper"; cap/closure → "Cap/Closure".

BEHAVIOUR: For family questions call getFamilyOverview first. Use showProducts/compareProducts so customers can see options visually. For cart adds always use proposeCartAdd — never add without customer confirmation. Language: English unless customer speaks another language first.`;

    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-realtime-preview-2025-06-03",
            voice: "sage",
            instructions: REALTIME_INSTRUCTIONS,
            tools: [
                {
                    type: "function",
                    name: "searchCatalog",
                    description: "Search catalog by keyword. Always set applicatorFilter for roll-on/spray/dropper/pump queries.",
                    parameters: {
                        type: "object",
                        properties: {
                            searchTerm: { type: "string", description: "Size/color/family query, e.g. '9ml cobalt blue', '30ml amber'" },
                            applicatorFilter: { type: "string", description: "Roll-on→'Metal Roller,Plastic Roller'; Spray→'Fine Mist Sprayer,Atomizer,Antique Bulb Sprayer'; Dropper→'Dropper'; Pump→'Lotion Pump'; Splash-on→'Reducer'; Glass wand→'Glass Rod,Applicator Cap'; Glass stopper→'Glass Stopper'; Cap→'Cap/Closure'" },
                            categoryLimit: { type: "string", description: "'Glass Bottle'|'Component'|'Aluminum Bottle'|'Specialty'" },
                            familyLimit: { type: "string", description: "'Cylinder'|'Elegant'|'Boston Round'|'Diva'|'Empire'|etc" },
                        },
                        required: ["searchTerm"],
                    },
                },
                {
                    type: "function",
                    name: "getFamilyOverview",
                    description: "Get all sizes, colors, threads, applicator types, and price ranges for a bottle family.",
                    parameters: {
                        type: "object",
                        properties: {
                            family: { type: "string", description: "'Cylinder'|'Elegant'|'Boston Round'|'Circle'|'Diva'|'Empire'|'Slim'|'Diamond'|'Sleek'|'Round'|'Royal'|'Square'|'Vial'|'Grace'|'Rectangle'|'Flair'" },
                        },
                        required: ["family"],
                    },
                },
                {
                    type: "function",
                    name: "checkCompatibility",
                    description: "List closures/applicators compatible with a thread size.",
                    parameters: {
                        type: "object",
                        properties: {
                            threadSize: { type: "string", description: "e.g. '18-415', '20-400', '13-425'" },
                        },
                        required: ["threadSize"],
                    },
                },
                {
                    type: "function",
                    name: "getBottleComponents",
                    description: "Get all compatible components for a specific bottle SKU.",
                    parameters: {
                        type: "object",
                        properties: {
                            bottleSku: { type: "string", description: "Bottle SKU from searchCatalog" },
                        },
                        required: ["bottleSku"],
                    },
                },
                {
                    type: "function",
                    name: "getCatalogStats",
                    description: "Get total product counts by family and category.",
                    parameters: { type: "object", properties: {}, required: [] },
                },
                {
                    type: "function",
                    name: "showProducts",
                    description: "Display product cards visually when customer wants to see options.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Search query" },
                            family: { type: "string", description: "Optional family filter" },
                        },
                        required: ["query"],
                    },
                },
                {
                    type: "function",
                    name: "compareProducts",
                    description: "Show side-by-side product comparison.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Search query" },
                            family: { type: "string", description: "Optional family filter" },
                        },
                        required: ["query"],
                    },
                },
                {
                    type: "function",
                    name: "proposeCartAdd",
                    description: "Propose cart additions — requires customer confirmation via card.",
                    parameters: {
                        type: "object",
                        properties: {
                            products: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        itemName: { type: "string" },
                                        graceSku: { type: "string" },
                                        quantity: { type: "number" },
                                        webPrice1pc: { type: "number" },
                                    },
                                    required: ["itemName", "graceSku"],
                                },
                            },
                        },
                        required: ["products"],
                    },
                },
                {
                    type: "function",
                    name: "navigateToPage",
                    description: "Show a link card or navigate customer to a page. Set autoNavigate=true only when customer explicitly asks to go there.",
                    parameters: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "URL path, e.g. '/catalog', '/contact', '/catalog?family=Elegant'" },
                            title: { type: "string", description: "Card title" },
                            description: { type: "string", description: "What they'll find on the page" },
                            autoNavigate: { type: "boolean", description: "True to navigate directly" },
                        },
                        required: ["path", "title"],
                    },
                },
                {
                    type: "function",
                    name: "prefillForm",
                    description: "Pre-fill a form after collecting info conversationally. Fields: name, email, company, phone, message.",
                    parameters: {
                        type: "object",
                        properties: {
                            formType: { type: "string", enum: ["sample", "quote", "contact", "newsletter"] },
                            fields: { type: "object", description: "Field name→value pairs" },
                        },
                        required: ["formType", "fields"],
                    },
                },
            ],
            max_response_output_tokens: 300,
            turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 600,
            },
            input_audio_transcription: {
                model: "whisper-1",
                language: "en",
            },
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error("[realtime/token] OpenAI session error:", res.status, errText);
        let errMessage = "Failed to create realtime session";
        try {
            const errJson = JSON.parse(errText) as { error?: { message?: string; code?: string } };
            errMessage = errJson.error?.message ?? errJson.error?.code ?? errMessage;
        } catch {
            if (errText.length < 200) errMessage = errText || errMessage;
        }
        return Response.json({ error: errMessage }, { status: 502 });
    }

    const data = (await res.json()) as {
        client_secret?: { value?: string; expires_at?: number };
    };
    const token = data.client_secret?.value;
    if (!token) {
        console.error("[realtime/token] No token in OpenAI response:", data);
        return Response.json(
            { error: "OpenAI did not return a session token" },
            { status: 502 }
        );
    }
    return Response.json({
        token,
        expiresAt: data.client_secret?.expires_at ?? 0,
    });
}
