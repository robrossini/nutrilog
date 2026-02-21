"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabase-client";

type GoalType = "lose_weight" | "build_muscle" | "maintain";
type SexType = "male" | "female" | "other" | "prefer_not_to_say";
type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extra_active";

type ProfileResponse = {
  profile?: {
    display_name?: string | null;
    email?: string | null;
    daily_calorie_target?: number | null;
    protein_target_g?: number | null;
    carbs_target_g?: number | null;
    fat_target_g?: number | null;
    age?: number | null;
    height_cm?: number | null;
    weight_kg?: number | null;
    sex?: SexType | null;
    activity_level?: ActivityLevel | null;
    goal_type?: GoalType | null;
    target_weight_change_kg?: number | null;
    onboarding_completed_at?: string | null;
  };
  error?: string;
};

type RecommendationResponse = {
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  notes?: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");

  const [sex, setSex] = useState<SexType>("prefer_not_to_say");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderately_active");
  const [goalType, setGoalType] = useState<GoalType>("maintain");
  const [targetWeightChangeKg, setTargetWeightChangeKg] = useState<string>("");

  const [calories, setCalories] = useState<string>("2000");
  const [protein, setProtein] = useState<string>("150");
  const [carbs, setCarbs] = useState<string>("180");
  const [fat, setFat] = useState<string>("70");
  const [notes, setNotes] = useState<string>("");

  const needsTargetChange = useMemo(
    () => goalType === "lose_weight" || goalType === "build_muscle",
    [goalType]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const {
          data: { session },
        } = await supabaseBrowser.auth.getSession();

        if (!session) {
          router.replace("/login");
          return;
        }

        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });

        const data: ProfileResponse = await res.json();

        if (!res.ok) {
          setErrorMsg(data.error || "Failed to load profile");
          return;
        }

        const p = data.profile;
        if (!p) return;

        if (!mounted) return;

        setDisplayName(p.display_name || "");
        setAge(p.age ? String(p.age) : "");
        setHeightCm(p.height_cm ? String(p.height_cm) : "");
        setWeightKg(p.weight_kg ? String(p.weight_kg) : "");
        setSex((p.sex as SexType) || "prefer_not_to_say");
        setActivityLevel((p.activity_level as ActivityLevel) || "moderately_active");
        setGoalType((p.goal_type as GoalType) || "maintain");
        setTargetWeightChangeKg(
          p.target_weight_change_kg ? String(p.target_weight_change_kg) : ""
        );
        setCalories(String(p.daily_calorie_target ?? 2000));
        setProtein(String(p.protein_target_g ?? 150));
        setCarbs(String(p.carbs_target_g ?? 180));
        setFat(String(p.fat_target_g ?? 70));
      } catch (e: any) {
        setErrorMsg(e.message || "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleGenerate = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!age || !heightCm || !weightKg) {
      setErrorMsg("Please enter age, height, and weight first.");
      return;
    }

    if (needsTargetChange && !targetWeightChangeKg) {
      setErrorMsg("Please enter how many kg you want to gain/lose.");
      return;
    }

    try {
      setGenerating(true);

      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/recommend-targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          age: Number(age),
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          sex,
          activity_level: activityLevel,
          goal_type: goalType,
          target_weight_change_kg: needsTargetChange ? Number(targetWeightChangeKg) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to generate recommendations");
        return;
      }

      const rec = data as RecommendationResponse;
      setCalories(String(rec.daily_calorie_target));
      setProtein(String(rec.protein_target_g));
      setCarbs(String(rec.carbs_target_g));
      setFat(String(rec.fat_target_g));
      setNotes(rec.notes || "");
      setSuccessMsg("Recommended targets generated.");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to generate recommendations");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      setSaving(true);

      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const payload = {
        display_name: displayName || null,
        age: age ? Number(age) : null,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        sex,
        activity_level: activityLevel,
        goal_type: goalType,
        target_weight_change_kg: needsTargetChange && targetWeightChangeKg ? Number(targetWeightChangeKg) : null,
        daily_calorie_target: calories ? Number(calories) : null,
        protein_target_g: protein ? Number(protein) : null,
        carbs_target_g: carbs ? Number(carbs) : null,
        fat_target_g: fat ? Number(fat) : null,
        target_recommendation_notes: notes || null,
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to save settings");
        return;
      }

      setSuccessMsg("Settings saved.");

      if (isOnboarding) {
        router.replace("/");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading settings...</div>;

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-gray-600">
              {isOnboarding
                ? "Complete your profile to generate calorie and macro targets."
                : "Update your profile and targets."}
            </p>
          </div>
          {!isOnboarding && (
            <Link href="/" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
              Back
            </Link>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <input
                type="number"
                min={10}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Height (cm)</label>
              <input
                type="number"
                min={100}
                max={250}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weight (kg)</label>
              <input
                type="number"
                min={30}
                max={300}
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as SexType)}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Activity level</label>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="sedentary">Sedentary</option>
                <option value="lightly_active">Lightly active</option>
                <option value="moderately_active">Moderately active</option>
                <option value="very_active">Very active</option>
                <option value="extra_active">Extra active</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Goal</label>
            <select
              value={goalType}
              onChange={(e) => setGoalType(e.target.value as GoalType)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="maintain">Maintain</option>
              <option value="lose_weight">Lose weight</option>
              <option value="build_muscle">Build muscle</option>
            </select>
          </div>

          {needsTargetChange && (
            <div>
              <label className="block text-sm font-medium mb-1">
                {goalType === "lose_weight" ? "Target weight loss (kg)" : "Target weight gain (kg)"}
              </label>
              <input
                type="number"
                min={0.5}
                step="0.5"
                value={targetWeightChangeKg}
                onChange={(e) => setTargetWeightChangeKg(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
          )}

          <div className="rounded-xl border p-4 bg-gray-50">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-medium">Recommended targets</h2>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-white disabled:opacity-60"
              >
                {generating ? "Generating..." : "Generate with AI"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Calories</label>
                <input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Protein (g)</label>
                <input
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Carbs (g)</label>
                <input
                  type="number"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Fat (g)</label>
                <input
                  type="number"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 bg-white"
                />
              </div>
            </div>

            {notes && (
              <div className="mt-3 rounded-lg border bg-white p-3 text-sm text-gray-700">
                {notes}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg border px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            {saving ? "Saving..." : isOnboarding ? "Save and continue" : "Save settings"}
          </button>
        </form>
      </div>
    </main>
  );
}