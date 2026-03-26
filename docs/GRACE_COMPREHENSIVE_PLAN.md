# Grace AI — Comprehensive Gap Analysis & Implementation Plan

### Best Bottles / Nemat International
**Version 3.0 — March 25, 2026 — Prepared by Asala, LLC**

---

## Reality Check: What's Actually Built vs. What's Not

Before building a plan, here is the honest audit of Grace's current state. No hand-waving — file-by-file verification.

| Capability | Status | Evidence |
|---|---|---|
| **Voice output (ElevenLabs TTS)** | IMPLEMENTED | `GraceElevenLabsProvider.tsx`, eleven_turbo_v2_5, WebSocket streaming |
| **Voice input (STT)** | IMPLEMENTED | `/api/voice/transcribe/route.ts`, ElevenLabs scribe_v2 |
| **Context injection (page/product/cart)** | IMPLEMENTED | `formatPageContextForGrace()`, injected into session overrides |
| **Browsing history tracking** | IMPLEMENTED | `BrowsingHistoryEntry[]` state, last 50 pages, session-level |
| **Client tools (16 tools)** | IMPLEMENTED | searchCatalog, showProducts, getBottleComponents, etc. |
| **Conversation logging** | IMPLEMENTED | `conversations` + `messages` tables in Convex |
| **Product catalog** | IMPLEMENTED | 2,285 SKUs, 230 product groups, fitments table |
| **Form filling (live)** | IMPLEMENTED | updateFormField, submitForm, prefillForm tools |
| **B2B portal Grace** | BASIC | Static text-only chat in GraceWorkspaceChat.tsx — no voice, no tools |
| **Paper Doll configurator** | INFRASTRUCTURE | Schema + scripts + Sanity types exist; compositor needs verification |
| **Proactive behavioral triggers** | NOT BUILT | Zero code for exit intent, dwell time, cart idle, returning users |
| **Analytics (PostHog/Clarity)** | NOT INSTALLED | Zero dependencies, zero events, zero heatmaps |
| **Session recording** | NOT INSTALLED | No session replay SDK anywhere |
| **Cross-session customer memory** | NOT BUILT | No `customers` table; every session starts fresh |
| **Self-improvement training loop** | NOT BUILT | eval scripts exist but are manual CLI only |
| **Klaviyo abandonment recovery** | NOT BUILT | Zero Klaviyo code or integration |
| **Brand Brain Sessions (Abbas)** | NOT CAPTURED | The 10 critical questions haven't been recorded |
| **Agent-to-agent (MCP/A2A)** | NOT STARTED | MCP tools exist internally; no external agent card published |

**Score: 8 of 18 capabilities implemented. 10 gaps to close.**

---

## The Plan: 5 Phases, 12 Weeks

### Phase 0 — Analytics Foundation (Week 1)
> *You can't optimize what you can't measure. Install the observation layer FIRST so every subsequent change has data.*

### Phase 1 — Proactive Grace (Weeks 2-3)
> *Grace stops waiting to be asked. She initiates at the moment of hesitation.*

### Phase 2 — Cross-Session Intelligence (Weeks 4-5)
> *Grace remembers returning customers and their preferences.*

### Phase 3 — Self-Improvement Loop (Weeks 6-8)
> *Grace gets smarter every week without manual effort.*

### Phase 4 — Abandonment Recovery + B2B Portal (Weeks 9-12)
> *Close the revenue leakage loop. Activate portal Grace.*

### Phase 5 — Bleeding Edge (Months 4-12+)
> *Agent-to-agent discovery, voice checkout, predictive reordering.*

---

## Phase 0 — Analytics Foundation (Week 1)

### Why First
Every proactive trigger, every conversion funnel, every training signal depends on behavioral data. Without PostHog, you're flying blind — just like Grace was before we gave her page context.

### 0.1 Install PostHog (Primary Analytics)

**Why PostHog over alternatives:**
- **Native LLM analytics** — tracks every Grace conversation: inputs, outputs, tokens, cost, latency, tool calls. No other platform does this.
- **Session replay** linked directly to product analytics events — jump from a funnel drop-off to the exact recording
- **Heatmaps + funnels + feature flags** in one platform
- **Official Next.js SDK** with Vercel integration guide
- **Free tier**: 5,000 session recordings + 1M events/month (sufficient for Best Bottles' traffic)
- **Open source**, self-hostable if needed

**Step 1: Install**
```bash
npm install posthog-js posthog-node
```

**Step 2: Create Provider** (`src/components/PostHogProvider.tsx`)
```typescript
"use client";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";

export function PostHogProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
            capture_pageview: true,
            capture_pageleave: true,
            autocapture: true,
            session_recording: {
                maskAllInputs: false,         // We want to see form interactions
                maskInputOptions: {
                    password: true,           // Mask passwords
                    // Don't mask: name, email, phone (needed for form analysis)
                },
            },
        });
    }, []);

    return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

**Step 3: Add to layout** (`src/app/layout.tsx` — wrap children)

**Step 4: Environment variables**
```
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### 0.2 Install Microsoft Clarity (Free Backup Heatmaps)

Clarity provides unlimited free session recordings and heatmaps. Layer it alongside PostHog as insurance.

```typescript
// src/components/ClarityProvider.tsx
"use client";
import { useEffect } from "react";

export function ClarityProvider() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        const script = document.createElement("script");
        script.innerHTML = `
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_ID}");
        `;
        document.head.appendChild(script);
    }, []);
    return null;
}
```

### 0.3 Grace-Specific Analytics Events

Create a centralized analytics module that fires named events for every Grace interaction:

```typescript
// src/lib/analytics/graceEvents.ts
import posthog from "posthog-js";

export const graceAnalytics = {
    // ── Session lifecycle ──────────────────────────────────────────
    widgetOpened: (trigger: "user_click" | "proactive_dwell" | "proactive_exit" |
                           "proactive_cart_idle" | "proactive_returning" | "voice_button") => {
        posthog.capture("grace_session_started", {
            trigger,
            page_type: getPageType(),
            product_sku: getCurrentSku(),
            cart_value: getCartTotal(),
            customer_tier: getCustomerTier(),
        });
    },

    widgetClosed: (turnCount: number, durationMs: number) => {
        posthog.capture("grace_session_ended", {
            turn_count: turnCount,
            duration_seconds: Math.round(durationMs / 1000),
            page_type: getPageType(),
        });
    },

    // ── Tool usage ──────────────────────────────────────────────────
    toolCalled: (toolName: string, params: Record<string, unknown>, durationMs: number) => {
        posthog.capture("grace_tool_called", {
            tool_name: toolName,
            params_summary: JSON.stringify(params).slice(0, 200),
            duration_ms: durationMs,
        });
    },

    // ── Recommendations & conversions ───────────────────────────────
    productRecommended: (skus: string[]) => {
        posthog.capture("grace_product_recommended", {
            recommended_skus: skus,
            count: skus.length,
        });
    },

    productViewed: (sku: string, source: "grace_recommendation" | "browsing") => {
        posthog.capture("grace_product_viewed", { sku, source });
    },

    cartAddFromGrace: (sku: string, quantity: number) => {
        posthog.capture("grace_cart_add", { sku, quantity });
    },

    conversionFromGrace: (orderValue: number, skus: string[], turnCount: number) => {
        posthog.capture("grace_conversion", {
            order_value: orderValue,
            skus_in_order: skus,
            turns_to_conversion: turnCount,
        });
    },

    // ── Quality signals ─────────────────────────────────────────────
    hallucination: (type: "phantom_sku" | "wrong_size" | "wrong_compatibility" | "wrong_price",
                    details: string) => {
        posthog.capture("grace_hallucination", { type, details });
    },

    escalationRequested: (reason: string) => {
        posthog.capture("grace_escalation_requested", { reason });
    },

    // ── Proactive triggers ──────────────────────────────────────────
    proactiveTriggerFired: (trigger: string, pageType: string, engaged: boolean) => {
        posthog.capture("grace_proactive_trigger", { trigger, page_type: pageType, engaged });
    },

    exitIntentDetected: (pageType: string, graceActive: boolean, cartValue: number) => {
        posthog.capture("exit_intent_detected", {
            page_type: pageType,
            grace_active: graceActive,
            cart_value: cartValue,
        });
    },

    cartAbandoned: (cartValue: number, itemCount: number, graceEngaged: boolean) => {
        posthog.capture("cart_abandonment", {
            cart_value: cartValue,
            item_count: itemCount,
            grace_engaged: graceEngaged,
        });
    },
};

// ── Helpers (read from DOM/context) ──────────────────────────────
function getPageType(): string {
    const path = window.location.pathname;
    if (path === "/") return "home";
    if (path.startsWith("/catalog")) return "catalog";
    if (path.startsWith("/products/")) return "pdp";
    if (path.startsWith("/cart")) return "cart";
    return "other";
}

function getCurrentSku(): string | undefined {
    // Read from page data attribute or Grace context
    return document.querySelector("[data-grace-sku]")?.getAttribute("data-grace-sku") ?? undefined;
}

function getCartTotal(): number {
    // Read from CartProvider context or localStorage
    return 0; // Implementation depends on CartProvider access pattern
}

function getCustomerTier(): string {
    return "anonymous"; // Read from Clerk session
}
```

### 0.4 PostHog Funnels to Define (Day 1)

| Funnel | Steps |
|--------|-------|
| **Product Discovery** | Homepage → Catalog → Product Page → Add to Cart → Purchase |
| **Grace-Assisted Conversion** | Grace Session Start → Product Recommended → Product Viewed → Cart Add → Purchase |
| **Checkout** | Cart Viewed → Checkout Started → Shipping → Payment → Order Complete |
| **Grace Recovery** | Exit Intent → Proactive Trigger → Grace Engaged → Cart Recovered |
| **Grace Abandonment** | Grace Session Start → N turns → Session Ended (no conversion) |

---

## Phase 1 — Proactive Grace (Weeks 2-3)

### Why This Is the Highest-Leverage Change

Industry data is unambiguous:
- **Proactive AI reaches 45% of visitors** vs. 5% for passive chat (Alhena, 2025)
- **4x conversion lift**: AI-assisted shoppers convert at 12.3% vs. 3.1% unassisted (Rep AI, 2025)
- **42% reduction in cart abandonment** with real-time AI intervention
- **35% cart recovery rate** with proactive triggers vs. 10% for email alone

Grace already has the intelligence. She just needs to start talking first.

### 1.1 Behavioral Trigger System

Create `src/hooks/useGraceProactiveTriggers.ts`:

```typescript
"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useGrace } from "@/components/GraceContext";
import { graceAnalytics } from "@/lib/analytics/graceEvents";

interface TriggerConfig {
    name: string;
    enabled: boolean;
    /** Seconds before trigger fires */
    threshold: number;
    /** Pages where this trigger is active */
    pages: Array<"home" | "catalog" | "pdp" | "cart" | "checkout" | "any">;
    /** Message Grace sends when triggered */
    graceOpener: (context: { productName?: string; cartValue?: number }) => string;
}

const TRIGGERS: TriggerConfig[] = [
    {
        name: "product_dwell",
        enabled: true,
        threshold: 60,  // 60 seconds on a product page
        pages: ["pdp"],
        graceOpener: ({ productName }) =>
            `I noticed you've been looking at the ${productName ?? "this bottle"} for a while. ` +
            `Would you like to see which closures pair with it, or compare it to a similar option?`,
    },
    {
        name: "catalog_filter_fatigue",
        enabled: true,
        threshold: 90,  // 90 seconds browsing catalog
        pages: ["catalog"],
        graceOpener: () =>
            `Finding the right bottle can take some navigation. Tell me what you're creating — ` +
            `fragrance, skincare, essential oils? I can narrow this down to two or three options.`,
    },
    {
        name: "cart_idle",
        enabled: true,
        threshold: 45,  // 45 seconds on cart without proceeding
        pages: ["cart"],
        graceOpener: ({ cartValue }) =>
            `Before you check out${cartValue ? ` ($${cartValue.toFixed(2)})` : ""} — ` +
            `shall I run a quick compatibility check on everything in your cart?`,
    },
    {
        name: "checkout_hesitation",
        enabled: true,
        threshold: 30,  // 30 seconds idle at checkout
        pages: ["checkout"],
        graceOpener: () =>
            `Shipping or payment questions often come up at this stage. ` +
            `Happy to help with anything giving you pause.`,
    },
    {
        name: "homepage_idle",
        enabled: true,
        threshold: 20,  // 20 seconds on homepage without navigating
        pages: ["home"],
        graceOpener: () =>
            `Welcome to Best Bottles! Are you looking for bottles for fragrance, ` +
            `skincare, essential oils, or something else? I can help you find the perfect fit.`,
    },
];

export function useGraceProactiveTriggers() {
    const pathname = usePathname();
    const { panelMode, openPanel, send, pageContext } = useGrace();
    const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggeredThisPageRef = useRef(false);

    // Reset on page change
    useEffect(() => {
        triggeredThisPageRef.current = false;
        if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);

        // Don't trigger if Grace is already open
        if (panelMode !== "closed") return;

        const pageType = inferPageType(pathname);
        const applicableTriggers = TRIGGERS.filter(
            (t) => t.enabled && (t.pages.includes(pageType) || t.pages.includes("any"))
        );

        if (applicableTriggers.length === 0) return;

        // Use the first applicable trigger (priority by array order)
        const trigger = applicableTriggers[0];

        dwellTimerRef.current = setTimeout(() => {
            if (triggeredThisPageRef.current) return;
            if (panelMode !== "closed") return; // Grace opened by user in the meantime

            triggeredThisPageRef.current = true;

            const context = {
                productName: pageContext?.currentProduct?.name,
                cartValue: pageContext?.cartTotal,
            };

            // Fire analytics event
            graceAnalytics.proactiveTriggerFired(trigger.name, pageType, true);

            // Open Grace with the proactive message
            openPanel();
            // Send as a system-initiated message (not a user message)
            send(trigger.graceOpener(context), false);
        }, trigger.threshold * 1000);

        return () => {
            if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
        };
    }, [pathname, panelMode, openPanel, send, pageContext]);
}

function inferPageType(pathname: string): string {
    if (pathname === "/") return "home";
    if (pathname.startsWith("/catalog")) return "catalog";
    if (pathname.startsWith("/products/")) return "pdp";
    if (pathname.startsWith("/cart")) return "cart";
    if (pathname.startsWith("/checkout")) return "checkout";
    return "other";
}
```

### 1.2 Exit Intent Detection

Add to `src/hooks/useExitIntent.ts`:

```typescript
"use client";
import { useEffect, useRef, useCallback } from "react";

interface UseExitIntentOptions {
    /** Pixels from top of viewport to trigger */
    threshold?: number;
    /** Cooldown in ms between triggers */
    cooldown?: number;
    /** Only trigger once per session? */
    oncePerSession?: boolean;
    onExitIntent: () => void;
}

export function useExitIntent({
    threshold = 10,
    cooldown = 30000,
    oncePerSession = true,
    onExitIntent,
}: UseExitIntentOptions) {
    const lastTriggerRef = useRef(0);
    const triggeredRef = useRef(false);

    const handleMouseLeave = useCallback(
        (e: MouseEvent) => {
            // Only trigger when mouse leaves through the TOP of the viewport
            if (e.clientY > threshold) return;

            // Cooldown check
            if (Date.now() - lastTriggerRef.current < cooldown) return;

            // Once-per-session check
            if (oncePerSession && triggeredRef.current) return;

            lastTriggerRef.current = Date.now();
            triggeredRef.current = true;
            onExitIntent();
        },
        [threshold, cooldown, oncePerSession, onExitIntent]
    );

    useEffect(() => {
        document.addEventListener("mouseleave", handleMouseLeave);
        return () => document.removeEventListener("mouseleave", handleMouseLeave);
    }, [handleMouseLeave]);
}
```

### 1.3 Returning Visitor Detection

```typescript
// src/hooks/useReturningVisitor.ts
"use client";
import { useEffect, useState } from "react";

interface VisitorProfile {
    isReturning: boolean;
    visitCount: number;
    lastVisitDate: string | null;
    /** Products viewed in previous sessions */
    previousProducts: string[];
}

export function useReturningVisitor(): VisitorProfile {
    const [profile, setProfile] = useState<VisitorProfile>({
        isReturning: false,
        visitCount: 1,
        lastVisitDate: null,
        previousProducts: [],
    });

    useEffect(() => {
        const stored = localStorage.getItem("bb_visitor");
        const now = new Date().toISOString();

        if (stored) {
            const data = JSON.parse(stored) as VisitorProfile & { lastVisitDate: string };
            const updated: VisitorProfile = {
                isReturning: true,
                visitCount: data.visitCount + 1,
                lastVisitDate: data.lastVisitDate,
                previousProducts: data.previousProducts ?? [],
            };
            setProfile(updated);
            localStorage.setItem("bb_visitor", JSON.stringify({ ...updated, lastVisitDate: now }));
        } else {
            localStorage.setItem("bb_visitor", JSON.stringify({
                isReturning: false,
                visitCount: 1,
                lastVisitDate: now,
                previousProducts: [],
            }));
        }
    }, []);

    return profile;
}

/** Call this when a product is viewed to build up the profile */
export function recordProductView(productName: string) {
    const stored = localStorage.getItem("bb_visitor");
    if (!stored) return;
    const data = JSON.parse(stored);
    const products: string[] = data.previousProducts ?? [];
    if (!products.includes(productName)) {
        products.push(productName);
        if (products.length > 20) products.shift(); // cap at 20
        data.previousProducts = products;
        localStorage.setItem("bb_visitor", JSON.stringify(data));
    }
}
```

---

## Phase 2 — Cross-Session Customer Memory (Weeks 4-5)

### Why This Matters for B2B

B2B buyers don't purchase in one session. They research, get quotes, discuss internally, come back. If Grace forgets them every time, she's not a concierge — she's a search box.

### 2.1 Convex Schema Additions

Add to `convex/schema.ts`:

```typescript
// Customer profiles — persistent cross-session memory for B2B accounts
customerProfiles: defineTable({
    /** Clerk user ID (for authenticated B2B users) */
    clerkUserId: v.optional(v.string()),
    /** Anonymous visitor fingerprint (localStorage-based) */
    visitorId: v.optional(v.string()),
    companyName: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    /** B2B tier: 1-5 based on order volume */
    tier: v.optional(v.string()),
    /** Natural language summary of last conversation with Grace */
    lastSessionSummary: v.optional(v.string()),
    /** Bottle families they've shown interest in */
    preferredFamilies: v.optional(v.array(v.string())),
    /** SKUs they've viewed multiple times */
    frequentlyViewedSkus: v.optional(v.array(v.string())),
    /** Their typical order size tier */
    typicalOrderTier: v.optional(v.string()),
    /** Total number of Grace conversations */
    totalConversations: v.optional(v.number()),
    /** Last interaction timestamp */
    lastInteraction: v.optional(v.number()),
    /** CRM-style notes from Grace sessions */
    notes: v.optional(v.string()),
})
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_visitorId", ["visitorId"]),

// Conversation-to-conversion correlation
conversationOutcomes: defineTable({
    conversationId: v.id("conversations"),
    /** SKUs Grace recommended during the conversation */
    recommendedSkus: v.optional(v.array(v.string())),
    /** SKUs the customer actually viewed after Grace's recommendation */
    viewedAfterRecommendation: v.optional(v.array(v.string())),
    /** SKUs added to cart during or after the conversation */
    addedToCart: v.optional(v.array(v.string())),
    /** Whether a purchase occurred within 24 hours */
    conversionOccurred: v.optional(v.boolean()),
    /** Order value if converted */
    orderValue: v.optional(v.number()),
    /** Turn count in the conversation */
    turnCount: v.optional(v.number()),
    /** What triggered the conversation */
    trigger: v.optional(v.string()),
    /** Timestamp */
    createdAt: v.number(),
})
    .index("by_conversationId", ["conversationId"])
    .index("by_conversion", ["conversionOccurred"]),
```

### 2.2 Session Summary Generation

After each Grace conversation ends, generate and store a summary:

```typescript
// convex/customerMemory.ts
import { mutation, action } from "./_generated/server";
import { v } from "convex/values";

export const saveSessionSummary = action({
    args: {
        visitorId: v.optional(v.string()),
        clerkUserId: v.optional(v.string()),
        conversationMessages: v.array(v.object({
            role: v.string(),
            content: v.string(),
        })),
        recommendedSkus: v.array(v.string()),
        cartSkus: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        // Generate a natural-language summary using Claude
        const conversationText = args.conversationMessages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n");

        const summary = await generateSummary(conversationText);

        // Upsert the customer profile
        const existing = args.clerkUserId
            ? await ctx.runQuery(/* find by clerkUserId */)
            : args.visitorId
                ? await ctx.runQuery(/* find by visitorId */)
                : null;

        if (existing) {
            await ctx.runMutation(/* patch existing profile with new summary */);
        } else {
            await ctx.runMutation(/* create new profile */);
        }
    },
});
```

### 2.3 Returning Customer Grace Greeting

When a recognized customer returns, Grace's session context should include:

```
=== RETURNING CUSTOMER ===
Name: Sarah Chen (Lumière Fragrances)
Tier: B2B-3
Last visit: 3 days ago
Last session: "Sarah was exploring the Elegant line for a new EDT launch. She compared the 15ml and 30ml frosted options. Interested in gold caps with fine mist sprayers. Didn't add to cart — said she needed to check with her team."
Preferred families: Elegant, Diva
Frequently viewed: Elegant 15ml Frosted, Elegant 30ml Frosted, Gold Fine Mist Sprayer

GRACE INSTRUCTION: Welcome Sarah back by name. Reference her EDT project. Ask if her team made a decision on the size. Don't re-introduce the products — she's already familiar.
=== END RETURNING CUSTOMER ===
```

---

## Phase 3 — Self-Improvement Training Loop (Weeks 6-8)

### 3.1 The Weekly Cycle

```
MONDAY      → Automated: Pull last week's conversations from Convex
TUESDAY     → Automated: Run eval suite (phantom SKU check, compatibility check,
               size accuracy, family classification)
WEDNESDAY   → Automated: Generate correction patches for system prompt + knowledge base
THURSDAY    → Human checkpoint: Jordan reviews corrections, approves or edits
FRIDAY      → Automated: Deploy approved corrections to knowledge base
```

### 3.2 Evaluation Categories

| Category | Test | Pass Criteria |
|----------|------|--------------|
| **SKU Existence** | Every SKU Grace mentioned → verify in products table | 100% must exist |
| **Compatibility** | Every cap + bottle pairing → verify thread size match | 100% must be valid |
| **Size Accuracy** | Every capacity claim → verify in products table | Must match exactly |
| **Family Classification** | "Frosted" attributed to family vs. finish | Must be finish, not family |
| **Price Accuracy** | Every price quoted → verify against current tier | Must be within 5% |
| **Hallucination Rate** | Count of fabricated claims per 100 conversations | Target: < 2% |

### 3.3 Eval Script (Already Partially Exists)

Your `package.json` has `eval:grace`, `eval:grace:verbose`, and `eval:grace:loop` scripts. These need to be:
1. Connected to the real conversation log (pull from Convex `messages` table)
2. Automated to run on a cron schedule (GitHub Actions or Vercel Cron)
3. Output structured results to a `trainingRuns` Convex table

### 3.4 Quality KPIs

| Metric | Baseline (Today) | Month-1 Target | Month-3 Target |
|--------|------------------|----------------|----------------|
| Containment rate | Unknown | 65% | 75% |
| Response accuracy | ~85% (estimated) | 92% | 95%+ |
| Hallucination rate | ~8% (estimated) | 4% | < 2% |
| Task completion rate | Unknown | 70% | 80%+ |
| Avg. turns to resolution | Unknown | 6 | 4 |
| Cart recovery (proactive) | 0% (not built) | 15% | 25%+ |

---

## Phase 4 — Abandonment Recovery + B2B Portal Grace (Weeks 9-12)

### 4.1 Three-Tier Abandonment Recovery

**Tier 1 — Real-Time (Grace Proactive, already in Phase 1)**
Grace detects cart idle (45s) or exit intent and intervenes:
- "Before you go — shall I run a compatibility check on your cart?"
- "I noticed you've been going back and forth on the Elegant line. Want me to compare the two side by side?"

**Tier 2 — Exit-Intent Intervention**
When mouse leaves viewport toward close button:
- Grace pops up with a non-pushy offer: save the quote, email the cart, or talk to a human
- "I can email you a summary of what we discussed so you can share it with your team."
- Never offer discounts. Best Bottles doesn't discount — offer value (compatibility checks, spec sheets, sample requests).

**Tier 3 — Post-Session Email (Klaviyo Integration)**

```
Hour 1:  "Here's a summary of the bottles we discussed today"
         Include: product images, specs, pricing tiers
         CTA: "Continue where you left off" → deep link back to cart/product

Hour 24: "Have any questions about the [Family] line?"
         Include: Grace's top recommendation from the conversation
         CTA: "Chat with Grace" → opens Grace panel on the site

Hour 72: "Your cart is still waiting"
         Include: cart contents, compatible accessories suggestion
         CTA: "Complete your order" → checkout page
```

**Klaviyo-to-Grace Handoff**: When a customer clicks through from an abandonment email and returns to the site, Grace should know. Set a URL parameter (`?from=klaviyo&campaign=abandon_1h`) and inject it into Grace's context:

```
GRACE INSTRUCTION: Customer returned from an abandonment email. They were looking at
[products from email]. Welcome them back and ask if they had any questions about
what they saw. Don't be pushy — they came back on their own, which is a good sign.
```

### 4.2 B2B Portal Grace Upgrade

Current state: `GraceWorkspaceChat.tsx` is a basic text-only chat. Needs:

1. **Wire to ElevenLabs voice** (same as public Grace, different system prompt context)
2. **Add all client tools** (searchCatalog, getBottleComponents, proposeCartAdd, etc.)
3. **Inject project context** — when a B2B customer has an active project, Grace should know:
   - Project name, target launch date
   - Products already selected
   - Quantities discussed
   - Pricing tier locked in
4. **Reorder intelligence** — "Your last order of 576 Elegant 15ml was 6 weeks ago. Running low?"

---

## Phase 5 — Bleeding Edge (Months 4-12+)

### 5.1 Tier 1 — Deploy Now (Months 4-6)

**Conversational RFQ Form-Filling**
Grace conducts a natural dialogue that extracts every spec field for a custom quote request:
- "What are you creating?" → product type
- "What size range are you thinking?" → capacity
- "How many units for your first run?" → quantity
- "What's your target launch date?" → timeline
Then auto-submits the structured RFQ via `submitForm`. Already partially built — needs the structured extraction logic.

**Predictive Reordering**
For authenticated B2B accounts with order history:
- Track average reorder interval per customer
- When approaching the predicted reorder date, Grace proactively suggests: "Based on your order history, you typically reorder Cylinder 30ml Clear every 8 weeks. Want me to prepare that order?"
- Requires: Convex `orderHistory` table linked to `customerProfiles`

**Sentiment-Aware Voice Adaptation**
ElevenLabs supports real-time voice parameter adjustment. When Grace detects frustration signals (short responses, repeated questions, negative keywords), she should:
- Slow her pacing (reduce `speed` parameter)
- Increase warmth (adjust `stability` up slightly)
- Acknowledge the frustration: "I understand this can be complex. Let me simplify..."

### 5.2 Tier 2 — 6-12 Months

**Visual AI Integration**
Customer uploads a photo of a competitor's bottle or a reference image. Grace identifies the closest match in the catalog:
- "That looks like our Elegant family in the 30ml size with a gold cap. Want me to pull up the exact options?"
- Technology: Claude's vision API or Google's Gemini vision
- Requires: Product image embeddings + similarity search

**Voice Checkout**
Grace walks the customer through checkout entirely by voice:
- "I have 12 Cylinder 30ml Clear with gold fine mist sprayers. That's $X at the 12-piece price. Shall I place this order?"
- Requires: Shopify Storefront API checkout creation + order confirmation flow
- Security: Use Clerk auth for identity verification; card-on-file for B2B accounts

**Conversational Negotiation**
For B2B accounts placing large orders, Grace has authority to offer tier pricing transparently:
- "At 576 units, your price drops from $1.20 to $0.85 per piece. That's a 29% savings."
- Never "negotiate" — present the tier structure as a fact, not a haggle

### 5.3 Tier 3 — 12-24 Months (Strategic)

**Agent-to-Agent Discovery (MCP + A2A)**

This is the highest-leverage long-term play. The industry is moving fast:
- MCP (Anthropic, now Linux Foundation): 97M+ monthly SDK downloads. Grace already has MCP-compatible tools.
- A2A (Google, now Linux Foundation): 50+ technology partners including SAP, Salesforce, ServiceNow.
- Tyson Foods + Gordon Food Service are already piloting A2A for real-time supply chain data sharing.
- Gartner: 90% of B2B purchases will involve AI agents by 2028.

**What to build**: An A2A Agent Card — a JSON manifest that describes Grace's capabilities:

```json
{
    "name": "Grace — Best Bottles AI Concierge",
    "description": "AI packaging consultant for glass bottles, closures, and accessories. Serves fragrance, skincare, and essential oil brands.",
    "url": "https://bestbottles.com/.well-known/agent.json",
    "capabilities": [
        "product_catalog_search",
        "compatibility_check",
        "pricing_tiers",
        "quote_request",
        "order_placement"
    ],
    "authentication": "oauth2",
    "protocols": ["a2a/1.0", "mcp/1.0"]
}
```

When a customer's procurement AI agent searches for "glass bottles for fragrance, 15ml, spray closure" — Grace's agent card makes Best Bottles discoverable. The procurement agent queries Grace's tools directly, gets pricing, checks compatibility, and proposes an order — all without a human visiting the website.

**Window**: 12-18 months before competitors recognize this opportunity. Best Bottles' existing MCP tool architecture gives you a significant head start.

**Multilingual Grace**
ElevenLabs supports multilingual voice. Spanish would open a meaningful customer segment (fragrance and skincare brands in Latin America and US Hispanic markets). Configuration is straightforward — add a language detection step and a Spanish system prompt variant.

---

## Brand Brain Session — Gated Dependency

> **This must happen before Phase 2 launches. It is the single most important knowledge capture event for Grace.**

### The 10 Critical Questions for Abbas

| # | Question | What It Unlocks |
|---|----------|----------------|
| 1 | When a new customer calls about launching a perfume line, what's your first question? What's your mental decision tree? | Grace's qualification flow |
| 2 | How do you recommend bottles for different fragrance concentrations (EDT vs EDP vs parfum)? | Product-application matching intelligence |
| 3 | What are the most common mistakes new brands make with packaging? | Proactive warning system |
| 4 | How do you determine budget without directly asking about price? | Conversational pricing intelligence |
| 5 | How do you handle the customer who wants luxury look at lowest price? | Objection handling for price-sensitive leads |
| 6 | What compatibility issues have you seen that customers don't anticipate? | Proactive compatibility warnings |
| 7 | How do you upsell from a basic order to a premium package? | Revenue optimization playbooks |
| 8 | What makes you recommend one family over another for the same use case? | Decision tree for product recommendation |
| 9 | What "hidden" product benefits do you share that aren't on the product page? | Product intelligence that only exists in Abbas's head |
| 10 | How do you turn first orders into ongoing accounts? | Relationship-building patterns for B2B retention |

**Format**: 60-90 minute recorded session. Transcribe and ingest into `graceKnowledge` table as structured knowledge entries.

---

## Success Metrics & KPI Dashboard

### Primary Business Metrics

| Metric | Current | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|---------|
| Grace sessions / week | ~50 (estimated) | 150 | 400 | 800 |
| Proactive trigger engagement rate | 0% (not built) | 20% | 35% | 45% |
| Grace-assisted conversion rate | Unknown | 8% | 12% | 15%+ |
| Cart recovery rate (proactive) | 0% (not built) | 15% | 25% | 35% |
| Average order value (Grace-assisted) | Unknown | +10% vs baseline | +20% | +25% |
| Cost per Grace conversation | Unknown | < $0.50 | < $0.30 | < $0.20 |

### Grace Quality Metrics

| Metric | Current | Month 1 | Month 3 |
|--------|---------|---------|---------|
| Response accuracy | ~85% | 92% | 95%+ |
| Hallucination rate | ~8% | 4% | < 2% |
| Containment rate (no human needed) | Unknown | 65% | 75%+ |
| Task completion rate | Unknown | 70% | 80%+ |
| Voice latency (time to first audio) | ~400ms | < 400ms | < 350ms |
| Tool call success rate | Unknown | 90% | 95%+ |

### Behavioral Analytics Metrics

| Metric | Current | After PostHog |
|--------|---------|---------------|
| Heatmap coverage | 0 pages | All key pages |
| Session recordings / week | 0 | 500+ (free tier) |
| Funnel visibility | None | 5 core funnels defined |
| Exit intent detection | None | Active on all pages |
| Grace-to-purchase correlation | Not tracked | Tracked per conversation |

---

## Owner Assignments

| Area | Owner | Cadence |
|------|-------|---------|
| PostHog setup + event instrumentation | Ziah (dev) | Week 1 |
| Proactive trigger implementation | Ziah (dev) | Weeks 2-3 |
| ElevenLabs tool config updates | Jordan + Ziah | Week 1 (paste JSONs) |
| Brand Brain Session with Abbas | Jordan (facilitator) | Before Phase 2 |
| Weekly eval review + corrections | Jordan | Every Thursday |
| Knowledge base training patches | Jordan + Grace eval loop | Weekly |
| Convex schema additions | Ziah (dev) | Weeks 4-5 |
| Klaviyo integration | Ziah (dev) | Weeks 9-10 |
| B2B portal Grace upgrade | Ziah (dev) | Weeks 11-12 |
| Monthly executive summary | Jordan → Abbas | 1st Monday monthly |
| A2A agent card | Ziah (dev) | Month 4+ |

---

## Principles & Guardrails

1. **Grace never lies.** If she doesn't know, she says so. If a product doesn't exist, she says so. Phantom SKU generation is the #1 trust destroyer.

2. **Grace never pressures.** She is a consultant, not a salesperson. She suggests, she educates, she recommends — she never pushes. No "limited time offer" tactics. No artificial urgency.

3. **Grace never discounts.** Best Bottles doesn't discount. Grace presents tier pricing as a fact of volume economics, never as a negotiation. "At 576 units, your price is $0.85" — not "I can get you a deal."

4. **Grace knows when to hand off.** Complex custom orders, compliance questions, shipping logistics for large orders, and unhappy customers all get escalated to a human. Grace's job is to make the first 80% effortless — the last 20% is human territory.

5. **Grace represents the family.** She carries the warmth of a family business, the depth of Nemat International's heritage, and the instinct of a world-class packaging consultant. She is the digital Abbas.

6. **Data quality is non-negotiable.** Every sprint that improves Grace's data improves every conversation she has. Database reconciliation is not a side project — it is the foundation.

7. **Measure everything.** No feature ships without analytics events. No change is made without before/after data. PostHog is the source of truth.

---

## Appendix A: Research Sources

### Proactive AI Engagement
- Alhena (2025): Proactive AI reaches 45% of visitors vs. 5% passive — [alhena.ai/blog/proactive-ai-engagement-gap-ecommerce](https://alhena.ai/blog/proactive-ai-engagement-gap-ecommerce/)
- Rep AI (2025): AI-engaged shoppers convert at 12.3% vs. 3.1% — [hellorep.ai/blog/the-future-of-ai-in-ecommerce-40-statistics](https://www.hellorep.ai/blog/the-future-of-ai-in-ecommerce-40-statistics-on-conversational-ai-agents-for-2025)
- Quidget (2025): 7 behavioral triggers — [quidget.ai/blog/ai-automation/7-behavioral-triggers](https://quidget.ai/blog/ai-automation/7-behavioral-triggers-your-ecommerce-chatbot-should-watch-and-why/)

### Cart Recovery
- Digital Applied (2026): AI cart recovery guide — [digitalapplied.com/blog/ai-cart-abandonment-recovery](https://www.digitalapplied.com/blog/ai-cart-abandonment-recovery-ecommerce-guide-2026)
- Agentive AIQ: 35% recovery rates — [agentiveaiq.com/blog/abandoned-cart-emails](https://agentiveaiq.com/blog/abandoned-cart-emails-why-36-conversion-isnt-enough)
- Ringly.io (2026): Cart abandonment statistics — [ringly.io/blog/ecommerce-cart-abandonment-statistics](https://www.ringly.io/blog/ecommerce-cart-abandonment-statistics-2026)

### Analytics
- PostHog LLM Analytics — [posthog.com/llm-analytics](https://posthog.com/llm-analytics)
- PostHog Next.js integration — [posthog.com/docs/libraries/next-js](https://posthog.com/docs/libraries/next-js)
- PostHog session replay comparison — [posthog.com/blog/best-session-replay-tools](https://posthog.com/blog/best-session-replay-tools)

### Voice AI
- ElevenLabs latency optimization — [elevenlabs.io/blog/how-do-you-optimize-latency-for-conversational-ai](https://elevenlabs.io/blog/how-do-you-optimize-latency-for-conversational-ai)
- ElevenLabs conversation flow — [elevenlabs.io/docs/eleven-agents/customization/conversation-flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow)
- ElevenLabs 75ms Flash model — [deeplearning.ai/the-batch/elevenlabs-drops-latency-to-75-milliseconds](https://www.deeplearning.ai/the-batch/elevenlabs-drops-latency-to-75-milliseconds/)

### Agent-to-Agent Protocols
- MCP vs A2A complete guide — [dev.to/pockit_tools/mcp-vs-a2a-the-complete-guide-to-ai-agent-protocols-in-2026](https://dev.to/pockit_tools/mcp-vs-a2a-the-complete-guide-to-ai-agent-protocols-in-2026-30li)
- Google A2A codelab — [codelabs.developers.google.com/intro-a2a-purchasing-concierge](https://codelabs.developers.google.com/intro-a2a-purchasing-concierge)
- IBM A2A explainer — [ibm.com/think/topics/agent2agent-protocol](https://www.ibm.com/think/topics/agent2agent-protocol)

### Conversational AI Metrics
- DialZara: 7 evaluation metrics — [dialzara.com/blog/5-metrics-for-evaluating-conversational-ai](https://dialzara.com/blog/5-metrics-for-evaluating-conversational-ai)
- Alhena: Containment vs deflection benchmarks — [alhena.ai/blog/what-is-ai-containment-vs-deflection-rate](https://alhena.ai/blog/what-is-ai-containment-vs-deflection-rate-2025-benchmarks/)
- Tidio: Chatbot analytics guide — [tidio.com/blog/chatbot-analytics](https://www.tidio.com/blog/chatbot-analytics/)
