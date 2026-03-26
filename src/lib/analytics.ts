/**
 * Provider-agnostic analytics layer for Best Bottles.
 *
 * All tracking flows through this module. The underlying provider (Mixpanel
 * today, Gemini/GA4/Amplitude tomorrow) is swappable by changing the adapter.
 * Application code never imports mixpanel-browser directly — only this file.
 */

import mixpanel from "mixpanel-browser";

// ─── Adapter interface ───────────────────────────────────────────────────────
// Swap `activeAdapter` to change providers without touching call sites.

type Props = Record<string, string | number | boolean | null | undefined>;

interface AnalyticsAdapter {
  init(token: string, options?: Record<string, unknown>): void;
  identify(userId: string, traits?: Props): void;
  reset(): void;
  track(event: string, properties?: Props): void;
  setUserProperties(properties: Props): void;
  registerSuperProperties(properties: Props): void;
  group(groupKey: string, groupId: string, traits?: Props): void;
  timeEvent(event: string): void;
}

// ─── Mixpanel adapter ────────────────────────────────────────────────────────

const mixpanelAdapter: AnalyticsAdapter = {
  init(token, options) {
    mixpanel.init(token, {
      autocapture: true,
      track_pageview: "full-url",
      record_sessions_percent: 100,
      ...options,
    });
  },
  identify(userId, traits) {
    mixpanel.identify(userId);
    if (traits) mixpanel.people.set(traits);
  },
  reset() {
    mixpanel.reset();
  },
  track(event, properties) {
    mixpanel.track(event, properties ?? {});
  },
  setUserProperties(properties) {
    mixpanel.people.set(properties);
  },
  registerSuperProperties(properties) {
    mixpanel.register(properties);
  },
  group(groupKey, groupId, traits) {
    mixpanel.set_group(groupKey, groupId);
    if (traits) mixpanel.get_group(groupKey, groupId).set(traits);
  },
  timeEvent(event) {
    mixpanel.time_event(event);
  },
};

// ─── Active adapter (swap this line to change providers) ─────────────────────

const adapter: AnalyticsAdapter = mixpanelAdapter;

// ─── Initialization guard ────────────────────────────────────────────────────

let _initialized = false;

// ─── Public API ──────────────────────────────────────────────────────────────

export const analytics = {
  // ── Setup ────────────────────────────────────────────────────────────────

  init(token: string, options?: Record<string, unknown>) {
    if (_initialized) return;
    _initialized = true;
    adapter.init(token, options);
  },

  identify(userId: string, traits?: Props) {
    adapter.identify(userId, traits);
  },

  reset() {
    adapter.reset();
  },

  group(groupKey: string, groupId: string, traits?: Props) {
    adapter.group(groupKey, groupId, traits);
  },

  setSuperProperties(properties: Props) {
    adapter.registerSuperProperties(properties);
  },

  setUserProperties(properties: Props) {
    adapter.setUserProperties(properties);
  },

  // ── Grace AI ─────────────────────────────────────────────────────────────

  graceConversationStarted(properties: {
    pageType: string;
    pathname: string;
    productName?: string;
    productFamily?: string;
    cartItemCount: number;
  }) {
    adapter.timeEvent("Grace Conversation Ended");
    adapter.track("Grace Conversation Started", properties);
  },

  graceToolCalled(properties: {
    toolName: string;
    searchTerm?: string;
    family?: string;
    success: boolean;
  }) {
    adapter.track("Grace Tool Called", properties);
  },

  graceConversationEnded(properties: {
    pageType: string;
    pathname: string;
    toolsCalledCount: number;
    toolsUsed: string;
    cartItemsAdded: number;
    navigationsTriggered: number;
    durationCategory?: string;
  }) {
    adapter.track("Grace Conversation Ended", properties);
  },

  graceCartConversion(properties: {
    itemCount: number;
    itemNames: string;
    cartValueDelta: number;
  }) {
    adapter.track("Grace Cart Conversion", properties);
  },

  graceNavigation(properties: {
    destination: string;
    triggeredBy: string;
    query?: string;
  }) {
    adapter.track("Grace Navigation", properties);
  },

  // ── Products ─────────────────────────────────────────────────────────────

  productViewed(properties: {
    name: string;
    family: string;
    capacity: string;
    color: string;
    applicator?: string;
    neckThreadSize?: string;
    price?: number;
    slug: string;
  }) {
    adapter.track("Product Viewed", properties);
  },

  catalogFiltered(properties: {
    families?: string;
    applicators?: string;
    searchTerm?: string;
    resultCount: number;
  }) {
    adapter.track("Catalog Filtered", properties);
  },

  // ── Cart & Checkout ──────────────────────────────────────────────────────

  cartItemAdded(properties: {
    sku: string;
    name: string;
    quantity: number;
    unitPrice?: number | null;
    family?: string;
    capacity?: string;
    source: "grace" | "pdp" | "catalog" | "reorder";
  }) {
    adapter.track("Cart Item Added", properties);
  },

  cartItemRemoved(properties: {
    sku: string;
    name: string;
  }) {
    adapter.track("Cart Item Removed", properties);
  },

  checkoutStarted(properties: {
    itemCount: number;
    cartTotal: number;
    skus: string;
  }) {
    adapter.track("Checkout Started", properties);
  },

  checkoutCompleted(properties: {
    itemCount: number;
    cartTotal: number;
    unmatchedCount: number;
  }) {
    adapter.track("Checkout Completed", properties);
  },

  checkoutFailed(properties: {
    error: string;
    itemCount: number;
  }) {
    adapter.track("Checkout Failed", properties);
  },

  // ── Forms ────────────────────────────────────────────────────────────────

  formSubmitted(properties: {
    formType: "quote" | "sample" | "contact" | "newsletter";
    productCount?: number;
    source: "grace" | "manual";
  }) {
    adapter.track("Form Submitted", properties);
  },

  // ── Context update (super properties) ────────────────────────────────────

  updateContext(properties: Props) {
    adapter.registerSuperProperties(properties);
  },
};
