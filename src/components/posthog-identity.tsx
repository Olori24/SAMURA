"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { identifyProductUser, resetProductIdentity } from "@/lib/product-analytics";
import posthog from "posthog-js";

export default function PostHogIdentity() {
  const { data: session, isPending } = authClient.useSession();
  const previousUserId = useRef<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (isPending || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !posthog.__loaded) return;

    const userId = session?.user?.id;
    if (userId) {
      if (previousUserId.current !== userId) identifyProductUser(userId);
      previousUserId.current = userId;
      return;
    }

    // Also clear an identity restored from browser persistence after a signed-out reload.
    const persistedUserId = posthog.get_property("$user_id");
    if (previousUserId.current || persistedUserId) resetProductIdentity();
    previousUserId.current = null;
  }, [isPending, session?.user?.id]);

  useEffect(() => {
    if (!pathname || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !posthog.__loaded) return;
    // Track route paths only; deliberately omit query strings, which can contain OAuth codes or other sensitive values.
    posthog.capture("$pageview", { $current_url: window.location.origin + pathname });
  }, [pathname]);

  return null;
}
