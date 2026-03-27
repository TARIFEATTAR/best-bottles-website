/**
 * Grace AI — Claude tool definitions and model constants.
 *
 * Extracted from grace.ts for maintainability.
 * These are the function schemas passed to Claude so it can call
 * searchCatalog, getFamilyOverview, etc. during conversations.
 */

import Anthropic from "@anthropic-ai/sdk";

// ─── Models ───────────────────────────────────────────────────────────────────

export const MODEL_TEXT = "claude-sonnet-4-6";
export const MODEL_VOICE = "claude-3-5-haiku-latest";
export const MAX_TOOL_ITERATIONS_TEXT = 7;
export const MAX_TOOL_ITERATIONS_VOICE = 2;

// ─── Tool definitions (passed to Claude as function signatures) ───────────────

export const GRACE_TOOLS: Anthropic.Tool[] = [
    {
        name: "searchCatalog",
        description:
            "Search the Best Bottles product catalog by keyword. Call this whenever the customer describes a product type, family, size, color, material, or use case. Returns the top 25 most relevant products with pricing and full specifications. Never guess product details — always search first.",
        input_schema: {
            type: "object" as const,
            properties: {
                searchTerm: {
                    type: "string",
                    description:
                        "The search query. Be specific: e.g. '30ml dropper', 'amber boston round', 'cylinder fine mist sprayer', 'frosted elegant 60ml'. For roll-on products, use 'roller' (NOT 'roll-on') — item names use 'roller ball'.",
                },
                categoryLimit: {
                    type: "string",
                    description:
                        "Optional: restrict to a category — 'Glass Bottle', 'Component', 'Aluminum Bottle', or 'Specialty'",
                },
                familyLimit: {
                    type: "string",
                    description:
                        "Optional: restrict to a bottle family. Valid values: 'Cylinder', 'Elegant', 'Boston Round', 'Circle', 'Diva', 'Empire', 'Slim', 'Diamond', 'Sleek', 'Round', 'Royal', 'Square', 'Rectangle', 'Bell', 'Flair', 'Pillar', 'Teardrop', 'Tulip', 'Vial', 'Apothecary', 'Decorative', 'Atomizer', 'Aluminum Bottle', 'Cream Jar', 'Lotion Bottle', 'Plastic Bottle'. Use 'Apothecary' for apothecary-style glass stopper bottles. Use 'Decorative' for marble-crystal-cap, genie, heart, octagonal, and ornate collectible bottles.",
                },
                applicatorFilter: {
                    type: "string",
                    description:
                        "Optional: restrict to products with a specific applicator type. Comma-separated list of EXACT values from the catalog. " +
                        "Customer language → applicator values to use: " +
                        "'roll-on / roller' → 'Metal Roller Ball,Plastic Roller Ball'; " +
                        "'spray / sprayer / perfume spray' → 'Fine Mist Sprayer,Atomizer,Antique Bulb Sprayer,Antique Bulb Sprayer with Tassel'; " +
                        "'splash-on / cologne / open mouth' → 'Reducer'; " +
                        "'dropper / eye dropper' → 'Dropper'; " +
                        "'lotion pump / pump' → 'Lotion Pump'; " +
                        "'cap / closure / simple cap' → 'Cap/Closure'.",
                },
            },
            required: ["searchTerm"],
        },
    },
    {
        name: "getFamilyOverview",
        description:
            "Get a complete overview of a bottle family: all available sizes, glass colours, thread sizes, applicator types, and price ranges. ALWAYS call this when a customer asks broadly about a family ('what sizes do your Boston Rounds come in?', 'tell me about the Diva', 'what do you have in Cylinders?'). This returns aggregated data — use searchCatalog afterwards if the customer wants specific variants.",
        input_schema: {
            type: "object" as const,
            properties: {
                family: {
                    type: "string",
                    description:
                        "The bottle family name. Must match exactly: 'Cylinder', 'Elegant', 'Boston Round', 'Circle', 'Diva', 'Empire', 'Slim', 'Diamond', 'Sleek', 'Round', 'Royal', 'Square', 'Vial', 'Grace', 'Rectangle', 'Flair'",
                },
            },
            required: ["family"],
        },
    },
    {
        name: "checkCompatibility",
        description:
            "Check which closures and applicators are compatible with a specific bottle neck/thread size. Call this for ANY compatibility question — what cap fits, does this dropper work, will that pump thread on. Never answer compatibility questions from memory.",
        input_schema: {
            type: "object" as const,
            properties: {
                threadSize: {
                    type: "string",
                    description:
                        "The neck thread size to check, e.g. '18-415', '20-400', '24-410', '18-400'. Format: diameter-TPI.",
                },
            },
            required: ["threadSize"],
        },
    },
    {
        name: "getBottleComponents",
        description:
            "Get the COMPLETE list of compatible components (closures, sprayers, droppers, lotion pumps, reducers, antique bulb sprayers, caps, roll-on applicators) for a specific bottle variant. Returns every compatible component grouped by type with SKU, name, price, and stock status. ALWAYS call this when a customer asks what components, closures, sprayers, pumps, or applicators work with a specific bottle. This is the definitive compatibility source — more complete than checkCompatibility. STRATEGY: For 'what sprayer fits X bottle?' questions, first call searchCatalog with the BOTTLE name (e.g. '30ml Cylinder', categoryLimit 'Glass Bottle') to get the bottle's SKU, then call THIS tool with that SKU. Do NOT search for the sprayer by name.",
        input_schema: {
            type: "object" as const,
            properties: {
                bottleSku: {
                    type: "string",
                    description:
                        "The Grace SKU or website SKU of the bottle. E.g. 'GB-CYL-CLR-100ML-SPR-BLK' or 'GBCyl100SpryBlk'. If you don't know the exact SKU, call searchCatalog first to find it.",
                },
            },
            required: ["bottleSku"],
        },
    },
    {
        name: "getCatalogStats",
        description:
            "Get live, real-time counts of products in the catalog — total variants, breakdown by family, category, and collection. ALWAYS call this when asked how many products we carry or about catalog size. Never use a hardcoded number.",
        input_schema: {
            type: "object" as const,
            properties: {},
            required: [],
        },
    },
];
