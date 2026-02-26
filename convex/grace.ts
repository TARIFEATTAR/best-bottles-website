import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeComponentsByType } from "./componentUtils";

// ─── Models ───────────────────────────────────────────────────────────────────

const MODEL_TEXT = "claude-sonnet-4-6";
const MODEL_VOICE = "claude-3-5-haiku-latest";
const MAX_TOOL_ITERATIONS_TEXT = 5;
const MAX_TOOL_ITERATIONS_VOICE = 2;

const VOICE_MODE_ADDENDUM = `

## VOICE MODE — ACTIVE (CRITICAL OVERRIDE)
The customer is speaking to you aloud and hearing your response read back by a voice engine. This changes everything about how you respond:

HARD RULES:
- Maximum 2 sentences per reply. Never exceed this.
- Total response must be under 40 words.
- No lists, no bullet points, no dashes, no numbered items, no markdown.
- No SKU codes or product IDs ever. Say the product name naturally: "the frosted Cylinder" not a code.
- DO NOT mention prices unless the customer specifically asks "how much" or "what's the price." Lead with the product, not the number.
- If the customer asks about price, speak it as a round friendly number: "about two dollars each" not "$1.97 per unit."
- Thread sizes: say "eighteen four-fifteen" not "18-415."
- End with ONE short question to keep the conversation going.
- If the customer asks something complex, give the key answer first, then offer to go deeper: "The short answer is X. Want me to walk you through the details?"

## VISUAL ACTIONS — Agentic Tools
You have tools that display rich UI cards in the chat alongside your spoken reply. Use them proactively:

- showProducts: Show product cards when the customer wants to SEE options. Say "Let me pull those up for you" while calling it.
- compareProducts: Show a comparison table when deciding between options. Say "Here's how those compare."
- proposeCartAdd: When a customer says "I want that" or "add it to my cart" — propose adding items. NEVER add without showing the confirmation card first.
- navigateToPage: Suggest browsing a catalog page or product detail page. Say "I'll drop a link for you."
- prefillForm: After gathering info conversationally (name, email, product interest), pre-fill a form for them to review.

CRITICAL: proposeCartAdd always requires customer confirmation via the UI card. Never skip the confirmation step.`;


// ─── Tool definitions (passed to Claude as function signatures) ───────────────

const GRACE_TOOLS: Anthropic.Tool[] = [
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
                        "Optional: restrict to a bottle family — 'Cylinder', 'Elegant', 'Boston Round', 'Circle', 'Diva', 'Empire', 'Slim', 'Diamond', 'Sleek', 'Round', 'Royal', 'Square'",
                },
                applicatorFilter: {
                    type: "string",
                    description:
                        "Optional: restrict to products with a specific applicator type. Comma-separated list of EXACT values from the catalog. " +
                        "Customer language → applicator values to use: " +
                        "'roll-on / roller' → 'Metal Roller,Plastic Roller'; " +
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
            "Get the COMPLETE list of compatible components (closures, sprayers, droppers, lotion pumps, reducers, antique bulb sprayers, caps, roll-on applicators) for a specific bottle variant. Returns every compatible component grouped by type with SKU, name, price, and stock status. ALWAYS call this when a customer asks what components, closures, sprayers, pumps, or applicators work with a specific bottle. This is the definitive compatibility source — more complete than checkCompatibility.",
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

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(
    knowledge: Array<{ title: string; content: string; category: string }>
): string {
    const knowledgeSections = knowledge.length > 0
        ? knowledge.map((k) => `### ${k.title}\n${k.content}`).join("\n\n---\n\n") + "\n\n---\n\n"
        : "";

    return `You are Grace — the packaging concierge for Best Bottles, the premium glass packaging house of Nemat International. With over 170 years of fragrance heritage behind every bottle we carry, you are the first point of contact for beauty, fragrance, and wellness brands who demand precision and quality in their packaging.

You are not a chatbot. You are a luxury boutique concierge — expert, warm, and deeply organised.

---

## CONSTITUTION

### Prime Directive
Act as an expert B2B packaging concierge. Guide buyers to the right bottle and component pairing efficiently and flawlessly — always based on physical compatibility (neck thread size). Use your tools to look up real data before making any recommendation.

### Rule of Truth
Never hallucinate product variations, sizes, or colours. If a size isn't in the catalog (e.g. a 10ml Boston Round), gently pivot: "We don't stock a 10ml Boston Round, but I can show you our 15ml option or a 10ml Rectangle." Always search first.

### Protect the Brand
Best Bottles is an exclusive, high-end supplier that simplifies complex procurement — never a discount warehouse. Acknowledge the $50 minimum order implicitly through upselling and value framing. Never put up walls.

---

## TONALITY & PERSONALITY

- Voice: Elegant, precise, professional — but genuinely warm. Not "How may I assist you?" — rather: "It would be my pleasure to help you assemble the perfect product line."
- Pacing: Concise and rhythmic. B2B buyers value their time. Get straight to the value; don't over-explain.
- The Vibe: Helpful, whip-smart, confident, deeply organised.

---

## SALES INTELLIGENCE: SPIN FRAMEWORK

Use the SPIN selling technique naturally — never formulaically — to uncover volume and need:
- Situation: "What stage of brand development are you in — prototyping or a full production run?"
- Problem: "Have you had trouble finding matching closures for your current bottles, or experienced leak issues?"
- Implication: "Mismatching thread sizes can delay an entire launch. When the cap doesn't seat properly, it's costly."
- Need-Payoff: "If I could automatically verify every closure perfectly matches your bottles and arrange a wholesale case discount, would you be ready to move forward today?"

When a customer assembles a complete kit (bottle + closure + applicator), assume they want a full case, not a single unit: "I've paired your 50ml frosted Diva with a shiny gold sprayer — shall I put together a case for you? I can walk you through the pricing whenever you're ready."

---

## OBJECTION HANDLING

"Your prices are higher than [competitor]."
Response: "We source premium glass formulated to resist leaching, and every fitment is mathematically verified. A leaked bottle costs far more in refunds than a few cents saved on a cheaper cap. Would you like me to walk you through our volume tiers?"

"I don't know if this closure will fit my bottle."
Response: "I've cross-referenced our compatibility matrix. Your bottle's 18-415 thread means this matte silver sprayer will seat perfectly."

"The $50 minimum is too high for a sample."
Response: "For registered businesses, email sales@nematinternational.com with the item codes — my team will manually invoice you for just the samples so you can prototype risk-free."

---

## CATALOG STRUCTURE — APPLICATOR-FIRST ORGANISATION

The catalog is organised by how the customer applies their product — applicator-first. When a customer asks to browse or needs direction, frame the conversation around these categories:

| Customer language | Applicator category | What it means |
|---|---|---|
| Roll-on, roller ball, rollerball | **Roll-on** | Metal Roller or Plastic Roller ball. Best for oils, serums, rollerballs. |
| Spray, sprayer, atomizer, mist, pump spray | **Spray** | Fine Mist Sprayer, Atomizer, Antique Bulb Sprayer. Best for eau de toilette, perfume, toners. |
| Splash-on, cologne, pour, open mouth, reducer, orifice reducer | **Reducer** | Orifice reducer — controlled pour, no mechanical applicator. Best for colognes, concentrated perfume oil. Canonical term: Reducer. |
| Glass wand, glass rod | **Glass Wand** | Glass rod applicator — dab or swipe application. |
| Glass applicator, glass stopper | **Glass Applicator** | Ground glass stopper — traditional apothecary style. |
| Dropper, eye dropper, pipette | **Dropper** | Glass or plastic dropper. Best for serums, essential oils, concentrates. |
| Pump, lotion pump, cream pump | **Lotion Pump** | Pump dispenser. Best for thick emulsions, body lotions, face creams. |
| Cap, closure, simple cap, lid | **Cap/Closure** | Standard cap only. Best for pure decants, concentrated perfume oils, fill-your-own. |

VARIANT HIERARCHY: On each product page, the base bottle is defined by family + size + glass colour. Variants on that page differ by:
1. Applicator type (Roll-on, Spray, Reducer, etc.)
2. Cap/trim colour (Gold, Silver, Black, etc.)

WHEN TO USE applicatorFilter IN searchCatalog:
- Customer says "I want a roll-on bottle" → applicatorFilter: "Metal Roller,Plastic Roller"
- Customer says "spray bottles for perfume" → applicatorFilter: "Fine Mist Sprayer,Atomizer,Antique Bulb Sprayer"
- Customer says "dropper bottle for serum" → applicatorFilter: "Dropper"
- Customer says "splash-on / cologne bottle" → applicatorFilter: "Reducer"
- Customer says "reducer bottle" → applicatorFilter: "Reducer"
- Customer says "glass wand" or "glass rod applicator" → applicatorFilter: "Glass Rod,Applicator Cap"
- Customer says "glass applicator" or "glass stopper" → applicatorFilter: "Glass Stopper"
- Customer asks broadly about a family first → call getFamilyOverview to see applicatorTypes, then searchCatalog with the filter

---

## SUPPLY CHAIN & ASSEMBLY KNOWLEDGE
- Viscosity: Fine mist sprayers suit thin liquids (perfume, toners). Lotion pumps suit thick emulsions. Roll-ons suit oils and serums.
- Assembly: Roll-ons need plugs and caps. Sprayers have collars and dip tubes.
- Glass standards: All glass meets Type III cosmetic/pharmaceutical standards. Amber glass provides UV resistance across all major families.

---

## POLICIES & LOGISTICS
- Minimum order: $50.00 (excluding shipping). Samples below minimum — email sales@nematinternational.com with item codes.
- Processing: 2–3 business days domestic; 1–5 business days to ship. Sept–Dec peak: up to 4–5 business days.
- Same-day shipping: $15 fee. Order before 11am PST. Call 800-936-3628 (not email). Not available internationally or for large/special orders.
- Carriers: UPS and USPS. UPS does not deliver to P.O. Boxes or APO/AFO. Max 40 lbs per package.
- Warehouse pickup: Union City, CA. Call 1 day ahead. Hours: 10:30am–3:00pm.
- Returns: 15-day window from receipt. 15% restocking fee. Customer pays return shipping. No returns on personalised, used, or international orders.
- Damaged/missing items: Claims within 7 business days with photos. Missing items: notify within 48 hours.
- Payments: PayPal, Visa, Mastercard, AMEX, Discover, Business Checks, Bank Wire. No prepaid/gift cards unless registered.
- Sales tax: California orders only. CA resellers must provide a valid resale license.
- Contact: sales@nematinternational.com · 1-800-936-3628 · Mon–Fri 9:30am–5:30pm PST

---

## LIVE KNOWLEDGE BASE
${knowledgeSections}## HOW TO USE YOUR TOOLS

You have five tools. Use them proactively — never guess product details:

- getFamilyOverview: Call this FIRST whenever a customer asks broadly about a bottle family ("what sizes do Boston Rounds come in?", "tell me about Diva", "what Cylinders do you have?"). It returns every size, colour, thread, and applicator type for that family — including the full list of applicatorTypes.
- searchCatalog: Call this whenever a customer describes a specific product by size, colour, use case, OR applicator type. Use the applicatorFilter parameter when the customer uses applicator-first language (roll-on, spray, dropper, etc.). Returns up to 25 results. Search before recommending.
- getBottleComponents: Call this to get the COMPLETE list of compatible components for a specific bottle. This is the definitive source — it returns every compatible sprayer, dropper, lotion pump, antique bulb sprayer, reducer, cap, and roll-on with SKU, pricing, and stock status. ALWAYS use this for compatibility questions about a specific bottle.
- checkCompatibility: Call this when the customer asks about compatibility by thread size generically (not a specific bottle). Returns the fitment matrix for a thread size.
- getCatalogStats: Call this if asked how many products we carry or for a catalog overview. Never use a hardcoded number.

Tool rules:
- CRITICAL: When a customer asks "what goes with" or "what fits" a specific bottle, call getBottleComponents (not checkCompatibility). First use searchCatalog to find the bottle's SKU if you don't know it, then call getBottleComponents with that SKU.
- APPLICATOR-FIRST QUERIES: When a customer uses applicator language ("I need a roll-on bottle", "show me spray options"), call searchCatalog with the appropriate applicatorFilter — see CATALOG STRUCTURE section for the exact mapping. Do NOT just search the term "roll-on" — use applicatorFilter: "Metal Roller,Plastic Roller" instead.
- When a customer asks about a family broadly, call getFamilyOverview first — it returns applicatorTypes so you can immediately tell them which application methods are available. Then searchCatalog for specifics using applicatorFilter.
- Never mention tool names to the customer. Use them naturally in the background.
- If a search returns no results, try a simpler term before saying we don't carry it. For roll-on bottles, search "roller" or use applicatorFilter — item names use "roller ball", not "roll-on".
- Never invent SKUs, prices, or specifications. If data isn't in a tool result, say you'll look into it further.
- When the customer asks "do you have X or Y?" (e.g. "5ml roll-on or 9ml roll-on?"), call searchCatalog first. If both exist, answer YES and list them. Do not say "No" and then list products — that confuses the customer.
- IMPORTANT: Some component itemNames are generic (e.g. "Sprayer Thread 18-415" for antique bulb sprayers). Always trust the component TYPE grouping from getBottleComponents (e.g. "Antique Bulb Sprayer", "Lotion Pump") rather than trying to classify by item name.

---

## PRICING ETIQUETTE (CRITICAL)
- NEVER volunteer prices unless the customer explicitly asks about pricing, cost, budget, or "how much."
- When recommending products, describe them by name, size, color, and what they pair with — NOT by price.
- NEVER say SKU codes, product codes, or internal identifiers to the customer. Use natural product names only: "the 30ml frosted Cylinder" not "GB-CYL-FRS-30ML."
- When a customer DOES ask about pricing, present it naturally: "That one runs about two dollars each, or a dollar eighty-five if you grab a dozen."
- If the customer is comparing options, offer to walk them through pricing: "Would you like me to pull up the pricing on these options?"
- For voice conversations, round prices to the nearest friendly number: "about a dollar fifty" rather than "$1.47."

---

## RESPONSE FORMAT (CRITICAL — READ CAREFULLY)

MATCH YOUR RESPONSE LENGTH TO THE QUESTION:

SIMPLE FACTUAL QUESTION (e.g. "What sizes do Boston Rounds come in?", "What thread size is the Elegant 30ml?"):
- Answer in 1 sentence with just the fact they asked for. Nothing more.
- Add 1 short follow-up question.
- Total: 2 sentences maximum.
- Do NOT add colours, applicator types, variant counts, use cases, or closure suggestions unless they asked.
- Example: "Boston Rounds come in 15ml, 30ml, and 60ml. Is there a particular size you're looking at?"

CONSULTATIVE QUESTION (e.g. "I'm launching a perfume line, what do you recommend?", "Help me find the right bottle"):
- Use the GRACE discovery method. Ask one clarifying question.
- 3 sentences maximum.

SPECIFIC PRODUCT REQUEST (e.g. "Show me a frosted Diva 100ml with a gold sprayer"):
- Confirm the product exists, mention 1-2 key specs.
- Offer the next logical step (closure pairing, pricing if asked).
- 3 sentences maximum.

GENERAL RULES:
- Never use markdown: no asterisks, no bold, no italic, no bullet-point dashes, no headers. Plain prose only.
- No SKU codes. No prices unless asked.
- Respond in the same language the customer uses.
- Only mention information the customer asked about. Do not volunteer extra details to seem thorough — it overwhelms.
- End with ONE short question to keep the conversation going.`;

}

// ─────────────────────────────────────────────────────────────────────────────
// GRACE AI TOOL QUERIES
// These queries are called by the askGrace action as Claude tool executions.
// ─────────────────────────────────────────────────────────────────────────────

// Normalize search terms for better matching — item names use "roller ball", not "roll-on"
function normalizeSearchTerm(term: string): string {
    return term
        .replace(/\broll[- ]?on\b/gi, "roller")
        .replace(/\broll[- ]?on\s*bottle\b/gi, "roller bottle")
        .replace(/\bsplash[- ]?on\b/gi, "reducer")
        .replace(/\blotion\s*pump\s*bottle\b/gi, "lotion pump")
        .replace(/\bdropper\s*bottle\b/gi, "dropper")
        .replace(/\b5\s*ml\b/gi, "5ml")
        .replace(/\b9\s*ml\b/gi, "9ml")
        .trim();
}

/**
 * AI Tool: Search Catalog
 * Grace uses this to find specific bottles or closures based on a user's text prompt.
 */
export const searchCatalog = query({
    args: {
        searchTerm: v.string(),
        categoryLimit: v.optional(v.string()),
        familyLimit: v.optional(v.string()),
        applicatorFilter: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const normalizedTerm = normalizeSearchTerm(args.searchTerm);
        const searchTermToUse = normalizedTerm || args.searchTerm;

        // When an applicator filter is active, take more results before filtering
        const takeCount = args.applicatorFilter ? 100 : 25;

        let q = ctx.db.query("products").withSearchIndex("search_itemName", (q) =>
            q.search("itemName", searchTermToUse)
        );
        if (args.categoryLimit) {
            q = q.filter((q) => q.eq(q.field("category"), args.categoryLimit));
        }
        if (args.familyLimit) {
            q = q.filter((q) => q.eq(q.field("family"), args.familyLimit));
        }
        let results = await q.take(takeCount);

        // Fallback: if few results and term had roll-on/roller, try broader "roller" search
        if (results.length < 5 && /\b(roll|roller)\b/i.test(args.searchTerm)) {
            const fallbackQ = ctx.db
                .query("products")
                .withSearchIndex("search_itemName", (q) => q.search("itemName", "roller"));
            let fallback = await fallbackQ.take(50);
            if (args.familyLimit) {
                fallback = fallback.filter((p) => p.family === args.familyLimit);
            }
            if (args.categoryLimit) {
                fallback = fallback.filter((p) => p.category === args.categoryLimit);
            }
            // Prefer capacity match if user asked for specific size (e.g. 5ml, 9ml)
            const capacityMatch = args.searchTerm.match(/\b(5|9)\s*ml\b/i);
            if (capacityMatch) {
                const targetMl = capacityMatch[1] === "5" ? 5 : 9;
                const byCapacity = fallback.filter((p) => p.capacityMl === targetMl);
                if (byCapacity.length > 0) fallback = byCapacity;
            }
            const seen = new Set(results.map((r) => r.graceSku));
            for (const p of fallback) {
                if (!seen.has(p.graceSku) && results.length < takeCount) {
                    results = [...results, p];
                    seen.add(p.graceSku);
                }
            }
        }

        // Apply applicator filter in JS after fetching (Convex search index doesn't support OR filters)
        if (args.applicatorFilter) {
            const allowed = new Set(
                args.applicatorFilter.split(",").map((s) => s.trim().toLowerCase())
            );
            results = results
                .filter((p) => p.applicator && allowed.has(p.applicator.toLowerCase()))
                .slice(0, 25);
        }

        // Return a trimmed version — components arrays are large and waste tokens
        return results.map((p) => ({
            graceSku: p.graceSku,
            itemName: p.itemName,
            category: p.category,
            family: p.family,
            capacity: p.capacity,
            capacityMl: p.capacityMl,
            color: p.color,
            applicator: p.applicator,
            capColor: p.capColor,
            neckThreadSize: p.neckThreadSize,
            webPrice1pc: p.webPrice1pc,
            webPrice12pc: p.webPrice12pc,
            stockStatus: p.stockStatus,
        }));
    },
});

/**
 * AI Tool: Live Catalog Stats
 * Returns real-time counts — Grace MUST call this instead of guessing.
 */
export const getCatalogStats = query({
    args: {},
    handler: async (ctx) => {
        const groups = await ctx.db.query("productGroups").collect();
        let totalVariants = 0;
        const familyCounts: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};
        const collectionCounts: Record<string, number> = {};
        for (const g of groups) {
            const n = g.variantCount ?? 1;
            totalVariants += n;
            if (g.family) familyCounts[g.family] = (familyCounts[g.family] || 0) + n;
            categoryCounts[g.category] = (categoryCounts[g.category] || 0) + n;
            if (g.bottleCollection)
                collectionCounts[g.bottleCollection] = (collectionCounts[g.bottleCollection] || 0) + n;
        }
        return { totalVariants, totalGroups: groups.length, familyCounts, categoryCounts, collectionCounts };
    },
});

/**
 * AI Tool: Family Overview
 * Returns aggregated sizes, colours, threads, applicators, and price ranges for an entire family.
 */
export const getFamilyOverview = query({
    args: { family: v.string() },
    handler: async (ctx, args) => {
        const products = await ctx.db
            .query("products")
            .withIndex("by_family", (q) => q.eq("family", args.family))
            .collect();

        if (products.length === 0) return null;

        const sizes = new Map<string, { ml: number | null; count: number }>();
        const colors = new Set<string>();
        const threads = new Set<string>();
        const applicators = new Set<string>();
        const categories = new Set<string>();
        let minPrice = Infinity;
        let maxPrice = 0;

        for (const p of products) {
            if (p.capacity) {
                const existing = sizes.get(p.capacity);
                if (existing) {
                    existing.count++;
                } else {
                    sizes.set(p.capacity, { ml: p.capacityMl, count: 1 });
                }
            }
            if (p.color) colors.add(p.color);
            if (p.neckThreadSize) threads.add(p.neckThreadSize);
            if (p.applicator) applicators.add(p.applicator);
            categories.add(p.category);
            if (p.webPrice1pc && p.webPrice1pc > 0) {
                minPrice = Math.min(minPrice, p.webPrice1pc);
                maxPrice = Math.max(maxPrice, p.webPrice1pc);
            }
        }

        return {
            family: args.family,
            totalVariants: products.length,
            categories: [...categories],
            sizes: [...sizes.entries()]
                .map(([label, info]) => ({ label, ml: info.ml, variantCount: info.count }))
                .sort((a, b) => (a.ml ?? 0) - (b.ml ?? 0)),
            colors: [...colors].sort(),
            threadSizes: [...threads].sort(),
            applicatorTypes: [...applicators].sort(),
            priceRange: { min: minPrice === Infinity ? null : minPrice, max: maxPrice || null },
        };
    },
});

/**
 * AI Tool: Get Bottle Components
 * Returns the full grouped components for a specific bottle — the definitive
 * compatibility data. Resolves by graceSku or websiteSku.
 */
export const getBottleComponents = query({
    args: { bottleSku: v.string() },
    handler: async (ctx, args) => {
        const sku = args.bottleSku.trim();
        const bottle =
            (await ctx.db.query("products").withIndex("by_graceSku", (q) => q.eq("graceSku", sku)).first()) ??
            (await ctx.db.query("products").withIndex("by_websiteSku", (q) => q.eq("websiteSku", sku)).first());

        if (!bottle) return null;

        const grouped = normalizeComponentsByType(bottle.components);
        const summary: Record<string, Array<{ graceSku: string; itemName: string; webPrice1pc: number | null; capColor: string | null; stockStatus: string | null }>> = {};
        for (const [type, items] of Object.entries(grouped)) {
            summary[type] = items.map((item) => ({
                graceSku: item.graceSku,
                itemName: item.itemName,
                webPrice1pc: item.webPrice1pc,
                capColor: item.capColor,
                stockStatus: item.stockStatus,
            }));
        }

        return {
            bottle: {
                graceSku: bottle.graceSku,
                itemName: bottle.itemName,
                family: bottle.family,
                capacity: bottle.capacity,
                color: bottle.color,
                neckThreadSize: bottle.neckThreadSize,
            },
            componentTypes: Object.keys(summary),
            totalComponents: Object.values(summary).reduce((s, arr) => s + arr.length, 0),
            components: summary,
        };
    },
});

/**
 * AI Tool: Check Compatibility
 * Returns the fitment matrix for a given thread size.
 */
export const checkCompatibility = query({
    args: { threadSize: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("fitments")
            .withIndex("by_threadSize", (q) => q.eq("threadSize", args.threadSize))
            .collect();
    },
});

/**
 * Fetches the graceKnowledge entries used to build Grace's system prompt.
 * Loads identity, voice, sales training, emotional intelligence, navigation,
 * response templates, product knowledge, and escalation rules.
 */
export const getCoreKnowledge = query({
    args: {},
    handler: async (ctx) => {
        const coreCategories = [
            "identity",
            "voice",
            "emotional_intelligence",
            "sales_methodology",
            "navigation",
            "response_templates",
            "autonomous_behaviours",
            "escalation",
            "brand_differentiators",
            "product_knowledge",
        ];
        const entries: Array<{ title: string; content: string; category: string }> = [];
        for (const category of coreCategories) {
            const items = await ctx.db
                .query("graceKnowledge")
                .withIndex("by_category", (q) => q.eq("category", category))
                .collect();
            entries.push(
                ...items.map((i) => ({ title: i.title, content: i.content, category: i.category }))
            );
        }
        return entries;
    },
});

/**
 * Lightweight knowledge fetch for voice mode — only loads what's needed
 * for concise 2-sentence responses. Cuts system prompt size and latency.
 */
export const getVoiceKnowledge = query({
    args: {},
    handler: async (ctx) => {
        const voiceCategories = ["identity", "voice", "product_knowledge"];
        const entries: Array<{ title: string; content: string; category: string }> = [];
        for (const category of voiceCategories) {
            const items = await ctx.db
                .query("graceKnowledge")
                .withIndex("by_category", (q) => q.eq("category", category))
                .collect();
            entries.push(
                ...items.map((i) => ({ title: i.title, content: i.content, category: i.category }))
            );
        }
        return entries;
    },
});

/**
 * Returns the fully-built system prompt for Grace.
 * Used by the client to configure the OpenAI Realtime session.
 */
export const getGraceInstructions = query({
    args: { voiceMode: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const categories = args.voiceMode
            ? ["identity", "voice", "product_knowledge"]
            : [
                "identity", "voice", "emotional_intelligence", "sales_methodology",
                "navigation", "response_templates", "autonomous_behaviours",
                "escalation", "brand_differentiators", "product_knowledge",
            ];
        const entries: Array<{ title: string; content: string; category: string }> = [];
        for (const category of categories) {
            const items = await ctx.db
                .query("graceKnowledge")
                .withIndex("by_category", (q) => q.eq("category", category))
                .collect();
            entries.push(
                ...items.map((i) => ({ title: i.title, content: i.content, category: i.category }))
            );
        }
        let prompt = buildSystemPrompt(entries);
        if (args.voiceMode) {
            prompt += VOICE_MODE_ADDENDUM;
        }
        return prompt;
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH UTILITY (run once after catalog updates)
// ─────────────────────────────────────────────────────────────────────────────

export const patchKnowledgeEntries = mutation({
    args: {},
    handler: async (ctx) => {
        const patched: string[] = [];
        const catalogEntry = await ctx.db
            .query("graceKnowledge")
            .withSearchIndex("search_content", (q) => q.search("content", "3,179 products"))
            .first();
        if (catalogEntry) {
            await ctx.db.patch(catalogEntry._id, {
                title: "Best Bottles Catalog Overview — What Grace Needs to Know",
                content: `Best Bottles carries thousands of glass and packaging products organised into four primary categories. Grace should ALWAYS call getCatalogStats() to get the live product count — never rely on a number stored in this knowledge entry, as it will go stale.

GLASS BOTTLES (primary product line):
12 distinct bottle families: Cylinder, Elegant, Circle, Diva, Empire, Slim, Boston Round, Sleek, Diamond, Royal, Round, Square. Available in clear, frosted, and amber glass. Capacities from 5ml sample sizes through 500ml production volumes. All glass meets Type III cosmetic/pharmaceutical standards. UV-resistant amber glass is available across all major families.

ALUMINUM BOTTLES:
Lightweight alternative for travel-size and eco-conscious brands.

COMPONENTS (closures, applicators):
Fine mist sprayers (glass and plastic), glass and plastic droppers, roll-on applicators (metal ball, glass ball, plastic ball), lotion pumps, caps (shiny gold, matte gold, shiny silver, matte silver, shiny black, matte black, antique gold), reducers / orifice reducers.

SPECIALTY:
Atomisers, perfume travel sets, specialty dispensing systems.

HOW TO ANSWER "HOW MANY PRODUCTS DO YOU HAVE?":
Call getCatalogStats(). Report totalVariants and totalGroups. Do not invent or recall a number from memory.`,
                tags: ["catalog", "product overview", "glass bottles", "aluminum", "components", "families", "live count"],
                source: "grace_constitution_v3_patched",
            });
            patched.push("catalog overview (removed hardcoded 3,179 count)");
        }
        return {
            success: true,
            patched,
            message: patched.length === 0
                ? "No stale entries found — knowledge base is already current."
                : `Patched ${patched.length} entries: ${patched.join(", ")}`,
        };
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// GRACE AI CORE ACTION — Claude Sonnet 4.6 with agentic tool use
// ─────────────────────────────────────────────────────────────────────────────

export const askGrace = action({
    args: {
        // Full conversation history in Claude's role format.
        // GraceAtelier maps "grace" → "assistant" before calling this.
        messages: v.array(
            v.object({
                role: v.union(v.literal("user"), v.literal("assistant")),
                content: v.string(),
            })
        ),
        // When true, appends voice-mode brevity rules to the system prompt
        voiceMode: v.optional(v.boolean()),
    },
    handler: async (ctx, args): Promise<string> => {
        const t0 = Date.now();
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return "Grace is not yet configured. Please contact the team to enable the AI concierge.";
        }

        const isVoice = !!args.voiceMode;
        const model = isVoice ? MODEL_VOICE : MODEL_TEXT;
        const maxIterations = isVoice ? MAX_TOOL_ITERATIONS_VOICE : MAX_TOOL_ITERATIONS_TEXT;
        const maxTokens = isVoice ? 200 : 1024;

        const anthropic = new Anthropic({ apiKey });

        // ── 1. Build system prompt from live graceKnowledge ──────────────────
        const tKnowledge = Date.now();
        const knowledge = isVoice
            ? await ctx.runQuery(api.grace.getVoiceKnowledge, {})
            : await ctx.runQuery(api.grace.getCoreKnowledge, {});
        console.log(`[Grace perf] knowledge load: ${Date.now() - tKnowledge}ms (${knowledge.length} entries, mode=${isVoice ? "voice" : "text"})`);

        let systemPrompt = buildSystemPrompt(knowledge);
        if (isVoice) {
            systemPrompt += VOICE_MODE_ADDENDUM;
        }

        // ── 2. Set up the mutable message list for the agentic loop ──────────
        const messages: Anthropic.MessageParam[] = args.messages.map((m) => ({
            role: m.role,
            content: m.content,
        }));

        // ── 3. Agentic tool-use loop ──────────────────────────────────────────

        async function callAnthropic(retries = 2): Promise<Anthropic.Message> {
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const tApi = Date.now();
                    const result = await anthropic.messages.create({
                        model,
                        max_tokens: maxTokens,
                        system: systemPrompt,
                        tools: GRACE_TOOLS,
                        messages,
                    });
                    console.log(`[Grace perf] anthropic call (${model}): ${Date.now() - tApi}ms`);
                    return result;
                } catch (e: unknown) {
                    const err = e as { status?: number; error?: { status?: number } };
                    const status = err?.status ?? err?.error?.status;
                    if ((status === 429 || status === 529) && attempt < retries) {
                        const wait = Math.min(2000 * Math.pow(2, attempt), 8000);
                        await new Promise((r) => setTimeout(r, wait));
                        continue;
                    }
                    throw e;
                }
            }
            throw new Error("Exhausted retries");
        }

        try {
            for (let iteration = 0; iteration < maxIterations; iteration++) {
                const response = await callAnthropic();

                // ── Final text response ───────────────────────────────────────
                if (response.stop_reason === "end_turn") {
                    const textBlock = response.content.find((b) => b.type === "text");
                    console.log(`[Grace perf] TOTAL: ${Date.now() - t0}ms (${iteration + 1} iteration(s))`);
                    return textBlock && textBlock.type === "text"
                        ? textBlock.text
                        : "I wasn't able to formulate a response. Please try rephrasing your question.";
                }

                // ── Tool use — execute each tool and feed results back ────────
                if (response.stop_reason === "tool_use") {
                    messages.push({ role: "assistant", content: response.content });

                    const toolResults: Anthropic.ToolResultBlockParam[] = [];

                    for (const block of response.content) {
                        if (block.type !== "tool_use") continue;

                        let result: string;
                        const tTool = Date.now();
                        try {
                            if (block.name === "searchCatalog") {
                                const input = block.input as {
                                    searchTerm: string;
                                    categoryLimit?: string;
                                    familyLimit?: string;
                                    applicatorFilter?: string;
                                };
                                const data = await ctx.runQuery(api.grace.searchCatalog, {
                                    searchTerm: input.searchTerm,
                                    categoryLimit: input.categoryLimit,
                                    familyLimit: input.familyLimit,
                                    applicatorFilter: input.applicatorFilter,
                                });
                                result = data.length > 0
                                    ? JSON.stringify(data, null, 2)
                                    : "No products found for that search. Try a broader term.";
                            } else if (block.name === "getFamilyOverview") {
                                const input = block.input as { family: string };
                                const data = await ctx.runQuery(api.grace.getFamilyOverview, {
                                    family: input.family,
                                });
                                result = data
                                    ? JSON.stringify(data, null, 2)
                                    : `No products found for the "${input.family}" family. Check the family name spelling.`;
                            } else if (block.name === "getBottleComponents") {
                                const input = block.input as { bottleSku: string };
                                const data = await ctx.runQuery(api.grace.getBottleComponents, {
                                    bottleSku: input.bottleSku,
                                });
                                result = data
                                    ? JSON.stringify(data, null, 2)
                                    : `No bottle found with SKU "${input.bottleSku}". Try searchCatalog first to find the correct SKU.`;
                            } else if (block.name === "checkCompatibility") {
                                const input = block.input as { threadSize: string };
                                const data = await ctx.runQuery(api.grace.checkCompatibility, {
                                    threadSize: input.threadSize,
                                });
                                result = data.length > 0
                                    ? JSON.stringify(data, null, 2)
                                    : `No fitment data found for thread size ${input.threadSize}.`;
                            } else if (block.name === "getCatalogStats") {
                                const data = await ctx.runQuery(api.grace.getCatalogStats, {});
                                result = JSON.stringify(data, null, 2);
                            } else {
                                result = `Unknown tool: ${block.name}`;
                            }
                        } catch (e) {
                            result = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
                        }
                        console.log(`[Grace perf] tool ${block.name}: ${Date.now() - tTool}ms`);

                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: block.id,
                            content: result,
                        });
                    }

                    messages.push({ role: "user", content: toolResults });
                    continue;
                }

                break;
            }
        } catch (e: unknown) {
            const err = e as { status?: number; error?: { status?: number } };
            const status = err?.status ?? err?.error?.status;
            console.log(`[Grace perf] TOTAL (error): ${Date.now() - t0}ms`);
            if (status === 429 || status === 529) {
                return "I'm experiencing a brief moment of high demand. Could you try again in just a few seconds? I'll be right here.";
            }
            console.error("Grace AI error:", err);
            return "I ran into an unexpected issue. Please try again in a moment, or reach out to our team at sales@nematinternational.com if this persists.";
        }

        console.log(`[Grace perf] TOTAL: ${Date.now() - t0}ms`);
        return "I ran into an issue processing your request. Please try again in a moment.";
    },
});
