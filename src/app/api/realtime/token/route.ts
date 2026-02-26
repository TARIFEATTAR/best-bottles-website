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

    const body = (await req.json().catch(() => ({}))) as {
        instructions?: string;
    };

    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-realtime-preview-2025-06-03",
            voice: "sage",
            modalities: ["text", "audio"],
            instructions: (body.instructions || "") +
                "\n\nCRITICAL: Always respond in English unless the customer explicitly speaks another language first. Your default language is English.",
            tools: [
                {
                    type: "function",
                    name: "searchCatalog",
                    description:
                        "Search the Best Bottles product catalog by keyword. Returns top 25 products with specs and pricing.",
                    parameters: {
                        type: "object",
                        properties: {
                            searchTerm: {
                                type: "string",
                                description:
                                    "Search query: e.g. '30ml dropper', 'amber boston round', 'frosted elegant 60ml'",
                            },
                            categoryLimit: {
                                type: "string",
                                description:
                                    "Optional: 'Glass Bottle', 'Component', 'Aluminum Bottle', or 'Specialty'",
                            },
                            familyLimit: {
                                type: "string",
                                description:
                                    "Optional: 'Cylinder', 'Elegant', 'Boston Round', etc.",
                            },
                        },
                        required: ["searchTerm"],
                    },
                },
                {
                    type: "function",
                    name: "getFamilyOverview",
                    description:
                        "Get a complete overview of a bottle family: sizes, colours, thread sizes, applicator types, price ranges. ALWAYS call this when asked broadly about a family.",
                    parameters: {
                        type: "object",
                        properties: {
                            family: {
                                type: "string",
                                description:
                                    "Family name: 'Cylinder', 'Elegant', 'Boston Round', 'Circle', 'Diva', 'Empire', 'Slim', 'Diamond', 'Sleek', 'Round', 'Royal', 'Square', 'Vial', 'Grace', 'Rectangle', 'Flair'",
                            },
                        },
                        required: ["family"],
                    },
                },
                {
                    type: "function",
                    name: "checkCompatibility",
                    description:
                        "Check which closures/applicators are compatible with a bottle neck/thread size. Call for ANY compatibility question.",
                    parameters: {
                        type: "object",
                        properties: {
                            threadSize: {
                                type: "string",
                                description:
                                    "Neck thread size: '18-415', '20-400', '13-425', etc.",
                            },
                        },
                        required: ["threadSize"],
                    },
                },
                {
                    type: "function",
                    name: "getCatalogStats",
                    description:
                        "Get live product counts — total variants, breakdown by family, category, collection. ALWAYS call when asked about catalog size.",
                    parameters: {
                        type: "object",
                        properties: {},
                        required: [],
                    },
                },
                {
                    type: "function",
                    name: "showProducts",
                    description:
                        "Display product cards visually in the chat. Call this when the customer wants to SEE products, not just hear about them. Shows images, specs, and prices in a card layout.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "Search query to find products to display",
                            },
                            family: {
                                type: "string",
                                description: "Optional: filter to a specific bottle family",
                            },
                        },
                        required: ["query"],
                    },
                },
                {
                    type: "function",
                    name: "compareProducts",
                    description:
                        "Show a side-by-side comparison of products in the chat. Call when customer is deciding between options or asks to compare bottles.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "Search query to find products to compare",
                            },
                            family: {
                                type: "string",
                                description: "Optional: filter to a specific family",
                            },
                        },
                        required: ["query"],
                    },
                },
                {
                    type: "function",
                    name: "proposeCartAdd",
                    description:
                        "Propose adding products to the customer's cart. This shows a confirmation card — the customer must approve before anything is added. Call when customer says they want to buy, order, add to cart, or when you're recommending a complete selection.",
                    parameters: {
                        type: "object",
                        properties: {
                            products: {
                                type: "array",
                                description: "Products to propose adding",
                                items: {
                                    type: "object",
                                    properties: {
                                        itemName: { type: "string" },
                                        graceSku: { type: "string" },
                                        quantity: { type: "number", description: "Default 1" },
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
                    description:
                        "Show a navigation card that links the customer to a specific page on the website. Use when suggesting they view the full catalog, a product detail page, or any other page.",
                    parameters: {
                        type: "object",
                        properties: {
                            path: {
                                type: "string",
                                description: "URL path: '/catalog', '/products/frosted-cylinder-30ml', '/catalog?family=Elegant'",
                            },
                            title: {
                                type: "string",
                                description: "Card title: 'View the Elegant Collection', 'Browse All Cylinders'",
                            },
                            description: {
                                type: "string",
                                description: "Brief description of what they'll find on the page",
                            },
                        },
                        required: ["path", "title"],
                    },
                },
                {
                    type: "function",
                    name: "prefillForm",
                    description:
                        "Pre-fill and display a form for the customer to review and submit. Use for sample requests, quote requests, contact forms, or newsletter signups. Gather the information conversationally first, then show the form.",
                    parameters: {
                        type: "object",
                        properties: {
                            formType: {
                                type: "string",
                                enum: ["sample", "quote", "contact", "newsletter"],
                                description: "Type of form to show",
                            },
                            fields: {
                                type: "object",
                                description: "Key-value pairs of form field names and values collected from conversation",
                            },
                        },
                        required: ["formType", "fields"],
                    },
                },
            ],
            turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
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
        return Response.json(
            { error: "Failed to create realtime session" },
            { status: 502 }
        );
    }

    const data = await res.json();
    return Response.json({
        token: data.client_secret?.value,
        expiresAt: data.client_secret?.expires_at,
    });
}
