"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabase-client";

type Profile = {
  display_name: string | null;
  email: string | null;
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
};

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    setMessage("Saved");
  }

  if (loading || !profile) {
    return <div className="p-6">Loading settings...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Back to dashboard
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Profile & Targets</h1>
          <p className="text-sm text-gray-600 mb-6">Set your personal nutrition targets</p>

          {message && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {message}
            </div>
          )}

          <form onSubmit={onSave} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Display name</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                value={profile.display_name ?? ""}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              />
            </div>

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

            <button
              type="submit"
              className="rounded-lg bg-gray-900 text-white px-4 py-2.5 font-medium disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save targets"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <input
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </div>
  );
}