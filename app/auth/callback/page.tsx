"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase-client";

type Profile = {
  onboarding_completed_at?: string | null;
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  sex?: string | null;
  activity_level?: string | null;
  goal_type?: string | null;
  target_weight_change_kg?: number | null;
  daily_calorie_target?: number | null;
  protein_target_g?: number | null;
  carbs_target_g?: number | null;
  fat_target_g?: number | null;
};

function profileNeedsOnboarding(profile: Profile | null | undefined) {
  if (!profile) return true;
  const hasCore = !!(profile.age && profile.height_cm && profile.weight_kg && profile.sex && profile.activity_level && profile.goal_type);
  const needsTargetChange = profile.goal_type === "lose_weight" || profile.goal_type === "build_muscle";
  const hasTargetChange = !needsTargetChange || !!profile.target_weight_change_kg;
  const hasMacros = !!(profile.daily_calorie_target && profile.protein_target_g && profile.carbs_target_g && profile.fat_target_g);
  return !(profile.onboarding_completed_at && hasCore && hasTargetChange && hasMacros);
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabaseBrowser.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error: sessionError } = await supabaseBrowser.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          if (!cancelled) router.replace("/login");
          return;
        }

        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;
        if (!res.ok || profileNeedsOnboarding(json.profile)) {
          router.replace("/settings?onboarding=1");
        } else {
          router.replace("/");
        }
        router.refresh();
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Unable to complete sign-in");
      }
    })();

    return () => { cancelled = true; };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 text-center">
        <h1 className="text-lg font-semibold mb-2">Finishing sign-in…</h1>
        <p className="text-sm text-gray-600">Setting up your session and checking your profile.</p>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
