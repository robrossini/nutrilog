"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabase-client";

type GoalType = "lose_weight" | "build_muscle" | "maintain";
type SexType = "male" | "female" | "other" | "prefer_not_to_say";
type ActivityLevel = "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active";

type Profile = {
  display_name: string | null;
  email: string | null;
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  goal_type?: GoalType | null;
  target_weight_change_kg?: number | null;
  sex?: SexType | null;
  activity_level?: ActivityLevel | null;
  target_recommendation_notes?: string | null;
  onboarding_completed_at?: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboardingMode = searchParams.get("onboarding") === "1";

  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setToken(data.session.access_token);

      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const json = await res.json();
      if (res.ok) setProfile(json.profile);
      setLoading(false);
    })();
  }, [router]);

  const needsTargetWeight = useMemo(
    () => profile?.goal_type === "lose_weight" || profile?.goal_type === "build_muscle",
    [profile?.goal_type]
  );

  async function onGenerateTargets() {
    if (!token || !profile) return;
    setGenerating(true);
    setMessage(null);

    const res = await fetch("/api/recommend-targets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        age: profile.age,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        goal_type: profile.goal_type,
        target_weight_change_kg: needsTargetWeight ? profile.target_weight_change_kg : null,
        sex: profile.sex,
        activity_level: profile.activity_level,
      }),
    });

    const json = await res.json();
    setGenerating(false);

    if (!res.ok) {
      setMessage(json.error || "Failed to generate recommendations");
      return;
    }

    const r = json.recommendation;
    setProfile({
      ...profile,
      daily_calorie_target: Number(r.daily_calorie_target || profile.daily_calorie_target || 0),
      protein_target_g: Number(r.protein_target_g || profile.protein_target_g || 0),
      carbs_target_g: Number(r.carbs_target_g || profile.carbs_target_g || 0),
      fat_target_g: Number(r.fat_target_g || profile.fat_target_g || 0),
      target_recommendation_notes: typeof r.notes === "string" ? r.notes : null,
    });
    setMessage("Targets generated. Review and save below.");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token || !profile) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(profile),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage(json.error || "Failed to save");
      return;
    }

    setProfile(json.profile);
    setMessage(onboardingMode ? "Profile and targets saved. You're all set." : "Saved");
    if (onboardingMode) {
      router.replace("/");
      router.refresh();
    }
  }

  if (loading || !profile) return <div className="p-6">Loading settings...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Back to dashboard
          </Link>
          {onboardingMode && (
            <span className="text-xs rounded-full bg-blue-100 text-blue-700 px-2 py-1">First-time setup</span>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile & Targets</h1>
          <p className="text-sm text-gray-600 mb-6">Set your info and generate suggested calorie/macro targets</p>

          {message && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {message}
            </div>
          )}

          <form onSubmit={onSave} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Display name</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={profile.display_name ?? ""}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              />
            </div>

            <div className="rounded-xl border border-gray-200 p-4 space-y-4">
              <h2 className="font-semibold text-gray-900">Body details & goals</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <NumberField label="Age" value={profile.age ?? 0} onChange={(v) => setProfile({ ...profile, age: v })} />
                <NumberField label="Height (cm)" value={profile.height_cm ?? 0} onChange={(v) => setProfile({ ...profile, height_cm: v })} />
                <NumberField label="Weight (kg)" value={profile.weight_kg ?? 0} onChange={(v) => setProfile({ ...profile, weight_kg: v })} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Sex</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={profile.sex ?? "prefer_not_to_say"}
                    onChange={(e) => setProfile({ ...profile, sex: e.target.value as SexType })}
                  >
                    <option value="prefer_not_to_say">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Activity level</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={profile.activity_level ?? "moderately_active"}
                    onChange={(e) => setProfile({ ...profile, activity_level: e.target.value as ActivityLevel })}
                  >
                    <option value="sedentary">Sedentary (little exercise)</option>
                    <option value="lightly_active">Lightly active (1-3 days/week)</option>
                    <option value="moderately_active">Moderately active (3-5 days/week)</option>
                    <option value="very_active">Very active (6-7 days/week)</option>
                    <option value="extra_active">Extra active (physical job / athletes)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Goal</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={profile.goal_type ?? "maintain"}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      goal_type: e.target.value as GoalType,
                      target_weight_change_kg:
                        e.target.value === "maintain" ? null : profile.target_weight_change_kg ?? 5,
                    })
                  }
                >
                  <option value="maintain">Maintain / track calories</option>
                  <option value="lose_weight">Lose weight</option>
                  <option value="build_muscle">Build muscle</option>
                </select>
              </div>

              {needsTargetWeight && (
                <NumberField
                  label={profile.goal_type === "lose_weight" ? "Weight to lose (kg)" : "Weight to gain (kg)"}
                  value={profile.target_weight_change_kg ?? 0}
                  onChange={(v) => setProfile({ ...profile, target_weight_change_kg: v })}
                />
              )}

              <button
                type="button"
                onClick={onGenerateTargets}
                className="rounded-lg bg-blue-600 text-white px-4 py-2.5 font-medium disabled:opacity-50"
                disabled={generating}
              >
                {generating ? "Generating targets..." : "Generate recommended targets"}
              </button>

              {profile.target_recommendation_notes && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                  {profile.target_recommendation_notes}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Daily targets</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumberField
                  label="Daily calories"
                  value={profile.daily_calorie_target}
                  onChange={(v) => setProfile({ ...profile, daily_calorie_target: v })}
                />
                <NumberField
                  label="Protein target (g)"
                  value={profile.protein_target_g}
                  onChange={(v) => setProfile({ ...profile, protein_target_g: v })}
                />
                <NumberField
                  label="Carbs target (g)"
                  value={profile.carbs_target_g}
                  onChange={(v) => setProfile({ ...profile, carbs_target_g: v })}
                />
                <NumberField
                  label="Fat target (g)"
                  value={profile.fat_target_g}
                  onChange={(v) => setProfile({ ...profile, fat_target_g: v })}
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-gray-900 text-white px-4 py-2.5 font-medium disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Saving..." : onboardingMode ? "Complete setup" : "Save targets"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
        type="number"
        min={0}
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </div>
  );
}
