"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabase-client";

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

async function routeAfterAuth(accessToken: string, router: ReturnType<typeof useRouter>) {
  const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json().catch(() => ({}));
  const needs = !res.ok || profileNeedsOnboarding(json.profile);
  router.replace(needs ? '/settings?onboarding=1' : '/');
  router.refresh();
}


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (data.session) void routeAfterAuth(data.session.access_token, router);
    });
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    await routeAfterAuth(data.session.access_token, router);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Log in</h1>
        <p className="text-sm text-gray-600 mb-6">Access your NutriLog account</p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            className="w-full rounded-lg bg-gray-900 text-white py-2.5 font-medium disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}