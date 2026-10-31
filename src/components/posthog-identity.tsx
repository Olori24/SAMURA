"use client";

import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { identifyProductUser, resetProductIdentity } from "@/lib/product-analytics";
import posthog from "posthog-js";

export default function PostHogIdentity() {
  const { data: session, isPending } = authClient.useSession();
  const previousUserId = useRef<string | null>(null);

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

  return null;
}
