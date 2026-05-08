# Best Bottles — SOW Launch Plan & Status Update

**Date:** 2026-05-04
**Author:** Jordan Richter (Asala Studio)
**Audience:** Abbas + Best Bottles stakeholders
**Source of truth (Linear):** [Best Bottles Site Launch project](https://linear.app/asala-dev/project/best-bottles-site-launch-94681ef19b9e)

---

## TL;DR

We are aligning the project back to the **original Jan 2026 SOW** and shipping a clean v1 launch on **2026-05-25**. Substantial work has been built that goes beyond the SOW (notably a B2B portal, a Madison AI hero-image pipeline, and a Grace v3 workspace). Those are real assets but they are **not blocking launch** and have been moved to a Phase 2 addendum.

The two SOW deliverables that are **completely missing from production** today are tax-exempt automation (TaxJar/Avalara) and FedEx weight-based shipping integration. Both are now tickets in M1 with launch-critical priority.

A clean SOW-only burndown of remaining launch-blocking work: **~25 issues** spread across M1 (commerce backbone), M3 (Empire visuals), M4 (Grace MVP polish + expert sessions), and M6 (deploy + handoff).

---

## Where the Project Stands vs. the Original SOW

The SOW described **four pillars × twelve deliverables**. Here is the honest scoreboard.

| Pillar | Deliverable | Status |
|---|---|---|
| **I. Brand Intelligence** | Brand Brain knowledge system | ✅ Done — `convex/grace.ts`, `graceKnowledge` constitution v3.0 |
| | Product intelligence capture (2,000+ variants) | ✅ Done — exceeded (2,354 SKUs, 258 groups, 63 fitments) |
| | Expert knowledge sessions with Abbas + Abduljalil | ❌ **Not started** — knowledge currently reconstructed from data, not from recordings ([BB-153](https://linear.app/asala-dev/issue/BB-153)) |
| | Grace MVP (compatibility, recommendations, MOQ guidance) | ✅ Done — far exceeded (Grace v3 with workspace, voice, 22-tool agent) |
| **II. Technical Foundation** | Headless architecture + Sanity CMS | ✅ Done |
| | Core pages (Home, PLP, PDP) | ✅ Done — plus blog, about, contact, request-quote, request-sample, collections |
| | Code ownership transfer + Sanity/API training | ⚠️ **Partial** — handoff docs exist but no formal training ([BB-154](https://linear.app/asala-dev/issue/BB-154)) |
| **III. E-commerce Experience** | Paper Doll Product Builder | ⚠️ **~15%** — CYL-9ML + CYL-5ML LIVE (58 components in Sanity); Empire/Boston/Elegant/Sleek/Slim/Tulip/Diamond NOT done |
| | Image preparation + alignment for initial catalog | ⚠️ **Empire only, partial** — Madison AI hero pipeline built, batch incomplete |
| **IV. B2B Operations** | Tax-exempt automation (TaxJar/Avalara) | ❌ **Not started** ([BB-151](https://linear.app/asala-dev/issue/BB-151)) |
| | FedEx weight-based shipping (Shopify Plus) | ❌ **Not started** ([BB-152](https://linear.app/asala-dev/issue/BB-152)) |
| | Shopify Plus checkout sync | ⚠️ **~30%** — webhook route + Convex shopifySync exist; checkout flow + product sync NOT wired ([BB-1](https://linear.app/asala-dev/issue/BB-1), [BB-2](https://linear.app/asala-dev/issue/BB-2), [BB-3](https://linear.app/asala-dev/issue/BB-3)) |

**Score:** 4/12 fully done · 4/12 partial · 4/12 not started.

---

## What Was Built Beyond the SOW (Scope Creep)

These are real assets the team produced. They are not in the SOW and are not blocking launch. They are tracked in Linear with the `scope-creep` and `phase-2` labels.

1. **Customer B2B Portal** (8 routes: Dashboard, Orders, Drafts, Documents Vault, Tracking, Account, Tools, Grace Workspace) — currently shells. The SOW mentions "B2B operations" but defines that as tax + shipping, not a self-service portal. Estimated to finish: ~3–4 weeks of dev (Phase 2 SOW).
2. **Madison Studio AI hero-image pipeline** — gpt-image-2 driven, Convex export, prompt assembler, audit gate, per-applicator preset routing. Capable of producing brand-grade hero images at scale. The SOW asks for "image preparation and alignment", not an AI generation factory.
3. **Grace v3 redesign** — workspace, drawer, 12 inline product patterns, GPT-5 text path, GPT-4o vision, ElevenLabs 22-tool config, anti-hallucination guardrail. The SOW says **MVP**.
4. **Clerk authentication + multi-tenant scoping** — required for a B2B portal but not the SOW.
5. **UX-AUDIT-driven polish backlog** (~40 items) — homepage placeholders, tap targets, breadcrumbs, search autocomplete, color dots on cards, etc. Real polish, but not SOW scope.
6. **Mixpanel analytics + provider-agnostic analytics layer** — not in SOW.

Why this matters: shipping all of this is what put us 4 weeks past the original SOW completion date. Going forward we will protect Phase 1 SOW scope and explicitly invoice Phase 2 separately.

---

## SOW Launch Plan — 2026-05-25 (Option A path)

| Milestone | Target | Scope | Linear |
|---|---|---|---|
| **M1 — Commerce Foundation** | 2026-05-15 | Shopify product sync, checkout permalink, webhooks, **TaxJar tax-exempt**, **FedEx shipping** | [Milestone](https://linear.app/asala-dev/project/best-bottles-site-launch-94681ef19b9e) |
| **M2 — PDP + Cart B2B** | 2026-05-22 | Quote CTA, 5-tier pricing, fitment carousel, capColor selectors, mobile sticky CTA, analytics events | |
| **M3 — Visual Completeness (Empire only)** | 2026-05-22 | Empire 50/100 paper-doll + Empire AI hero batch + BB-91/BB-92 prompt fixes + heroImageUrl fallback | |
| **M4 — Grace AI Completion (MVP only)** | 2026-05-22 | Page context injection (BB-36) + Abbas/Abduljalil knowledge sessions (BB-153) | |
| **M5 — B2B Portal Self-Service** | 2026-07-15 | **DEFERRED — Phase 2 SOW addendum** | |
| **M6 — SOW LAUNCH** | **2026-05-25** | Production deploy, domain, SSL, smoke test, code transfer, Sanity/API training, homepage placeholder cleanup | |

The Linear milestones now reflect this scope. There is no longer milestone duplication — the 6 em-dash duplicates are archived and 35 duplicate issues are closed as Duplicate-of the canonical issue.

---

## What Each Milestone Needs (Critical Path)

### M1 Commerce Foundation — 7 SOW-required launch-critical issues

1. [BB-71](https://linear.app/asala-dev/issue/BB-71) — Provision Shopify Custom App + API credentials *(blocker for everything below)*
2. [BB-1](https://linear.app/asala-dev/issue/BB-1) — Implement Shopify product/variant sync (~230 groups, 2,354 SKUs) *(in progress)*
3. [BB-2](https://linear.app/asala-dev/issue/BB-2) — Wire cart → Shopify checkout permalink
4. [BB-3](https://linear.app/asala-dev/issue/BB-3) — Shopify webhooks → Convex (price, inventory, orders)
5. [BB-5](https://linear.app/asala-dev/issue/BB-5) — Wire FitmentDrawer "Add" button to real cart (kill the alert demo stub)
6. [BB-151](https://linear.app/asala-dev/issue/BB-151) — **NEW** Integrate TaxJar/Avalara for tax-exempt automation
7. [BB-152](https://linear.app/asala-dev/issue/BB-152) — **NEW** Integrate FedEx weight-based shipping rates
8. [BB-10](https://linear.app/asala-dev/issue/BB-10) — End-to-end commerce smoke test

### M2 PDP + Cart B2B — 6 SOW-required issues

[BB-11](https://linear.app/asala-dev/issue/BB-11) Quote CTA · [BB-12](https://linear.app/asala-dev/issue/BB-12) 5-tier pricing · [BB-14](https://linear.app/asala-dev/issue/BB-14) FitmentCarousel · [BB-16](https://linear.app/asala-dev/issue/BB-16) sibling grouping · [BB-17](https://linear.app/asala-dev/issue/BB-17) capColor/capHeight selectors · [BB-19](https://linear.app/asala-dev/issue/BB-19) mobile sticky CTA · [BB-85](https://linear.app/asala-dev/issue/BB-85) FitmentCarousel on PDP

### M3 Visual Completeness — Empire-only critical path

1. [BB-91](https://linear.app/asala-dev/issue/BB-91) — Backfill trim color from `graceDescription` (replace heuristic)
2. [BB-92](https://linear.app/asala-dev/issue/BB-92) — Fix bulb-sprayer hose descriptors in Madison Studio
3. [BB-21](https://linear.app/asala-dev/issue/BB-21) — Export Empire 50/100 paper-doll components
4. [BB-22](https://linear.app/asala-dev/issue/BB-22) — Resolve Empire Madison naming collisions
5. [BB-28](https://linear.app/asala-dev/issue/BB-28) — Generate + QA Empire hero image batch
6. [BB-101](https://linear.app/asala-dev/issue/BB-101) — Catalog card heroImageUrl fallback

### M4 Grace AI Completion — 2 SOW-required active issues

1. [BB-36](https://linear.app/asala-dev/issue/BB-36) — Inject current page/product context into Grace prompts
2. [BB-153](https://linear.app/asala-dev/issue/BB-153) — **NEW** Capture Abbas + Abduljalil knowledge sessions (this completes the SOW Brand Brain deliverable)

### M6 SOW Launch — 9 launch-critical issues + 1 SOW-mandatory training

1. [BB-53](https://linear.app/asala-dev/issue/BB-53) — Replace homepage placeholders with launch-ready content
2. [BB-54](https://linear.app/asala-dev/issue/BB-54) — Fix mobile tap targets from UX audit
3. [BB-56](https://linear.app/asala-dev/issue/BB-56) — Generate sitemap and robots.txt
4. [BB-58](https://linear.app/asala-dev/issue/BB-58) — Add analytics + conversion tracking
5. [BB-61](https://linear.app/asala-dev/issue/BB-61) — Configure production domain + env vars
6. [BB-62](https://linear.app/asala-dev/issue/BB-62) — Run full launch smoke test checklist
7. [BB-66](https://linear.app/asala-dev/issue/BB-66) — Add error monitoring
8. [BB-68](https://linear.app/asala-dev/issue/BB-68) — Add smoke tests for cart/checkout/quote/portal
9. [BB-129](https://linear.app/asala-dev/issue/BB-129) — Breadcrumbs on catalog/blog/all interior pages
10. [BB-154](https://linear.app/asala-dev/issue/BB-154) — **NEW** Code ownership transfer + Sanity/API training session

**Total SOW launch-critical work: ~30 active tickets** (some Done already, e.g. BB-126/127/128/137/138/139/142/143/144).

---

## What We Need From Best Bottles (Blockers)

| # | Need | For | Impact if delayed |
|---|---|---|---|
| 1 | Confirm Shopify store URL + create Custom App + grant API token | [BB-71](https://linear.app/asala-dev/issue/BB-71) | Blocks all of M1 — without this, no checkout |
| 2 | Decide TaxJar vs Avalara + provide account credentials | [BB-151](https://linear.app/asala-dev/issue/BB-151) | Blocks tax-exempt automation |
| 3 | Verify Shopify Plus has FedEx Carrier Service configured + provide FedEx account # | [BB-152](https://linear.app/asala-dev/issue/BB-152) | Blocks shipping rates display |
| 4 | Schedule 3 × 60-min recorded sessions with Abbas (×2) and Abduljalil (×1) within next 7 days | [BB-153](https://linear.app/asala-dev/issue/BB-153) | Blocks SOW Brand Brain completion |
| 5 | Provide custom domain + DNS access + SSL preference | [BB-61](https://linear.app/asala-dev/issue/BB-61), [BB-134](https://linear.app/asala-dev/issue/BB-134) | Blocks production cutover |
| 6 | Decide go-live date confirmation (target 2026-05-25) | All of M6 | Allows team to lock the calendar |
| 7 | Confirm GA4 + Meta Pixel account access | [BB-58](https://linear.app/asala-dev/issue/BB-58) | Blocks analytics on launch |
| 8 | Decide payment processor in Shopify (already configured?) | [BB-71](https://linear.app/asala-dev/issue/BB-71) | Blocks checkout completion test |

---

## Phase 2 Addendum (Post-Launch SOW)

If Best Bottles wants to ship the customer portal, the additional families' paper-doll, and the Grace v3 expansions, we propose a separate Phase 2 SOW with its own scope, schedule, and invoice. Estimated scope:

| Phase 2 Scope | Estimated effort | Estimated cost |
|---|---|---|
| Customer Portal (Dashboard, Orders, Drafts, Documents, Account, Tracking, Tools, multi-tenant scoping) | 3–4 weeks | ~$15–18k |
| Paper-doll: Boston Round, Elegant, Sleek, Slim, Tulip, Diamond | 2–3 weeks | ~$10–12k |
| Grace v3 expansion (compareProducts, browsing history, displayShortlist UI, voice transcription overlay, account-aware Grace) | 1–2 weeks | ~$6–8k |
| AI hero batches: Cylinder/Boston/Elegant/Sleek/Slim/Tulip/Diamond (beyond Empire) | 1–2 weeks | ~$6–8k |
| **Total Phase 2** | **7–11 weeks** | **~$35–45k** |

These items live in Linear under M5 + various M3/M4 tickets, all tagged `phase-2` and (where they originated as scope creep) `scope-creep`.

---

## Linear Hygiene Done Today

To produce a clean burndown for Best Bottles, the following Linear cleanup was completed:

- **3 SOW-tracking labels created**: `sow-required` (green), `scope-creep` (orange), `phase-2` (purple)
- **4 missing SOW issues created**: BB-151 TaxJar, BB-152 FedEx, BB-153 Knowledge Sessions, BB-154 Code Transfer
- **35 duplicate issues consolidated**: Each em-dash duplicate (BB-72, BB-73, etc.) marked as `Duplicate` of the plain-name canonical (BB-1, BB-2, etc.)
- **41 unique em-dash issues migrated**: Moved from em-dash milestones to canonical plain-name milestones with `sow-required`, `scope-creep`, or `phase-2` labels
- **6 plain-name milestones updated**: Tightened scope, set 2026-05-25 SOW Launch target
- **6 em-dash milestones archived**: Renamed and target-dated 2027-12-31 with description noting they're superseded
- **All ~80 active issues labeled**: Every issue now has either `sow-required` or `phase-2`/`scope-creep` so the SOW board shows a clean launch burndown

The Linear project URL is the same: https://linear.app/asala-dev/project/best-bottles-site-launch-94681ef19b9e — use the `sow-required` label filter to see the SOW launch burndown only.

---

## Honest Risks

1. **3-week timeline is tight.** Even with phase-2 deferrals, M1 (commerce) is mostly greenfield work and requires Shopify access from BB. If credentials slip past Wednesday this week, the 2026-05-25 date moves.
2. **Empire visual deliverable is incomplete.** The SOW commits to "image preparation and alignment for initial catalog" — for launch we are scoping that to Empire only (the Madison testbed) and using the existing CYL-5/9ML paper doll for Cylinder. Other families will use placeholder/AI fallback heroes.
3. **TaxJar and FedEx are net-new integrations** that haven't been started. If BB has existing tax/shipping flows in Shopify Plus that already work, the integration may be lighter than estimated; if they're starting fresh, it's a real chunk of work.
4. **Knowledge sessions (BB-153) require Abbas + Abduljalil time.** Without these recordings, the SOW Brand Brain deliverable is technically incomplete. If we can't schedule them in the next 7 days, we either ship without and document it as a gap, or push the launch.
5. **Final invoice ($6,250) is gated on code ownership transfer + training (BB-154).** This is straightforward but requires BB to receive ownership of GitHub, Vercel, Convex, and Sanity projects, which may need their team's setup time.

---

## Recommendation

We've absorbed the cost of scope expansion to date, which is why we're 4 weeks past the original date. Going forward, the right move is:

1. **Lock in 2026-05-25 as the SOW launch date.** That gives 21 days for the work above.
2. **Get the BB blockers above resolved this week** (Shopify access, TaxJar/Avalara decision, FedEx confirmation, knowledge session scheduling, custom domain).
3. **Treat the portal, additional paper-doll families, and Grace v3 expansions as Phase 2** — separately scoped and invoiced. We can present a Phase 2 SOW for sign-off in parallel with finishing Phase 1.
4. **Issue invoices on schedule:** Phase 2 milestone ($6,250) is now due — Brand Brain + Grace MVP are done (with the BB-153 sessions as a known gap to close). Phase 3 milestone ($6,250) due at SOW Launch on 2026-05-25.

The team has built more than the SOW promised. We just need to land the airplane.
