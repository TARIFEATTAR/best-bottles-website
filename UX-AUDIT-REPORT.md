# BEST BOTTLES — UI/UX EVALUATION REPORT

**Date:** March 9, 2026
**Auditor:** Senior UX Auditor (AI-Assisted Code Review)
**Platform:** bestbottles.com (Next.js 16 / Shopify / Convex / Sanity CMS)
**Methodology:** Full codebase walkthrough of all UI components, pages, providers, and data flows

---

## CRITICAL ISSUES (Fix Immediately — Blocks conversion or breaks brand trust)

### ~~C1. RETRACTED — shadcn CSS Variables Are Properly Customized~~
**Correction:** Initial audit incorrectly reported blue shadcn palette. Verified in `globals.css` lines 24-45: all shadcn semantic tokens are correctly mapped to brand colors (`--color-primary: var(--color-muted-gold)`, `--color-ring: var(--color-muted-gold)`, `--color-border: var(--color-champagne)`, `--color-background: var(--color-linen)`, `--color-accent: var(--color-travertine)`). The brand palette is comprehensive and properly wired. Remaining blue violations are limited to:
- **Portal UI** (`src/components/portal/ui.tsx` line 59): `PortalTag` blue variant uses `bg-blue-50 text-blue-700 border-blue-200`
- **TextureButton** (`src/components/ui/texture-button.tsx` lines 15, 45): third-party component with `indigo-300` through `indigo-600`
- **Dormant token** (`globals.css` line 17): `--color-dark-teal: #2D4A4A` declared but unused — should be removed to prevent accidental future use
**Recommended Fix:** Replace Portal blue tag with brand-aligned colors. Delete or rebrand TextureButton if used on storefront. Remove dormant `--color-dark-teal` token.

### C2. No Top-Level "Catalog" / "Shop All" Link in Navigation
**Page:** Global navigation (`src/components/layout/Navbar.tsx`)
**Problem:** The primary nav has "Bottles", "Closures", "Specialty" — each links to `/catalog` with a pre-filtered category. There is no unfiltered `/catalog` entry point. The "Browser" archetype ("Show me everything") has no single-click path to the full product catalog.
**User Impact:** A decisive buyer or curious explorer who wants to see the full 230+ product range must click a category and then manually clear filters, or know to type `/catalog` directly. The "All Products" link only exists buried in the footer.
**Recommended Fix:** Add a "Catalog" or "Shop All" link to the primary nav (between Specialty and Journal), linking to `/catalog` with no filters.

### C3. Breadcrumbs Missing on Catalog, Blog, and Interior Pages
**Page:** Catalog (`/catalog`), Blog (`/blog`), About, Resources — all non-PDP interior pages
**Problem:** Breadcrumbs exist on Product Detail Pages (`src/app/products/[slug]/page.tsx` lines 641-668, `Home > Catalog > [Family] > [Product]` with clickable segments and mobile horizontal scroll), but are completely absent on the catalog page, blog pages, and all other interior pages. Additionally, some prototype collection pages (e.g., `src/app/collections/boston-round-30ml/page.tsx`) have hardcoded breadcrumbs with non-functional `href="#"` placeholder links.
**User Impact:** A user browsing the catalog with filters applied has no breadcrumb trail showing their navigation context. Blog readers can't navigate back to the blog index. The inconsistency between PDP (has breadcrumbs) and catalog (doesn't) is disorienting.
**Recommended Fix:** Extend the PDP breadcrumb pattern to catalog (`Home > Catalog > [Active Category/Family]`), blog (`Home > Journal > [Article]`), and all interior pages. Fix placeholder `href="#"` links in prototype collection pages.

### C4. Cart Items Don't Show Variant Details
**Page:** Cart Drawer (`src/components/cart/CartItem.tsx` ~line 25)
**Problem:** Cart items display only `itemName` (e.g., "Diva 30ml Clear") without specifying which variant — Spray, Roll-On, Dropper, Cap, etc. The `graceSku` is stored but not rendered in human-readable form.
**User Impact:** A buyer adding the same bottle with two different closures sees two identical line items in their cart. They cannot distinguish between them without memorizing SKU codes. This directly causes ordering errors and erodes trust.
**Recommended Fix:** Display variant attributes below the item name: applicator type, cap color, cap style. Parse from the stored `family`, `capacity`, `color` fields already in the CartItem interface, or add an `applicatorType` display field.

### C5. No Tier Pricing Nudge in Cart
**Page:** Cart Summary (`src/components/cart/CartSummary.tsx`)
**Problem:** The cart shows subtotal only. No indication of which pricing tier the buyer is in, how close they are to the next tier, or what savings are available at higher quantities. For a B2B site where volume pricing is the core value proposition, this is a critical omission.
**User Impact:** A buyer with 450 units doesn't know that adding 50 more unlocks Scaler pricing (15% off). Revenue is left on the table, and the buyer feels the site doesn't understand their business context.
**Recommended Fix:** Add a tier progress indicator to `CartSummary`: "You're at Graduate pricing. Add 50 more units to unlock Scaler pricing and save 15%." Show the current tier, next tier threshold, and potential savings.

### C6. No Shipping or Lead Time Information Anywhere in Cart Flow
**Page:** Cart, PDP, checkout flow
**Problem:** Zero shipping estimates, delivery timeframes, or lead time expectations are communicated anywhere before the Shopify checkout redirect. No "Ships in X days", "In stock — ready to ship", or "Made to order — 2-3 week lead time" messaging exists.
**User Impact:** B2B buyers planning production runs need delivery estimates to make purchasing decisions. The absence of this information forces them to contact sales before ordering, adding friction and reducing conversion.
**Recommended Fix:** Add stock-status-aware shipping messaging to PDP ("In Stock — Ships in 2-3 business days") and cart ("Estimated delivery: [date range]"). Distinguish between stock and made-to-order items.

### C7. FitmentDrawer "Add to Cart" is a Demo Stub — Cross-Sell Cannot Complete Purchase
**Page:** PDP Fitment Drawer (`src/components/FitmentDrawer.tsx` ~line 249)
**Problem:** The FitmentDrawer's 3-step guided flow (Base → Applicator → Trim & Closure) ends with an "Add" button that calls `alert('Added bundle to cart! (Demo)')` — a JavaScript alert, not a real cart integration. The entire fitment cross-sell experience — the platform's most differentiated feature — dead-ends at a browser alert box.
**User Impact:** A buyer who discovers a compatible closure through the fitment system, completes the 3-step selection, and clicks "Add" gets a browser alert and nothing in their cart. This breaks the most critical conversion path for the #1 differentiating feature.
**Recommended Fix:** Connect the FitmentDrawer's Add button to `CartProvider.addItems()` with the resolved variant's SKU, name, and price. This is a straightforward integration — the selected variant data is already available in the drawer state.

### C8. No "Request Quote" CTA on Product Detail Page
**Page:** PDP (`src/app/products/[slug]/page.tsx`)
**Problem:** The PDP has a prominent "Add to Cart" button but **zero path to requesting a quote**. No link, no button, no text reference to the `/request-quote` page. For B2B packaging customers ordering at production volumes (144+, 576+, 1000+ units), there is no conversion path from the product they're evaluating.
**User Impact:** A scaling beauty brand evaluating Best Bottles for a 5,000-unit production run has no way to initiate a quote conversation from the product page. They must navigate away, find the quote form separately, and manually re-enter the product details.
**Recommended Fix:** Add a "Request a Quote" secondary CTA below or alongside "Add to Cart." For quantities above a threshold (e.g., 100+), swap to a primary "Request Quote" CTA. Link to `/request-quote?sku={sku}&product={name}&qty={qty}` with pre-populated fields.

---

## HIGH PRIORITY (Fix Before Launch — Significant friction or UX gap)

### H1. Quote Form Doesn't Pre-Populate with Current Product/Cart
**Page:** `/request-quote` (`src/app/(main)/request-quote/RequestQuotePage.tsx` ~line 65)
**Problem:** When a user clicks "Request a Quote" from a PDP, the form starts blank. Product details must be re-entered manually. Cart contents are not carried over either.
**Recommended Fix:** Read URL query params (`?sku=X&product=Y&qty=Z`) and pre-fill product/quantity fields. Add a "Request Quote for Cart" flow that populates with all cart items.

### H2. No "Sort by Capacity" Option — Specifically Requested
**Page:** Catalog (`src/components/catalog/CatalogToolbar.tsx` ~line 45)
**Problem:** Sort options include Price, Name, Family, and Most Variants — but no Capacity sort. The `productGroups` data has `capacityMl` available. Abbas specifically requested this.
**Recommended Fix:** Add "Capacity: Small to Large" and "Capacity: Large to Small" sort options using `capacityMl`.

### H3. No Out-of-Stock Indication on Catalog Cards
**Page:** Catalog grid (`src/components/catalog/ProductGroupCard.tsx`)
**Problem:** Stock status is only revealed after clicking into a PDP and selecting a specific variant. Catalog cards show no stock badges. No "In Stock Only" filter exists.
**Recommended Fix:** Aggregate stock status to the `productGroups` level (e.g., "all in stock", "some limited", "out of stock"). Show badges on cards and add an "In Stock Only" filter to the sidebar.

### H4. Many Product Groups Missing Hero Images — Placeholder Icons Shown
**Page:** Catalog grid (`ProductGroupCard.tsx` ~line 45)
**Problem:** Product groups without a `heroImageUrl` render a generic placeholder icon. This makes the catalog grid look incomplete and unprofessional. This is a data issue, not a code bug.
**Recommended Fix:** Audit all 230 product groups for missing images. As a code fallback, use the `imageUrl` from the group's primary variant (`primaryWebsiteSku` → product → `imageUrl`) when `heroImageUrl` is null.

### H5. Color Selection Navigates to a Different Page
**Page:** PDP (`src/components/pdp/ColorSwatches.tsx` ~line 65)
**Problem:** Clicking a color swatch triggers `router.push(/products/${siblingSlug})` — a full page navigation. The user loses scroll position, expanded sections, and mental context. It feels like navigating away rather than selecting a color variant.
**Recommended Fix:** Implement client-side variant swapping for color changes where possible, preserving the current page state. If groups have different slugs, at minimum use `router.replace()` with `scroll: false` and transition animations.

### H6. PDP Educational Blocks Entirely CMS-Dependent — Most PDPs Are Bare
**Page:** PDP (`src/components/pdp/PdpBlocks.tsx` ~line 25)
**Problem:** If no Sanity `productGroupContent` or `productFamilyContent` exists for a product, the PDP shows zero educational content — no FAQ, no feature strip, no trust badges. The PDP is image + specs + price + CTA and nothing else. Most of the 230+ groups likely have bare PDPs.
**Recommended Fix:** Add hardcoded "default" PDP elements that render on every product regardless of CMS: trust badges ("Fitment Guaranteed", "Free Samples Available", "Ships in 2-3 Days"), a brief explanation of assembly types, and a link to the fitment guide.

### H7. Capacity Filter Shows Raw Values Instead of Grouped Ranges
**Page:** Catalog sidebar (`src/components/catalog/CatalogSidebar.tsx` ~line 165)
**Problem:** The sidebar shows individual capacities ("5 ml", "9 ml", "15 ml"...) while the mega menu offers grouped ranges ("Miniature 1-5ml", "Small 6-15ml"). A user wanting "small bottles" must check multiple individual values. Disconnect between mega menu and sidebar creates confusion.
**Recommended Fix:** Group capacity filter options into ranges matching the mega menu: Miniature (1-5ml), Small (6-15ml), Medium (25-50ml), Large (55-120ml), Bulk (128ml+).

### H8. Multiple Tap Targets Below 44px Minimum on Mobile
**Page:** Mobile nav, catalog filters, pagination, cart stepper
**Files:** `MobileNav.tsx` ~line 95 (`py-2` = ~32px), `CatalogSidebar.tsx` (filter checkboxes ~30px), `CatalogPagination.tsx` (`w-8 h-8` = 32px), `CartItem.tsx` (quantity stepper `w-8 h-8` = 32px)
**Problem:** Apple's HIG and WCAG recommend minimum 44px touch targets. Several interactive elements fall to 30-36px, causing misclicks on mobile.
**Recommended Fix:** Increase padding on all interactive mobile elements to achieve 44px minimum touch targets. For checkboxes, use `py-3` minimum. For pagination and stepper buttons, use `w-11 h-11`.

### H9. Checkout Redirects to Unbranded Shopify
**Page:** Cart → Checkout (`src/app/api/shopify/resolve-variants/route.ts`)
**Problem:** "Proceed to Checkout" constructs a Shopify cart permalink and redirects the user entirely out of the Best Bottles experience. Shopify's default checkout uses its own theme — no Obsidian/Bone/Gold, no EB Garamond, no Grace AI.
**Recommended Fix:** At minimum, customize the Shopify checkout theme to match BB brand colors and typography (Shopify Plus supports checkout customization). Long-term, consider Shopify's Checkout Extensibility or a custom checkout page.

### H10. Specs Table Buried at Bottom of PDP — Below Editorial and Cross-Sell
**Page:** PDP (`src/app/products/[slug]/page.tsx` ~line 1186)
**Problem:** Technical specs (SKU, dimensions, thread size, weight, assembly type, component group — 20+ fields rendered via `SpecRow` component) are positioned at the very bottom of the page, below the editorial zone and cross-sell sections. For a B2B audience buying packaging components, specs like Volume, Neck Finish, and Dimensions should be above the fold or in the right-column config panel.
**Recommended Fix:** Add a compact "Key Specs" summary (capacity, thread size, height, diameter) in the right column near the CTA. Keep the full specs table below for completeness.

### H11. PDP Extremely Long Vertical Scroll on Mobile — Collapsible Sections Needed
**Page:** Mobile PDP (`page.tsx`)
**Problem:** On mobile, a typical PDP with specs, fitments, and editorial blocks can reach 3000-4000px. Image alone consumes 56% of the viewport. Note: a mobile sticky "Add to Cart" bar IS implemented (lines 1243-1283 with safe area insets) — however, the page length still creates excessive scrolling for specs and fitment discovery.
**Recommended Fix:** Add collapsible accordion sections for Specs, Fitments, and Editorial on mobile to reduce vertical scroll distance.

### H12a. Only 3 Pricing Tiers Exist — Missing Production Volume Tiers
**Page:** PDP volume pricing table (`page.tsx` lines 1097-1130), Database schema (`convex/schema.ts` lines 109-111)
**Problem:** The database schema defines only 3 price fields: `webPrice1pc`, `webPrice10pc`, `webPrice12pc`. The PDP displays "1+ units", "10+ units", "12+ units". The expected 5-tier B2B pricing (1pc / 12pc / 144pc / 576pc / 1000+) does not exist anywhere — not in the schema, not in the backend, not in the UI. For a B2B packaging supplier where production runs of 500-5000 units are standard, the absence of volume pricing tiers eliminates the primary incentive to order at scale.
**Recommended Fix:** Extend the Convex schema with `webPrice144pc`, `webPrice576pc`, `webPrice1000pc` fields. Update the PDP pricing table to show all 5+ tiers. Backfill pricing data from wholesale/QuickBooks source.

### H12. Grace Widget Overlaps Content and Potential Sticky CTA on Mobile
**Page:** All mobile pages (`src/components/grace/GraceChatWidget.tsx`)
**Problem:** The 56px Grace button at `fixed bottom-6 right-6` overlaps product cards in the catalog grid and would overlap a sticky mobile CTA bar if implemented. No safe zone padding exists.
**Recommended Fix:** Add `pb-20` (80px) bottom padding to catalog grid and PDP content on mobile. If implementing a sticky CTA bar, move the Grace widget above it or to a different position.

### H13. Homepage Has Multiple Placeholder/Broken Elements That Undermine Premium Feel
**Page:** Homepage (`src/components/HomePage.tsx`)
**Problem:** Several elements are unfinished stubs that create an unprofessional impression:
- **Testimonial avatars are empty divs** (~line 417): `<div className="w-10 h-10 rounded-full bg-travertine" />` — no photos, initials, or icons. "Serving 500+ Brands" claim has no logo bar.
- **Social media icons in footer are empty circles** (~lines 518-521) — circular divs with no icons or links. Looks like broken UI.
- **Newsletter form has no backend** (~lines 490-507) — no `onSubmit` handler, will trigger a page reload on submit.
- **Default education article links go to `#`** (~lines 48-52) — `DEFAULT_ARTICLES` slugs are all `"#"`, meaning the education section links are broken unless Sanity overrides them.
- **Account button in nav has no onClick handler** (`Navbar.tsx` ~line 558-559) — clicking does nothing.
**User Impact:** A premium B2B buyer evaluating the site as a potential vendor sees broken social links, empty avatars, and non-functional forms — these signals suggest an unfinished product and erode trust.
**Recommended Fix:** Either complete these elements (real testimonials with photos, working social links, newsletter integration) or remove them entirely. Incomplete UI is worse than absent UI for a "Muted Luxury" brand.

### H14. TrustBar Is Below the Fold — Key Differentiators Invisible on Landing
**Page:** Homepage (`src/components/HomePage.tsx` ~lines 165-197)
**Problem:** The TrustBar shows four strong B2B differentiators ("No Order Minimum", "2,300+ Products", "Free Sample Kits", "Made in USA / No Tariff Surprises"), but the hero is `min-h-[80vh]` (~line 84) which pushes the TrustBar off-screen on most viewports. The most powerful selling points are invisible without scrolling.
**Recommended Fix:** Either reduce the hero to `min-h-[65vh]` so the TrustBar peeks above the fold, or incorporate 2-3 key trust stats directly into the hero overlay area.

### H15. ~~"170 Years" Heritage Claim~~ → Heritage Messaging Needs Clarification
**Page:** Homepage, About, Meta description
**Update per stakeholder guidance:** The "170 years" claim is not being used — Best Bottles has been in business 20+ years but the founders do not see the 170-year Nemat International lineage as directly interrelated. The `<meta name="description">` tag (`layout.tsx` ~line 26) currently references "170 years of expertise" — this should be updated to reflect the accurate 20+ year timeline or removed.
**About page** (`about/page.tsx` ~line 11) also references "Over 170 years of fragrance and packaging expertise" and line 57 says "What began as a family fragrance business in the 1850s..." — these need revision.
**Recommended Fix:** Replace "170 years" references with "20+ years" or "two decades" throughout. Replace the hero eyebrow "A Division of Nemat International" with a more differentiated positioning statement. Update meta description to match.

### H16. Homepage "Start Here" and "Shop by Application" Sections Create Redundant Navigation
**Page:** Homepage (`src/components/HomePage.tsx`)
**Problem:** Two separate homepage sections serve overlapping purposes:
- **"Start Here" / "Curated Collections"** (~lines 282-344): 6 cards for Essential Oils & Roll-Ons, Skincare & Serums, Sample & Discovery, Gift & Retail Packaging, Components & Closures, Fine Mist & Spray Bottles
- **"Shop by Application"** (~lines 242-280): 5 cards for Roll-ons, Sprays, Splash & Reducer, Lotion Pumps, Droppers

Both use applicator-centric labels rather than industry/use-case labels. A visitor sees two sections that look similar but have subtly different content, creating decision paralysis rather than clarity.
**Recommended Fix:** Consolidate into one section. Use industry/use-case labels for "Start Here" (Fragrance & Perfumery, Skincare & Serums, Wellness & Aromatherapy, Sample Programs, Gift & Retail, Custom Projects) and remove or repurpose "Shop by Application" — those applicator types already exist in the mega menu.

---

## MEDIUM PRIORITY (Fix Post-Launch — Polish and optimization)

### M1. Catalog Uses Raw `<img>` Instead of Next.js `<Image>` — No Optimization
**Page:** Catalog page (`src/app/catalog/page.tsx` line 1, `eslint-disable @next/next/no-img-element`)
**Problem:** All product images in the catalog grid use raw `<img>` elements instead of Next.js `<Image>`. This means no automatic image optimization, no responsive `srcset`, no blur-up placeholders, and no width/height enforcement to prevent Cumulative Layout Shift (CLS). The standalone `boston-round-30ml` collection page correctly uses `next/image`, showing the pattern was known but not applied to the main catalog.
**Recommended Fix:** Replace raw `<img>` elements with `next/image` `<Image>` component in the catalog card components. Add appropriate `sizes` prop for responsive loading.

### M2. Search Only Queries `itemName` — No Multi-Field Search
**Page:** Nav search (`src/components/layout/NavSearch.tsx`, `convex/products.ts`)
**Problem:** Searching "30ml amber dropper" requires all words to match within `itemName`. No cross-field search combining capacity + color + applicator.
**Recommended Fix:** Implement composite search that queries across `itemName`, `color`, `capacity`, `family`, and `applicator` fields.

### M3. Search Results Don't Show Product Images
**Page:** Nav search (`NavSearch.tsx`)
**Recommended Fix:** Add thumbnail images to search result items for visual product recognition.

### M4. Price Range Format on Cards is Confusing
**Page:** Catalog cards (`ProductGroupCard.tsx`)
**Problem:** "$2.50 – $8.90" doesn't indicate what causes the range (variant vs quantity).
**Recommended Fix:** Clarify as "From $2.50/unit" or show "1pc: $8.90 | 500+: $2.50".

### M5. Color Variants Not Shown on Catalog Cards
**Page:** Catalog cards (`ProductGroupCard.tsx`)
**Recommended Fix:** Add small color dot indicators below the card image showing available color variants.

### M6. No "Request Quote" Button in Cart Drawer
**Page:** Cart Drawer (`CartDrawer.tsx`)
**Recommended Fix:** Add a secondary "Request Quote for This Order" CTA below "Proceed to Checkout" for B2B buyers.

### M7. No Compatibility Warnings in Cart
**Page:** Cart (`CartProvider.tsx`)
**Problem:** Adding a bottle and an incompatible sprayer (wrong thread size) triggers no warning.
**Recommended Fix:** Run thread-size compatibility checks when items are added. Show a warning badge on incompatible pairs.

### M8. No Order Review Step Before Shopify Redirect
**Page:** Cart Drawer (`CartDrawer.tsx`)
**Recommended Fix:** Add a review step showing final item list, tier pricing summary, and compatibility confirmation before redirecting to Shopify.

### M9. Sample Flow Not Accessible from PDP
**Page:** PDP
**Problem:** PDP has "Add to Cart" and "Request a Quote" but no "Order a Sample" link.
**Recommended Fix:** Add an "Order a Sample" text link near the CTA area, especially for first-time buyers.

### M10. Mega Menu Product Counts Are Hardcoded
**Page:** Nav (`src/components/layout/Navbar.constants.ts`)
**Problem:** Counts like "Roll-On Bottles (47)" are static strings that will become stale.
**Recommended Fix:** Fetch live counts from `productGroups` data or remove counts to avoid stale data.

### M11. Mobile Filter Panel Lacks "Show X Results" Button
**Page:** Mobile catalog sidebar
**Recommended Fix:** Add a sticky "Show X Results" button at the bottom of the mobile filter panel that also closes the panel.

### M12. Out-of-Stock Variants Still Clickable on PDP
**Page:** PDP variant selector (`VariantSelector.tsx`)
**Recommended Fix:** Gray out and badge out-of-stock variants. Show "Notify Me" instead of allowing selection.

### M13. Variant Selector Lacks Visual Previews for Applicator Types
**Page:** PDP (`VariantSelector.tsx`)
**Recommended Fix:** Add small icons or thumbnails for each applicator type (spray icon, roller icon, dropper icon) next to text labels.

### M14. No "Continue Shopping" or Related Products in Cart Drawer
**Page:** Cart Drawer
**Recommended Fix:** Add "You might also need..." showing compatible closures for bottles in the cart.

### M15. 404 Page Functional but Could Be Enhanced
**Page:** `src/app/not-found.tsx`
**Note:** The 404 page actually uses proper brand palette (bone bg, obsidian text, muted-gold label) with two CTAs ("Go Home" + "Browse Catalog"). An error boundary (`error.tsx`) also exists with on-brand styling and proper `reset()` callback. Both are functional and on-brand — not generic.
**Recommended Fix:** Consider adding a "Search our catalog" input and "Ask Grace" button for richer recovery paths. The visual foundation is solid.

### M16. Loading Skeletons Use Gray Instead of Brand Colors
**Page:** Various loading states
**Recommended Fix:** Use Bone-colored skeletons with subtle gold shimmer animation.

### M17. Start Here Section Title is Generic
**Page:** Homepage (`StartHereSection.tsx`)
**Recommended Fix:** Change "Start Here" to "Shop by Use Case" or "Solutions for Your Brand."

### M18. No Quantity-Based CTA Swap on PDP
**Page:** PDP
**Problem:** When a buyer enters 500+ units, CTA should emphasize "Request a Quote" over "Add to Cart."
**Recommended Fix:** When quantity exceeds a threshold (e.g., 500), swap primary CTA to "Request a Quote" with "Add to Cart" as secondary.

### M19. Empty Catalog State Doesn't Suggest Alternatives or Grace
**Page:** Catalog (`EmptyState.tsx`)
**Recommended Fix:** Add "Ask Grace for help" button and suggest removing specific filters.

### M20. Line View Lacks Sortable Column Headers
**Page:** Catalog line view (`ProductGroupRow.tsx`)
**Recommended Fix:** Make column headers clickable for sorting in line/table view.

### M21. About Page Heritage Section May Be Too Long-Form
**Page:** `/about` (`AboutPage.tsx`)
**Recommended Fix:** Use progressive disclosure — lead with key metrics, expand to full narrative.

### M22. Mobile Mega Menu Silently Truncates Items
**Page:** Mobile nav (`src/components/Navbar.tsx` ~line 678)
**Problem:** Mobile mega menu sections use `slice(0, 6)` to limit items per column. The Bottles > Design Families column has 9 entries but only 6 are shown — with no "View All" link indicating more exist. Users on mobile never discover 3 design families.
**Recommended Fix:** Remove the `slice(0, 6)` truncation, or add a "View All [N] Families" link at the bottom of each truncated section.

### M23. FitmentCarousel Component Not Rendered on PDP — Only in Demo
**Page:** PDP, `src/components/FitmentCarousel.tsx`, `src/components/FitmentIntegrationDemo.tsx`
**Problem:** The `FitmentCarousel` horizontal carousel exists (101 lines) but is NOT imported or rendered on the PDP. It's only used in `FitmentIntegrationDemo.tsx`. Compatible closures require opening the FitmentDrawer to discover. The carousel would give quick at-a-glance visibility to compatible fitments without requiring drawer interaction.
**Recommended Fix:** Import and render `FitmentCarousel` on the PDP below the variant selector, showing 3-5 compatible fitments as a horizontal scroll with "View All" linking to the FitmentDrawer.

### M24. Fitment Card Images Are All Placeholders
**Page:** `src/components/FitmentCarousel.tsx` lines 67-70
**Problem:** Every fitment card shows a gold gradient circle placeholder instead of product photos. Code comment reads: "Images not yet stored in DB, keeping placeholder."
**Recommended Fix:** Populate `imageUrl` for component/closure products in the database. Use these images in fitment cards.

### M25. Variant Selector Shows "(Preview)" Development Artifact
**Page:** PDP (`page.tsx` ~line 933)
**Problem:** The label "Cap Color / Variant (Preview)" contains "(Preview)" — a development label visible to production users.
**Recommended Fix:** Remove "(Preview)" from the label.

### M26. Grace Receives Partial Catalog Context — Misses Most Active Filters
**Page:** Catalog, `src/components/GraceElevenLabsProvider.tsx` lines 287-294
**Problem:** Grace's `PageContext` for the catalog page parses `?family=` and `?search=` from the URL but ignores all other active filters (applicator, color, capacity, thread size, price range). A user who has filtered to "Amber + Dropper + 30ml" and asks Grace "what else do you have like this?" gets no filter context.
**Recommended Fix:** Parse all URL filter params into the Grace `PageContext.catalogFilters` object so Grace can reference and continue the user's active browsing context.

### M27. "Need Help? Ask Grace" Prompt Hidden on Mobile
**Page:** Catalog page (`page.tsx` ~line 1494)
**Problem:** The catalog header text "Need help narrowing options? Ask Grace" uses `hidden sm:inline` — hidden on mobile. Mobile users, who arguably need the most help navigating 230+ products on a small screen, never see this prompt.
**Recommended Fix:** Show the Grace prompt on mobile, perhaps as a compact banner or floating pill rather than inline text.

### M28. Catalog Pagination Has No URL State — "Load More" Loses Position on Refresh
**Page:** Catalog (`page.tsx`)
**Problem:** The catalog uses a "Load More" pattern (24 items per batch via `setVisibleCount`) rather than numbered pagination. If a user clicks "Load More" three times (viewing 72 items) and refreshes the page, they return to the first 24 items. The loaded count is not persisted in the URL.
**Recommended Fix:** Either add a `?page=` or `?limit=` URL param to preserve scroll position, or implement true pagination with numbered pages for deep catalogs.

### M29. No Search Autocomplete or Suggestions
**Page:** Search (`src/components/Navbar.tsx` lines 506-536)
**Problem:** Search is submit-only — no typeahead suggestions, recent searches, or category-level matches. Voice search via Web Audio API exists (a strength), but text search has no preview before submission.
**Recommended Fix:** Add a search suggestions dropdown showing top 5 matching products/families as the user types. Show recent searches when the input is focused but empty.

---

## GRACE AI SPECIFIC FINDINGS

### G1. Grace Greeting Bubble is NOT IMPLEMENTED
**File:** `src/components/GraceSidePanel.tsx` (exports `GraceFloatingTrigger`), `src/components/GraceContext.ts`
**Behavior:** The Grace floating trigger (`GraceFloatingTrigger`, lines 590-619 of `GraceSidePanel.tsx`) is a static button — it renders permanently at the bottom-right corner. There is no `setTimeout`, no `showGreeting` state, no dismissable speech bubble, no idle detection. Searching the entire `src/` directory for `greetingBubble`, `idle.*5`, `5000.*idle`, `auto.*greet`, `welcome.*bubble`, or `showGreeting` yields zero results. The `GraceContext.ts` has no greeting-related state fields.
**Expected:** 5-second idle trigger showing a dismissable greeting bubble with contextual message. Bubble should have an X button and not reappear after dismissal (persisted in localStorage).
**Fix:** Implement the full greeting bubble feature: (1) add `showGreeting` / `greetingDismissed` state to GraceContext, (2) add a `setTimeout(5000)` that fires when no user interaction detected, (3) render a speech-bubble tooltip above the floating trigger with page-contextual text, (4) add X dismiss button that sets `greetingDismissed` in localStorage.

### G2. Greeting Bubble is Static — Not Page-Contextual
**File:** `GraceChatWidget.tsx` ~line 85
**Behavior:** Same generic "Hi! I'm Grace..." message on every page.
**Expected:** Contextual greetings: Homepage ("Tell me about your project"), Catalog ("I can help you narrow down options"), PDP ("Want help choosing a closure for this bottle?"), Cart ("Ready to check out? I can review compatibility").
**Fix:** Pass `currentPath` to the greeting logic and render page-specific messages.

### G3. Grace Doesn't Receive Current Product Data on PDP
**File:** `src/lib/grace/graceContext.tsx`
**Behavior:** Grace knows the URL (`/products/diva-30ml-clear-18-415`) but must make a `getProductDetails` tool call to get product info — adding latency.
**Expected:** Current product's key data (name, SKU, price, thread size, applicator) should be injected into Grace's context when on a PDP.
**Fix:** Extend `graceContext` to include `currentProduct` object when on PDP routes.

### G4. No `compareProducts` Tool
**File:** `src/lib/grace/graceTools.ts`
**Behavior:** Grace can't side-by-side compare two products. Must make two `getProductDetails` calls and manually compose a comparison.
**Expected:** A dedicated `compareProducts` tool that returns a structured comparison table.
**Fix:** Add `compareProducts` tool accepting two SKUs and returning a diff of specs, pricing, and compatibility.

### G5. `navigateUser` Tool Has No URL Schema Validation
**File:** `graceTools.ts` ~line 135
**Behavior:** Grace constructs catalog URLs as raw strings. If URL param format changes, navigation silently breaks.
**Fix:** Validate URLs against the actual catalog filter schema before executing navigation. Use a URL builder utility.

### G6. `searchCatalog` Limited to 10 Results with No Pagination
**File:** `graceTools.ts` ~line 52
**Behavior:** Broad queries return only 10 results. No "show more" capability.
**Fix:** Increase to 15-20 results and add a `showMore` tool or pagination parameter.

### G7. Grace Doesn't Track Browsing History Within Session
**File:** `graceContext.tsx`
**Behavior:** Grace only knows the current page. Can't say "I noticed you were looking at Diva and Sleek — want me to compare?"
**Fix:** Maintain a rolling array of last 5 pages visited in the Grace context.

### G8. Cart Proposal Doesn't Show Which Bottle It's Compatible With
**File:** `src/components/grace/GraceCartProposal.tsx`
**Behavior:** Shows "Add Gold Mist Sprayer?" without context of which cart item it matches.
**Fix:** Include "Compatible with: Diva 30ml Clear (in your cart)" in the proposal card.

### G9. Grace Doesn't Proactively Check Cart Compatibility
**Behavior:** Grace waits to be asked about compatibility instead of automatically flagging mismatches when the cart drawer opens.
**Fix:** Add a cart-open event trigger that prompts Grace to review compatibility and surface any warnings.

### G10. Voice Toggle Only Accessible Inside Expanded Panel
**File:** `GraceVoiceMode.tsx`
**Behavior:** Users must open the chat panel first, then find the voice toggle.
**Fix:** Add a microphone icon on the collapsed widget button or a "Talk to Grace" entry point.

### G11. Grace Doesn't Know User Account Type (Retail vs B2B)
**File:** `graceContext.tsx`
**Behavior:** Grace treats all users the same regardless of Clerk organization/role.
**Fix:** Pass Clerk user type/organization data to Grace context so she can adjust tone and recommendations.

### G12. Grace Doesn't Suggest Sample Orders Alongside MOQ Information
**File:** `graceSystemPrompt.ts`
**Behavior:** When discussing minimums, Grace doesn't mention the sample program.
**Fix:** Add to system prompt: "When a customer asks about MOQs, always mention the sample program as an option for evaluation."

---

## WHAT'S WORKING WELL

### 1. Thread-Based Fitment Matching Engine
The compatibility system using `neckThreadSize` to match bottles with closures is sophisticated and genuinely useful. The `getCompatibleFitments` query, `selectBestFitmentRule()` logic, and "This Bottle Also Takes" cross-sell section solve real buyer problems. This is a major differentiator that most packaging suppliers don't offer online.

### 2. Sanity Editorial Block System
The `PdpBlocks` architecture — where content can be customized per-product or inherited from a family template — is well-designed. Feature strips, FAQs, galleries, and trust badges can be composed flexibly. The gap is content population, not architecture.

### 3. Grace AI Conversational Architecture
The tool-based approach (searchCatalog, getProductDetails, getCompatibleFitments, proposeCartAdd, navigateUser, form tools) gives Grace genuine utility beyond a generic chatbot. The system prompt is remarkably detailed with persona backstory, tone guidelines, and escalation rules. Voice mode via ElevenLabs is a strong differentiator.

### 4. Dual-View Catalog (Visual Grid + Line View)
Offering both grid and line/table views serves two buyer archetypes: the visual browser and the data-driven comparison shopper. Combined with comprehensive filtering (8+ dimensions) and URL-based deep linking, the catalog is technically strong.

### 5. B2B Portal Infrastructure
The Clerk-gated portal with account dashboard, order history, draft orders, and Grace Projects demonstrates serious B2B commitment. The tiered account structure (Graduate, Scaler, Professional) with different pricing and features is well-architected for scaling businesses.

### 6. Voice Search and PDP Breadcrumbs
The navbar includes a full Web Audio API voice search integration with silence detection and transcription — a premium touch that most e-commerce sites lack. PDP breadcrumbs (`src/app/products/[slug]/page.tsx` lines 641-668) are well-implemented with clickable segments, filter context preservation, and mobile horizontal scroll. The nav-to-cart funnel is complete with no dead ends, including a proper empty cart state with guidance text.

---

## OVERALL FLUIDITY SCORES

| Section | Score | Justification |
|---------|-------|---------------|
| **Homepage** | 5/10 | Poetic hero headline prioritizes aesthetics over clarity; TrustBar with key differentiators pushed below fold by 80vh hero; placeholder testimonials, broken social icons, and non-functional newsletter undermine premium feel; "Start Here" and "Shop by Application" overlap; inaccurate 170-year heritage claim in meta needs correction to 20+ years |
| **Navigation** | 5/10 | Mega menus are well-structured, PDP breadcrumbs work well, but catalog/blog lack breadcrumbs, no unfiltered catalog link, mobile silently truncates menu items, and tap targets are undersized |
| **Collection Pages** | 6/10 | Comprehensive filters with facet counts and color swatches, excellent variant visibility across all views, dual view modes; but missing capacity sort, out-of-stock indicators, grouped capacity ranges, and uses raw `<img>` instead of `next/image` |
| **Product Detail Pages** | 4/10 | Fitment matching architecture is excellent but the "Add" button is a demo stub (`alert()`), FitmentCarousel not rendered, no Request Quote CTA exists, only 3 of 5+ pricing tiers implemented, single image per variant, specs buried at bottom; mobile sticky CTA is a bright spot |
| **Grace AI** | 6/10 | Deep tool set, strong persona, voice mode; but greeting bubble is entirely unimplemented (static button only), no page context injection, no comparison tool, no browsing history tracking |
| **Mobile** | 5/10 | Mobile sticky Add to Cart bar is well-implemented; but tap targets too small across nav/filters/pagination, Grace overlaps content, PDP vertical scroll excessive, "Ask Grace" hint hidden on mobile, mega menu truncates items silently |
| **Cart & Checkout** | 3/10 | Cart items lack variant details, no tier nudge, no compatibility warnings, no shipping info, checkout abandons brand entirely |
| **Brand Consistency** | 8/10 | Strongest area — shadcn CSS properly maps to brand palette, EB Garamond + Inter pairing consistent, Obsidian/Bone/Gold used uniformly across storefront, 404 and error states are on-brand; Portal UI intentionally diverges (SaaS dashboard aesthetic), dormant `--color-dark-teal` token and TextureButton indigo are minor violations |

---

## OVERALL PLATFORM SCORE: 5.2 / 10

Best Bottles has genuinely strong architectural foundations — the fitment engine, Grace AI tool system, Sanity editorial blocks, variant resolution logic, brand-correct CSS variable system, and B2B portal represent real differentiation that competitors lack. The visual design system (EB Garamond + Inter, Obsidian/Bone/Gold palette, consistent spacing) is premium and well-executed across the storefront. However, the platform is undermined by three categories of unfinished work: (1) the platform's most differentiated feature — fitment cross-sell — dead-ends at an `alert('Demo')` stub and the FitmentCarousel isn't even rendered on the PDP, (2) the cart-to-checkout flow lacks critical B2B information (variant details, tier nudges, compatibility warnings, shipping estimates, Request Quote CTA) before ejecting users to an unbranded Shopify checkout, and (3) the homepage has multiple unfinished placeholder elements (empty testimonial avatars, broken social icons, non-functional newsletter, dead article links, dead account button) that signal "beta product" rather than "20+ year premium packaging partner."

**Top 3 fixes by impact:**
1. **Connect FitmentDrawer "Add" to real cart** and render FitmentCarousel on PDP — this unlocks the platform's #1 differentiator and is a straightforward integration
2. **Add "Request Quote" CTA to PDP** and extend pricing to 5+ tiers — these are table-stakes for B2B conversion that are currently absent from the product page
3. **Clean up homepage placeholder elements** — remove or complete empty testimonial avatars, broken social icons, non-functional newsletter, dead article links, and dead account button. Incomplete UI is worse than absent UI for a premium brand
