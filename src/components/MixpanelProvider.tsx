"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useCart } from "@/components/CartProvider";
import { usePathname } from "next/navigation";
import { analytics } from "@/lib/analytics";

const MIXPANEL_TOKEN = "ab0478c15b0c8af6cc5eca4d82b2a7ae";

export function MixpanelProvider() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const { itemCount } = useCart();
  const pathname = usePathname();
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    analytics.init(MIXPANEL_TOKEN);
  }, []);

  useEffect(() => {
    if (isSignedIn && userId && userId !== prevUserIdRef.current) {
      prevUserIdRef.current = userId;
      analytics.identify(userId, {
        $name: user?.fullName ?? undefined,
        $email: user?.primaryEmailAddress?.emailAddress ?? undefined,
        signUpDate: user?.createdAt?.toISOString() ?? undefined,
      });
    } else if (!isSignedIn && prevUserIdRef.current) {
      prevUserIdRef.current = null;
      analytics.reset();
    }
  }, [isSignedIn, userId, user]);

  useEffect(() => {
    analytics.setSuperProperties({
      cartItemCount: itemCount,
      isSignedIn: !!isSignedIn,
    });
  }, [itemCount, isSignedIn]);

  useEffect(() => {
    const pageType = pathname === "/" ? "home"
      : pathname.startsWith("/catalog") ? "catalog"
      : pathname.startsWith("/products/") ? "pdp"
      : pathname.startsWith("/cart") ? "cart"
      : pathname.startsWith("/contact") || pathname.startsWith("/request") ? "form"
      : pathname.startsWith("/portal") ? "portal"
      : "other";

    analytics.setSuperProperties({ currentPageType: pageType });
  }, [pathname]);

  return null;
}
