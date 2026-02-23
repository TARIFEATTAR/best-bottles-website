import { mutation } from "./_generated/server";

/**
 * Run this once to populate Grace AI's knowledge base tables.
 * npx convex run knowledge:seedAll
 */
export const seedAll = mutation({
    args: {},
    handler: async (ctx) => {

        // -------------------------------------------------------------------------
        // 1. GRACE KNOWLEDGE — Brand narratives, FAQs, policies, techniques
        // -------------------------------------------------------------------------
        const knowledgeItems = [
            {
                category: "heritage",
                title: "Nemat International History",
                content: "Best Bottles is a brand of Nemat International, a fragrance and packaging company with over 170 years of history in the industry. Nemat International has supplied premium glass packaging to major retailers including Ulta, Sephora, and Whole Foods. Their domestic supply chain ensures consistent quality, reliable lead times, and no tariff surprises for customers.",
                tags: ["nemat", "heritage", "history", "ulta", "sephora", "whole foods"],
                priority: 1,
                source: "internal",
            },
            {
                category: "policy",
                title: "Minimum Order Quantities",
                content: "Best Bottles accommodates orders starting from as few as 12 units for sample and discovery purposes. Standard volume pricing breaks begin at 12-pack quantities. B2B Scaler pricing begins at 500 units per SKU, and Professional tier pricing is available at 5,000+ units. Custom mould orders may require higher MOQ and lead time discussion.",
                tags: ["moq", "minimum order", "pricing", "sample", "wholesale"],
                priority: 1,
                source: "policy_doc",
            },
            {
                category: "policy",
                title: "Shipping and Lead Times",
                content: "In-stock items typically ship within 1–3 business days from our USA warehouse. Standard domestic ground shipping is free on orders above $199. Expedited shipping is available at checkout. International shipping is available, though lead times may vary. All products are manufactured and warehoused domestically to avoid import tariff surprises.",
                tags: ["shipping", "lead time", "domestic", "warehouse", "express"],
                priority: 1,
                source: "policy_doc",
            },
            {
                category: "product_narrative",
                title: "Boston Round Bottle Family",
                content: "Boston Round bottles are the industry standard for essential oils, fragrance oils, and tinctures. They feature a rounded shoulder and thick UV-resistant glass walls designed for long-term formula stability. Available in amber (for UV protection), clear, and cobalt blue. The 20/400 neck thread is the most common, accepting dropper caps, spray tops, roller balls, and lotion pumps. Best Bottles stocks Boston Rounds from 10ml all the way through 500ml.",
                tags: ["boston round", "amber", "essential oil", "fragrance oil", "dropper", "20-400"],
                relatedSkus: ["GBST-AMB-10ML", "GBST-AMB-30ML", "GBST-AMB-60ML"],
                priority: 1,
                source: "internal",
            },
            {
                category: "product_narrative",
                title: "Cylinder Bottle Family",
                content: "Cylinder bottles represent a modern, minimalist silhouette favored by contemporary fragrance and skincare brands. Their straight walls and consistent diameter make them ideal for high-end label application. Available in clear and frosted glass with multiple neck finishes. The Cylinder collection is one of Best Bottles' largest families, spanning sample sizes (5ml) through large format (500ml).",
                tags: ["cylinder", "minimalist", "modern", "skincare", "label", "fragrance"],
                priority: 2,
                source: "internal",
            },
            {
                category: "product_narrative",
                title: "Diva Bottle Family",
                content: "The Diva collection is Best Bottles' signature decorative line, designed for prestige fragrance brands that want a sculptural, gift-ready presentation. Diva bottles feature a distinctive tapered waist and curved shoulder profile that photographs beautifully and commands shelf presence. Available in clear and frosted finishes.",
                tags: ["diva", "decorative", "luxury", "prestige", "gift", "sculptural"],
                priority: 2,
                source: "internal",
            },
            {
                category: "product_narrative",
                title: "Elegant Bottle Family",
                content: "The Elegant collection bridges classic apothecary tradition with refined contemporary design. Tall, slender profiles with gently rounded shoulders. Ideal for high-end serums, perfumes, and treatment oils. Available in clear, frosted, and amber glass with 18-415 neck finish.",
                tags: ["elegant", "apothecary", "serum", "perfume", "frosted", "18-415"],
                priority: 2,
                source: "internal",
            },
            {
                category: "faq",
                title: "How do I know which cap fits my bottle?",
                content: "The cap or closure must match the bottle's neck thread size exactly. The thread size is always written as two numbers separated by a dash, for example 18-415 or 20-400. The first number is the diameter in millimeters, and the second is the thread style code. You can find the thread size listed on every product page. If you are unsure, Grace can help match your bottle to the right closure from our fitment compatibility database.",
                tags: ["cap", "closure", "thread size", "fitment", "compatibility", "neck"],
                priority: 1,
                source: "faq",
            },
            {
                category: "faq",
                title: "What is the difference between a reducer and a dropper?",
                content: "A reducer (also called an orifice reducer) is a small plastic insert that sits inside the bottle neck and controls the flow rate of the liquid into a tight, precise stream. Droppers, by contrast, include a rubber bulb and glass or plastic pipette that allows you to draw liquid up and dispense it drop by drop. Reducers are better for roll-on and controlled-pour applications. Droppers are better for precise medicinal-style dispensing like serums and tinctures.",
                tags: ["reducer", "dropper", "orifice", "dispenser", "serum", "tincture"],
                priority: 2,
                source: "faq",
            },
            {
                category: "brand",
                title: "Montori / M. Tori Brand Profile",
                content: "Montori (also known as M. Tori) is a prestige fragrance brand within the Nemat International portfolio. They are known for sophisticated oriental and woody fragrance compositions. They frequently use our Elegant and Diva bottle families pairing with gold antique bulb sprayers (18-415 thread) and tall gold caps. Their aesthetic preference is for frosted or clear glass with warm-metallic closures. Grace should provide recommendations that honor this established brand identity when a customer references Montori or M. Tori products.",
                tags: ["montori", "m. tori", "nemat", "oriental", "woody", "prestige", "gold", "antique sprayer"],
                relatedSkus: ["CMP-ASP-SGLD-18-415", "CMP-SPR-IVGD-18-415"],
                priority: 1,
                source: "internal",
            },
        ];

        for (const item of knowledgeItems) {
            await ctx.db.insert("graceKnowledge", item);
        }

        // -------------------------------------------------------------------------
        // 2. GRACE PERSONAS — Customer segment profiles
        // -------------------------------------------------------------------------
        const personas = [
            {
                segment: "indie_perfumer",
                displayName: "The Indie Perfumer",
                description: "A passionate independent fragrance creator, often operating as a one-person or small-team brand. They are artistically driven and deeply care about aesthetics and brand storytelling. Price-conscious but willing to invest in quality when they see the value.",
                typicalOrderSize: "12–500 units",
                pricePoint: "Starter to Graduate tier",
                preferredFamilies: ["Elegant", "Diva", "Cylinder", "Slim"],
                keyMotivations: ["Aesthetic differentiation", "Professional presentation", "Scaling from hobby to brand"],
                commonQuestions: [
                    "What's the minimum quantity I can order?",
                    "Do you have samples or testers?",
                    "What caps work with this bottle?",
                    "Can I get a clear and frosted version of the same bottle?"
                ],
                toneGuidance: "Warm, encouraging, creative. Treat them as an artist building something meaningful. Acknowledge their passion. Use words like 'beautiful', 'signature', 'your brand'. Don't push volume — meet them where they are.",
            },
            {
                segment: "b2b_scaler",
                displayName: "The B2B Scaler",
                description: "A growing brand moving from boutique to mainstream retail or e-commerce scale. They are thinking about consistent supply chains, volume pricing, and operational efficiency. They have a business mindset and appreciate data, reliability, and speed of response.",
                typicalOrderSize: "500–5,000 units per SKU",
                pricePoint: "Scaler tier",
                preferredFamilies: ["Boston Round", "Cylinder", "Aluminum"],
                keyMotivations: ["Volume cost reduction", "Consistent lead times", "MOQ flexibility as they grow", "No tariff surprises"],
                commonQuestions: [
                    "What are your B2B pricing tiers?",
                    "What is your lead time for large orders?",
                    "Do you have domestic stock we can rely on?",
                    "Can we get net-30 payment terms?"
                ],
                toneGuidance: "Professional, efficient, data-forward. Lead with tier pricing quickly. Cite the 170-year heritage for trust, then move to specifics. Offer to connect them with the B2B sales team if the conversation warrants it.",
            },
            {
                segment: "enterprise_retail",
                displayName: "The Enterprise Retail Buyer",
                description: "A procurement professional at a mid-to-large brand (think Ulta supplier or Sephora vendor). They have specifications sheets, have done research, and know exactly what they need. They value reliability, compliance documentation, and account management.",
                typicalOrderSize: "5,000+ units per SKU",
                pricePoint: "Professional tier",
                preferredFamilies: ["Boston Round", "Cylinder", "Elegant"],
                keyMotivations: ["Supply chain reliability", "Compliance and quality documentation", "Dedicated account rep", "Custom mould consideration"],
                commonQuestions: [
                    "Are you a domestic supplier?",
                    "Do you have quality certifications?",
                    "Can we get custom moulds?",
                    "What is your annual capacity?"
                ],
                toneGuidance: "Precise and respect-focused. They know their industry. Do not over-explain basics. Offer to escalate to a human account manager quickly if complex. Cite Ulta and Sephora supply relationships as social proof.",
            },
            {
                segment: "wellness_formulator",
                displayName: "The Wellness Formulator",
                description: "A creator in the natural beauty, essential oil, or CBD/hemp space. They care deeply about ingredient integrity and glass quality. Often knowledgeable about UV protection, material safety, and proper sealing for oxidation-sensitive formulas.",
                typicalOrderSize: "100–2,000 units",
                pricePoint: "Graduate to Scaler tier",
                preferredFamilies: ["Boston Round", "Dropper", "Cylinder"],
                keyMotivations: ["UV protection", "Chemical compatibility", "Dropper and reducer precision", "Amber vs clear distinction"],
                commonQuestions: [
                    "Is your amber glass UV-resistant?",
                    "What are the glass standards for essential oils?",
                    "What dropper sizes do you have?",
                    "Can I get matching caps and droppers with my bottles?"
                ],
                toneGuidance: "Knowledgeable and science-adjacent. They will appreciate specificity — glass type (Type III), UV rating, neck thread compatibility. Use technical language comfortably but do not condescend. They are experts in their field too.",
            },
        ];

        for (const persona of personas) {
            await ctx.db.insert("gracePersonas", persona);
        }

        // -------------------------------------------------------------------------
        // 3. GRACE OBJECTIONS — Pre-built responses to common friction points
        // -------------------------------------------------------------------------
        const objections = [
            {
                category: "pricing",
                objection: "Your prices are higher than other suppliers I've found online.",
                response: "That's a fair observation, and I appreciate you being direct. A few things make Best Bottles different: our entire supply chain is domestic, which means no tariff exposure, no customs delays, and no quality variance from batch to batch. We also guarantee the same glass specifications you'd find going into Ulta and Sephora's supply chain. When you factor in the cost of a bad batch — reformulation, reprinting, repackaging — the delta in cost per unit becomes very small.",
                followUpQuestion: "Can I ask what quantity you're planning to order? I can pull up our exact tier pricing to give you a real apples-to-apples comparison.",
                relatedPersonas: ["b2b_scaler", "indie_perfumer"],
            },
            {
                category: "moq",
                objection: "Your minimum order is too high for where I am right now.",
                response: "Totally understood — and starting small is the smart move. We actually offer case packs as low as 12 units for most bottle families, specifically designed for brands in early product development. Some customers start with a 12-pack just to validate their packaging before scaling. Would it help if I found the smallest available quantity for the specific product you're looking at?",
                followUpQuestion: "What bottle are you considering? I can check our exact case quantity so you know the true minimum.",
                relatedPersonas: ["indie_perfumer", "wellness_formulator"],
            },
            {
                category: "lead_time",
                objection: "I need this faster than your stated lead time.",
                response: "Let me check what we have in stock that ships same or next day. For most of our core collections — Boston Rounds, Cylinders, Elegant — we carry substantial domestic inventory specifically to solve this problem. Depending on exactly what you need, there's a good chance we can get it to you quickly.",
                followUpQuestion: "What's your zip code and ideal arrival date? I can give you a realistic shipping window right now.",
                relatedPersonas: ["b2b_scaler", "wellness_formulator"],
            },
            {
                category: "compatibility",
                objection: "I'm not sure if this cap will fit my bottle.",
                response: "That's exactly what our fitment system is built for. The key is the neck thread size — it's always listed on the bottle product page as two numbers like 18-415 or 20-400. Once I have that, I can tell you with certainty which caps, droppers, sprayers, and pumps will fit. Want to tell me the thread size or the bottle name and I'll look it up?",
                followUpQuestion: "What thread size or bottle name are you working with?",
                relatedPersonas: ["indie_perfumer", "wellness_formulator", "b2b_scaler"],
            },
            {
                category: "quality",
                objection: "How do I know your glass quality is consistent batch to batch?",
                response: "This is one of the most important questions you can ask, and it's exactly why domestic manufacturing matters. We control our own moulds and work with the same glass partners that supply to major retail channels. Our glass meets ASTM Type III standards for pharmaceutical and cosmetic compatibility. If you ever receive a batch with dimensional variance outside tolerance, we make it right.",
                followUpQuestion: "Are you working with a formulation that has specific material compatibility requirements? I can double-check the glass spec for you.",
                relatedPersonas: ["enterprise_retail", "wellness_formulator"],
            },
        ];

        for (const objection of objections) {
            await ctx.db.insert("graceObjections", objection);
        }

        // -------------------------------------------------------------------------
        // 4. GRACE TRENDS — Market insights Grace can cite
        // -------------------------------------------------------------------------
        const trends = [
            {
                category: "fragrance",
                trendStage: "growing",
                title: "Oil-Based Perfume Surge",
                summary: "Alcohol-free perfume oils and attars are seeing double-digit growth driven by wellness-conscious consumers and Middle Eastern fragrance culture crossover into Western markets.",
                relevantFamilies: ["Boston Round", "Cylinder", "Dropper"],
                relevantCapacities: ["10ml", "15ml", "30ml"],
                customerImplication: "Brands launching oil-based perfume lines need dropper-compatible bottles with tight neck seals. Amber glass is preferred for formula longevity.",
                graceTalkingPoint: "Oil-based perfumes are one of the fastest growing fragrance formats right now — if you are launching a line, our amber Boston Rounds with glass droppers are the industry go-to.",
            },
            {
                category: "skincare",
                trendStage: "peak",
                title: "Clean Beauty Serum Packaging",
                summary: "The clean beauty movement continues to peak, with consumers expecting minimalist, clinical, and sustainable packaging. Frosted glass with dropper applicators is the dominant aesthetic.",
                relevantFamilies: ["Elegant", "Cylinder", "Slim"],
                relevantCapacities: ["15ml", "30ml", "50ml"],
                customerImplication: "Serum brands need frosted glass with precise dropper or pump applicators. Consistent wall thickness is critical for perceived quality.",
                graceTalkingPoint: "For clean beauty serums, frosted glass with a matching gold or matte black dropper is the premium standard right now — it photographs beautifully and communicates luxury without being loud about it.",
            },
            {
                category: "wellness",
                trendStage: "growing",
                title: "Functional Wellness Apothecary",
                summary: "Adaptogen blends, mushroom tinctures, and herbal extracts are driving apothecary-style packaging demand. Boston Rounds and dropper bottles in amber are the format of choice.",
                relevantFamilies: ["Boston Round"],
                relevantCapacities: ["30ml", "60ml", "120ml"],
                customerImplication: "Wellness brands benefit from amber glass for UV protection of photosensitive botanicals. Dropper and reducer formats are preferred for dosing precision.",
                graceTalkingPoint: "The adaptogen and herbal tincture space is booming, and amber Boston Rounds are the standard container. We have them from 10ml samples all the way through 120ml treatment sizes.",
            },
        ];

        for (const trend of trends) {
            await ctx.db.insert("graceTrends", trend);
        }

        // -------------------------------------------------------------------------
        // 5. GRACE STATISTICS — Authority facts Grace can cite
        // -------------------------------------------------------------------------
        const statistics = [
            {
                category: "heritage",
                stat: "170+ Years in Business",
                context: "Nemat International, the parent company of Best Bottles, has over 170 years of history in the fragrance and packaging industry.",
                description: "With roots going back to the 1850s, Nemat International is one of the oldest active fragrance and packaging companies in the United States. This heritage means institutional knowledge, supplier relationships, and quality standards that newer entrants cannot replicate quickly.",
                verified: true,
                citationNote: "Nemat International corporate history",
            },
            {
                category: "scale",
                stat: "3,100+ Premium Products",
                context: "Best Bottles carries over 3,100 curated packaging products across glass, aluminum, and component categories.",
                description: "The catalog spans glass bottles, aluminum bottles, caps, closures, droppers, sprayers, pumps, reducers, and roll-on components. The breadth means that for virtually any fragrance or cosmetic application, Best Bottles has a compatible solution at multiple price tiers.",
                verified: true,
            },
            {
                category: "partnerships",
                stat: "Trusted by Ulta, Sephora & Whole Foods",
                context: "Nemat International's glass packaging has been used in supply chains serving Ulta Beauty, Sephora, and Whole Foods Market.",
                description: "These retail partnerships represent some of the most demanding quality standards in the consumer goods industry. The fact that Best Bottles glass meets these standards means independent brands benefit from enterprise-grade quality at accessible pricing.",
                verified: true,
            },
            {
                category: "quality",
                stat: "Domestic Supply Chain, No Tariff Surprises",
                context: "All Best Bottles products are sourced and warehoused domestically in the USA, eliminating import tariff exposure.",
                description: "In an era of volatile international trade policy, domestic production and warehousing insulates customers from unpredictable cost increases. Best Bottles controls its own moulds and warehousing, which means lead times and quality standards remain consistent regardless of international supply chain disruption.",
                verified: true,
            },
        ];

        for (const stat of statistics) {
            await ctx.db.insert("graceStatistics", stat);
        }

        return {
            success: true,
            inserted: {
                knowledge: knowledgeItems.length,
                personas: personas.length,
                objections: objections.length,
                trends: trends.length,
                statistics: statistics.length,
            }
        };
    }
});
