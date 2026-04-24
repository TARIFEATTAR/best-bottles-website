# Empire Cut — End-to-End Demo Spec

**Goal:** ship one bottle family (Empire) that works flawlessly from "customer lands on site" to "order placed in Shopify," with Grace voice nailing every step. Use it as the reference implementation for the other 38 families.

**Why Empire:** 91 SKUs, 11 product groups, 2 sizes, 1 glass color, 6 applicator types, genuine two-tone visual variety (bulb color × collar color) on the AST/ASP variants. Empire today has **no hero images, no paper-doll composites, and no Shopify variant links** — so every gap in the stack surfaces the moment we push on it. Fixing Empire fixes the pattern.

**What stays catalog-wide (not scoped to Empire):** Grace voice-payload slim, `trimColor` backfill, agent-prompt RULE 5 patch. Those ship for everyone.

---

## Empire inventory (live)

All 11 groups share `family: "Empire"`, `color: "Clear"`, `neckThreadSize: "18-415"`. Source: Convex `productGroups` → `getGroupsByFamily("Empire")`.

| # | Slug | Size | Applicator | Variants | Hero | Paper-doll |
|---|---|---:|---|---:|:---:|:---:|
| 1 | `empire-50ml-clear-18-415-dropper` | 50 ml | Dropper | 3 | ❌ | ❌ |
| 2 | `empire-50ml-clear-18-415-lotionpump` | 50 ml | Lotion Pump | 8 | ❌ | ❌ |
| 3 | `empire-50ml-clear-18-415-perfumespray` | 50 ml | Perfume Spray Pump | 6 | ❌ | ❌ |
| 4 | `empire-50ml-clear-18-415-reducer` | 50 ml | Reducer | 12 | ❌ | ❌ |
| 5 | `empire-50ml-clear-18-415-antiquespray` | 50 ml | Vintage Bulb Sprayer | 9 | ❌ | ❌ |
| 6 | `empire-50ml-clear-18-415-antiquespray-tassel` | 50 ml | Vintage Bulb Sprayer with Tassel | 9 | ❌ | ❌ |
| 7 | `empire-100ml-clear-18-415-lotionpump` | 100 ml | Lotion Pump | 8 | ❌ | ❌ |
| 8 | `empire-100ml-clear-18-415-perfumespray` | 100 ml | Perfume Spray Pump | 6 | ❌ | ❌ |
| 9 | `empire-100ml-clear-18-415-reducer` | 100 ml | Reducer | 12 | ❌ | ❌ |
| 10 | `empire-100ml-clear-18-415-antiquespray` | 100 ml | Vintage Bulb Sprayer | 9 | ❌ | ❌ |
| 11 | `empire-100ml-clear-18-415-antiquespray-tassel` | 100 ml | Vintage Bulb Sprayer with Tassel | 9 | ❌ | ❌ |

**Note:** 50 ml has a Dropper SKU set; 100 ml doesn't. That's a deliberate product decision or a catalog gap — confirm with Abbas.

### Two-tone variant breakdown (AST/ASP only)

Group 6 (`empire-50ml-...-antiquespray-tassel`) — 9 variants, 9 distinct `capColor` (bulb/tassel), 3 distinct `trimColor` (collar):

- **Bulb colors:** Black, Gold, Ivory Gold, Ivory Silver, Lavender, Matte Silver, Pink, Red, White
- **Collar colors:** Matte Silver, Shiny Gold, Shiny Silver

This is the family's money shot. The PDP needs to clearly communicate the two-tone selection.

---

## The happy-path customer journey

### Scene 1 — Landing
Customer arrives at `bestbottles.company/` (or `bestbottles.com` once DNS points here).

- **Expected:** hero copy, value prop, Grace trigger strip visible on the right edge, clear path into the catalog.
- **Grace voice (optional trigger):** "Hi — I'm Grace, Best Bottles' packaging concierge. What are you bottling today?"
- **Success:** customer clicks into the catalog within 10 s of page load, or opens Grace.

### Scene 2 — Catalog browse
Customer clicks *Catalog* or Grace says *"Show me Empire bottles."*

- **Expected:** catalog grid with `aspect-[4/5]` tiles, each tile shows a real hero image, family + size + capacity, price. Empire family surfaces 11 tiles with filter controls (size, applicator).
- **Grace voice:** routes via `showProducts({ query: "Empire", family: "Empire" })` → catalog URL `/catalog?families=Empire&grace=1`. Handoff line: *"Taking you there now."*
- **Success:** customer can visually distinguish the 6 applicator types (dropper vs sprayer vs pump) on sight, even without reading the caption.

### Scene 3 — Product detail (PDP)
Customer clicks the 50 ml Empire Vintage Bulb Spray Bottle with Tassel tile.

- **Expected:** PDP loads `/products/empire-50ml-clear-18-415-antiquespray-tassel` with:
  - Primary image: paper-doll composite at `aspect-[4/5]`, showing the currently-selected bulb color + collar color live
  - Size toggle: 50 ml | 100 ml (links to sibling group if applicable)
  - Applicator switcher: the other 5 Empire 50 ml applicators as sibling links
  - **Bulb color selector** (9 swatches, from `capColor`)
  - **Collar color selector** (3 swatches, from `trimColor`)
  - Price, "Add to cart" CTA, quantity selector
  - Fitment explanation: "18-415 neck thread. Compatible with our full 18-415 closure family."
- **Grace voice:** "You're looking at the 50 ml Empire with the vintage bulb sprayer and tassel. Which bulb color catches your eye? I see black, gold, ivory gold, ivory silver, lavender, matte silver, pink, red, and white." Optional: "And the collar — matte silver, shiny gold, or shiny silver?"
- **Success:** the customer sees the exact two-tone combination they're picking before they commit.

### Scene 4 — Add to cart
Customer selects bulb=Red + collar=Shiny Silver, quantity=6.

- **Expected:** cart drawer slides in, shows 1 line with line total, $50 minimum-order reminder visible, checkout CTA.
- **Grace voice:** "Got it — 6 of the red-bulb, silver-collar 50 ml Empire. That's about forty-one forty. Ready to check out, or want to add anything else?"
- **Success:** cart line item has the right graceSku (`GB-EMP-CLR-50ML-AST-RED`), right unit price, right qty, and persists across a reload.

### Scene 5 — Checkout
Customer clicks *Checkout*.

- **Expected:** cart resolves each `graceSku` → `shopifyVariantId` via `/api/shopify/resolve-variants`, builds a Shopify cart-permalink URL, opens Shopify checkout in a new tab with the line items pre-populated.
- **Grace voice:** "Opening Shopify checkout now. Payment and shipping happen over there — I'll stay here if you need me."
- **Success:** Shopify checkout page loads with all Empire line items visible, correct qty, correct variant; customer completes payment; webhook fires back to Convex.

---

## Touchpoint inventory (for the audit in step 4)

Each row below will get a red/yellow/green status in the next step.

### Data
- [ ] Every Empire SKU has valid `graceSku`, `websiteSku`, `capacity`, `capacityMl`, `color`, `capColor`, `applicator`, `neckThreadSize`
- [ ] AST/ASP variants have `trimColor` populated (done today — verify)
- [ ] Every Empire group has a `slug` that resolves to a real PDP
- [ ] Every Empire product has a `shopifyVariantId` (currently 0/91)

### Images
- [ ] Every Empire group has a `heroImageUrl` for catalog tiles (currently 0/11)
- [ ] Every Empire group has paper-doll assets in Sanity and `paperDollFamilyKey` set (currently 0/11)
- [ ] Paper-doll composite renders correctly for all 9 AST-Tassel variants (bulb color × collar color)
- [ ] Image-gen pipeline outputs 4:5 (2000 × 2500) to match the grid shell (currently outputs 2000 × 2200)

### Frontend — PDP
- [ ] Size toggle (50 ↔ 100) surfaces sibling group
- [ ] Applicator switcher shows the other Empire applicators at the same size
- [ ] Bulb-color selector (`capColor`) renders all 9 swatches
- [ ] Collar-color selector (`trimColor`) renders for AST/ASP — and is hidden for non-sprayer applicators
- [ ] Selected bulb + collar combo updates the paper-doll composite live
- [ ] Quantity input + "Add to cart" work
- [ ] Fitment drawer opens and shows 18-415 compatibility

### Frontend — Catalog
- [ ] Empire appears as a filter chip
- [ ] Grid tile uses hero image, not fallback icon
- [ ] Price range shows correctly

### Grace
- [ ] Voice responds to "Show me Empire bottles" by navigating to `/catalog?families=Empire`
- [ ] Voice responds to "Take me to the 50 ml Empire" by navigating to the correct group PDP
- [ ] Voice responds to "Show me the 50 ml Empire with the antique sprayer and tassel" by landing on group 6's PDP
- [ ] Voice can describe both bulb color AND collar color for AST/ASP
- [ ] Voice can "add the red-bulb silver-collar one to my cart, six of them" via `proposeCartAdd`
- [ ] Voice handles applicator terminology: "spray bottle" = "perfume spray pump" OR "vintage bulb sprayer" (both valid — ask which)
- [ ] Voice never substitutes `getFamilyOverview` for a "take me to" request

### Cart & checkout
- [ ] Cart persists in localStorage across reload
- [ ] Cart total shows correct unit price × qty
- [ ] Checkout resolves all Empire SKUs via `resolveVariantsBySkus` (blocked on Shopify linkage)
- [ ] Checkout URL opens Shopify with all line items
- [ ] Shopify webhook updates Convex `stockStatus` after purchase
- [ ] Minimum-order ($50) warning surfaces when cart is under threshold

### Content
- [ ] Empire family has a short brand description (for PDP header + Grace)
- [ ] Each applicator has a use-case paragraph (perfume vs lotion vs splash vs spray)
- [ ] Fitment page explains 18-415 in plain language

---

## Success criteria for the demo

A customer who has never seen the site should be able to:

1. Land on bestbottles.company and find Empire within 30 s (unassisted).
2. Pick a 50 ml Empire Vintage Bulb Sprayer with Tassel, red bulb, silver collar, qty 6 — using either clicks or voice.
3. Add to cart and see the correct line total.
4. Complete checkout on Shopify with the correct variant.
5. Receive an order confirmation with the exact configuration.

The same flow, run through Grace voice end-to-end, should finish in under 2 minutes with zero tool-call errors.

---

## Known failure modes to cover

- **Paper-doll not ready yet:** fall back to hero image, don't block the PDP.
- **Shopify variant missing:** resolver reports `unmatchedSkus`, cart shows "contact sales" fallback copy instead of a broken checkout.
- **Out-of-stock cap color:** disable that swatch, explain the substitution, don't silently drop the SKU.
- **Customer asks for a size Empire doesn't carry (15 ml):** Grace pivots to 50 ml and explains the minimum.
- **Customer asks for a color Empire doesn't carry (frosted, amber):** Grace pivots to a different family at the same size or the same applicator style.
- **Grace tool-call timeout:** surface "I'm having trouble — try again in a moment" rather than a silent hang.

---

## Open questions for Abbas

1. Is the 100 ml Dropper gap intentional or a catalog omission?
2. Is Empire the brand's hero-demo family, or is it chosen because it's a typical case? (Affects how hard we push on visuals.)
3. Should Grace offer a sample program for first-time Empire buyers (1–5 units), or default to wholesale minimums?
4. Which applicator is the volume leader across Empire? (Informs which group's hero image to prioritize first.)
5. Shopify: is the store `bestbottles-1580.myshopify.com` the correct target for Empire variant creation, or is there a separate B2B Shopify instance?

---

## What this spec is not

- **Not** a replacement for the whole-catalog work. The other 38 families still exist and still need images, paper-doll, and Shopify links. Empire is the proof, not the end.
- **Not** a visual design doc. Wireframes come next once we've scored the existing PDP against this spec.
- **Not** final. Expect this to get amended as we find more gaps during the audit.

---

## Audit scorecard — state as of 2026-04-24

Legend: 🟢 works · 🟡 works but degraded · 🔴 broken or missing

### Data layer
| Item | Status | Evidence |
|---|:---:|---|
| `graceSku`, `websiteSku`, `capacity`, `capColor`, `applicator`, `neckThreadSize`, `webPrice1pc` populated on all 91 SKUs | 🟢 | `getByFamily("Empire")` — 0 missing across all fields |
| `trimColor` on all 36 AST/ASP variants | 🟢 | Backfill `0f7a41e` — 36/36 patched, 0 mismatches |
| All 11 group slugs resolve via `getProductGroup` | 🟢 | Verified 11/11 |
| `shopifyVariantId` populated | 🔴 | 0 / 91 — blocks checkout entirely |
| `useCaseDescription`, `itemDescription` populated | 🟢 | 91/91 each |

### Images
| Item | Status | Evidence |
|---|:---:|---|
| `heroImageUrl` on productGroups (catalog tiles) | 🔴 | 0 / 11 — catalog shows Package icon fallback |
| `paperDollFamilyKey` on productGroups (PDP composite) | 🔴 | 0 / 11 — PDP falls back to legacy thumbnail |
| Legacy `imageUrl` on each variant (bestbottles.com GIF) | 🟡 | 91/91, HTTP 200, but ~200 px GIF quality |
| Image-gen pipeline aspect ratio (2000 × 2500 target) | 🟡 | Currently emits 2000 × 2200 (~12% off) — [pipeline/image-gen/grid-images/output/openai/_generation-manifest.json](pipeline/image-gen/grid-images/output/openai/_generation-manifest.json) |

### PDP (`/products/[slug]`)
| Item | Status | Evidence |
|---|:---:|---|
| Size toggle (50 ↔ 100) surfaces sibling group | 🟢 | `getApplicatorSiblings` path exists — verify live |
| Applicator switcher (5 other Empire applicators at same size) | 🟢 | `getApplicatorSiblings` renders "This Bottle Also Takes" strip |
| Bulb-color selector (`capColor`, 9 swatches) | 🟢 | All 9 colors in `COLOR_SWATCH` at [src/app/products/[slug]/page.tsx:202](src/app/products/[slug]/page.tsx) |
| Trim/collar selector (`trimColor`, renders when > 1 option) | 🟢 | `trimColorOptions` + `showTrimSelector` at [src/app/products/[slug]/page.tsx:506](src/app/products/[slug]/page.tsx) |
| All 3 Empire trim values (Shiny Silver, Shiny Gold, Matte Silver) swatched | 🟢 | Present in `COLOR_SWATCH` |
| Fitment drawer (18-415 compatibility) | 🟢 | `FitmentDrawer` — verify on live |
| Primary image is a real bottle render | 🔴 | No paper-doll, no hero → falls back to legacy GIF |

### Catalog page
| Item | Status | Evidence |
|---|:---:|---|
| Empire appears as filter chip | 🟢 | Uses `getCatalogTaxonomy` |
| Grid tiles for Empire groups show real images | 🔴 | 0/11 hero images → Package icon |
| Price range displays | 🟢 | `priceRangeMin/Max` populated |

### Grace voice (ElevenLabs GPT-4.1)
| Item | Status | Evidence |
|---|:---:|---|
| Agent has all 12 client tools registered | 🟢 | Verified via live API pull |
| Voice tool payloads slimmed to ~8 KB | 🟡 | Commit `a6094a0` pushed, awaiting Vercel deploy confirmation |
| Agent prompt RULE 5 patch (explicit "take me to" handling) | 🔴 | Prepared (`/tmp/agent_prompt_next.txt`), NOT yet PATCH'd to live agent |
| "Show me Empire bottles" → navigate to `/catalog?families=Empire` | 🟡 | Depends on model interpretation; works inconsistently pre-patch |
| "Take me to the 50 ml Empire" → PDP | 🟡 | Will improve dramatically with RULE 5 patch + slim payload |
| Grace can describe both bulb + collar color | 🔴 | Prompt doesn't mention two-tone; tool now returns both fields but no guidance to speak both |
| Grace can propose cart add for specific variant | 🟢 | `proposeCartAdd` tool wired |
| Empire-specific memorized facts in prompt | 🟢 | Prompt already states "Empire: 50ml and 100ml only" — correct |

### Cart & checkout
| Item | Status | Evidence |
|---|:---:|---|
| Cart persists in localStorage | 🟢 | `CartProvider` |
| Line total + qty math | 🟢 | `CartProvider.itemCount`, item `unitPrice * quantity` |
| $50 minimum-order UI | 🟢 | Surfaced in cart drawer |
| `resolveVariantsBySkus` finds Empire SKUs in Shopify | 🔴 | 0 / 91 have `shopifyVariantId` — every Empire checkout would show "not available in store" |
| Shopify checkout URL opens with line items | 🔴 | Blocked by previous row |
| Shopify webhook updates Convex stock | 🟡 | Webhook receiver exists, but no Empire products to fire on yet |

### Content
| Item | Status | Evidence |
|---|:---:|---|
| Family-level Empire description (for PDP header + Grace) | 🟡 | No Empire-specific brand copy found in codebase — pulled from Sanity? |
| Per-applicator use-case paragraph | 🟢 | `useCaseDescription` on 91/91 Empire variants |
| Fitment/thread-size explanation page | 🟡 | Need to confirm live-ness |

---

## Red-item priority list (for step 5)

Ranked by blast radius × unblocks-the-demo:

1. **Shopify variant linkage** — 0 / 91. Without this, checkout is simply broken. Highest impact.
2. **ElevenLabs RULE 5 prompt patch** — apply the prepared patch so Grace reliably navigates on "take me to / take us to" intents. Zero-code, 1-minute task once approved.
3. **Hero images for the 11 Empire groups** — Madison's image-gen pipeline is already configured for Empire. Generate 11 hero images at the corrected 2000 × 2500 aspect and upload to Sanity. Catalog tiles go from Package icons to real bottles.
4. **Paper-doll composites for 11 Empire groups** — biggest PDP visual upgrade. Requires PSD extraction → 11 × N component PNGs → Sanity `paperDollFamily` document + `paperDollFamilyKey` on each group.
5. **Grace Empire two-tone prompt guidance** — short addendum so she describes both bulb and collar on AST/ASP products.

Yellow-item cleanup (lower priority, do after reds):
- Correct the image-gen manifest to 2000 × 2500 so new images render without crop.
- Fix the 20 miscategorized Diva rows (applicator says bulb sprayer but itemName says tall cap) — separate from Empire, but surfaced by the trimColor backfill.
- Confirm live Vercel deploy completed for `a6094a0` (voice slim).
- Empire family brand copy — decide whether it lives in Sanity, Convex, or inline.
