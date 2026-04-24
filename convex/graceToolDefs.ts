/**
 * Grace AI — OpenAI tool definitions and model constants.
 *
 * Extracted from grace.ts for maintainability.
 * Schemas are in OpenAI's `chat.completions` tools shape with `strict: true`
 * so the API guarantees the model returns tool_call arguments matching the
 * schema exactly. Tool implementations live in convex/grace.ts (askGrace).
 */

import type OpenAI from "openai";

// ─── Models ───────────────────────────────────────────────────────────────────

export const MODEL_TEXT = "gpt-4.1";
export const MODEL_VOICE = "gpt-4.1-mini";
export const MAX_TOOL_ITERATIONS_TEXT = 7;
export const MAX_TOOL_ITERATIONS_VOICE = 2;

// ─── Tool definitions (passed to OpenAI as function schemas) ──────────────────

export const GRACE_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "searchCatalog",
            description:
                "Search the Best Bottles product catalog by keyword. Call this whenever the customer describes a product type, family, size, color, material, or use case. Returns the top 25 most relevant products with pricing and full specifications. Never guess product details — always search first.",
            parameters: {
                type: "object",
                properties: {
                    searchTerm: {
                        type: "string",
                        description:
                            "The search query. Be specific: e.g. '30ml dropper', 'amber boston round', 'cylinder fine mist sprayer', 'frosted elegant 60ml'. For roll-on products, use 'roller' (NOT 'roll-on') — item names use 'roller ball'.",
                    },
                    categoryLimit: {
                        type: ["string", "null"],
                        description:
                            "Optional: restrict to a category — 'Glass Bottle', 'Component', 'Aluminum Bottle', 'Plastic Bottle', 'Specialty', 'Cream Jar', 'Lotion Bottle', 'Metal Atomizer', etc. Pass null to omit.",
                    },
                    familyLimit: {
                        type: ["string", "null"],
                        description:
                            "Optional: restrict to a bottle family. Valid values: 'Cylinder', 'Elegant', 'Boston Round', 'Circle', 'Diva', 'Empire', 'Slim', 'Diamond', 'Sleek', 'Round', 'Royal', 'Square', 'Rectangle', 'Bell', 'Flair', 'Pillar', 'Teardrop', 'Tulip', 'Vial', 'Apothecary', 'Decorative', 'Atomizer', 'Aluminum Bottle', 'Cream Jar', 'Lotion Bottle', 'Plastic Bottle'. Use 'Apothecary' for apothecary-style glass stopper bottles. Use 'Decorative' for marble-crystal-cap, genie, heart, octagonal, and ornate collectible bottles. Pass null to omit.",
                    },
                    applicatorFilter: {
                        type: ["string", "null"],
                        description:
                            "Optional: restrict to products with a specific applicator type. Comma-separated list of EXACT values from the catalog. " +
                            "For **9ml Cylinder roll-on** specifically, use searchTerm like '9ml cylinder roller' with familyLimit 'Cylinder' — do not rely on a vague 'roll-on' search with the wrong family. " +
                            "Customer language → applicator values to use: " +
                            "'roll-on / roller' → 'Metal Roller Ball,Plastic Roller Ball'; " +
                            "'spray / sprayer / perfume spray' → 'Fine Mist Sprayer,Atomizer,Antique Bulb Sprayer,Antique Bulb Sprayer with Tassel'; " +
                            "'splash-on / cologne / open mouth' → 'Reducer'; " +
                            "'dropper / eye dropper' → 'Dropper'; " +
                            "'lotion pump / pump' → 'Lotion Pump'; " +
                            "'cap / closure / simple cap' → 'Cap/Closure'. " +
                            "If the customer names several applicator types at once (e.g. 9ml roll-on, sprayer, and lotion pump), pass null so results include every variant.",
                    },
                },
                required: ["searchTerm", "categoryLimit", "familyLimit", "applicatorFilter"],
                additionalProperties: false,
            },
            strict: true,
        },
    },
    {
        type: "function",
        function: {
            name: "getFamilyOverview",
            description:
                "Get a complete overview of a bottle family: all available sizes, glass colours, thread sizes, applicator types, and price ranges. ALWAYS call this when a customer asks broadly about a family ('what sizes do your Boston Rounds come in?', 'tell me about the Diva', 'what do you have in Cylinders?'). This returns aggregated data — use searchCatalog afterwards if the customer wants specific variants. For family 'Cylinder', the response may include graceHint: read it — it states facts about 9ml roll-on and lotion pump SKUs that you must not contradict.",
            parameters: {
                type: "object",
                properties: {
                    family: {
                        type: "string",
                        description:
                            "The bottle family name. Must match exactly: 'Cylinder', 'Elegant', 'Boston Round', 'Circle', 'Diva', 'Empire', 'Slim', 'Diamond', 'Sleek', 'Round', 'Royal', 'Square', 'Vial', 'Grace', 'Rectangle', 'Flair'",
                    },
                },
                required: ["family"],
                additionalProperties: false,
            },
            strict: true,
        },
    },
    {
        type: "function",
        function: {
            name: "checkCompatibility",
            description:
                "Return the fitment matrix for a NECK THREAD size (e.g. 18-415, 20-410). Compatibility is keyed by thread — same specification required for physical fit. Call when the question is by thread size alone. Never answer from memory. For a specific bottle, use getBottleComponents first (it includes neck thread + components).",
            parameters: {
                type: "object",
                properties: {
                    threadSize: {
                        type: "string",
                        description:
                            "The neck thread size to check, e.g. '18-415', '20-400', '24-410', '18-400'. Format: diameter-TPI.",
                    },
                },
                required: ["threadSize"],
                additionalProperties: false,
            },
            strict: true,
        },
    },
    {
        type: "function",
        function: {
            name: "getBottleComponents",
            description:
                "Get compatible components for a specific bottle SKU. Returns neck thread size (primary fitment key), grouped components, and counts. Compatibility is driven by NECK THREAD — explain fit using the thread from this result plus COMPONENT DATA. Component groups may include multiple cap types (Short Cap, Tall Cap, colors), sprayers, pumps, etc. — list each TYPE the tool returns. STRATEGY: Find the bottle SKU via searchCatalog with the correct categoryLimit, then call this tool. For 'what sprayer fits X bottle?' do NOT search for the sprayer by name first.",
            parameters: {
                type: "object",
                properties: {
                    bottleSku: {
                        type: "string",
                        description:
                            "The Grace SKU or website SKU of the bottle. E.g. 'GB-CYL-CLR-100ML-SPR-BLK' or 'GBCyl100SpryBlk'. If you don't know the exact SKU, call searchCatalog first to find it.",
                    },
                },
                required: ["bottleSku"],
                additionalProperties: false,
            },
            strict: true,
        },
    },
    {
        type: "function",
        function: {
            name: "getCatalogStats",
            description:
                "Get live, real-time counts of products in the catalog — total variants, breakdown by family, category, and collection. ALWAYS call this when asked how many products we carry or about catalog size. Never use a hardcoded number.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
                additionalProperties: false,
            },
            strict: true,
        },
    },
];
