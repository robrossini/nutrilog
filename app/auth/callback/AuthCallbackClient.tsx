"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase-client";

type Profile = {
  onboarding_completed_at?: string | null;
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  sex?: string | null;
  activity_level?: string | null;
  goal_type?: "lose_weight" | "build_muscle" | "maintain" | null;
  target_weight_change_kg?: number | null;
  daily_calorie_target?: number | null;
  protein_target_g?: number | null;
  carbs_target_g?: number | null;
  fat_target_g?: number | null;
};

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const code = searchParams.get("code");

        if (code) {
          const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("exchangeCodeForSession error:", error);
          }
        }

        const {
          data: { user },
          error: userError,
        } = await supabaseBrowser.auth.getUser();

        if (userError) {
          console.error("getUser error:", userError);
        }

        if (!user) {
          if (!cancelled) router.replace("/login");
          return;
        }

        const res = await fetch("/api/profile", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          if (!cancelled) router.replace("/settings?onboarding=1");
          return;
        }

        const profile: Profile = await res.json();

        const needsTargetChange =
          profile.goal_type === "lose_weight" || profile.goal_type === "build_muscle";

        const needsOnboarding =
          !profile ||
          !profile.onboarding_completed_at ||
          !profile.age ||
          !profile.height_cm ||
          !profile.weight_kg ||
          !profile.sex ||
          !profile.activity_level ||
          !profile.goal_type ||
          (needsTargetChange && !profile.target_weight_change_kg) ||
          !profile.daily_calorie_target ||
          !profile.protein_target_g ||
          !profile.carbs_target_g ||
          !profile.fat_target_g;

        if (!cancelled) {
          router.replace(needsOnboarding ? "/settings?onboarding=1" : "/");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
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