"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase-client";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const code = searchParams.get("code");
        const type = searchParams.get("type"); // <- key bit (signup, magiclink, etc.)

        if (code) {
          const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
          if (error) console.error("exchangeCodeForSession error:", error);
        }

        const {
          data: { user },
        } = await supabaseBrowser.auth.getUser();

        if (!user) {
          if (!cancelled) router.replace("/login");
          return;
        }

        // ONLY force onboarding immediately after signup confirmation
        if (!cancelled) {
          if (type === "signup") {
            router.replace("/settings?onboarding=1");
          } else {
            router.replace("/");
          }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) router.replace("/login");
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return <div className="p-4">Signing you in...</div>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="p-4">Signing you in...</div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}