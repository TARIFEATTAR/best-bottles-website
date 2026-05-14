import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("checkout analytics event semantics", () => {
  it("tracks Shopify handoff as Checkout Redirected, not Checkout Completed", () => {
    const cartProvider = readFileSync("src/components/CartProvider.tsx", "utf8");
    const analytics = readFileSync("src/lib/analytics.ts", "utf8");

    expect(cartProvider).toContain("analytics.checkoutStarted");
    expect(cartProvider).toContain("analytics.checkoutRedirected");
    expect(cartProvider).not.toContain("analytics.checkoutCompleted");

    expect(analytics).toContain('adapter.track("Checkout Redirected"');
    expect(analytics).toContain('adapter.track("Order Completed"');
    expect(analytics).not.toContain('adapter.track("Checkout Completed"');
  });
});
