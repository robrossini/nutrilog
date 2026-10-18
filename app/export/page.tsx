"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../../lib/supabase-client";

async function allRows(table: string, columns: string, userId: string, orderColumn: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseBrowser.from(table)
      .select(columns).eq("user_id", userId)
      .order(orderColumn, { ascending: true })
      .range(offset, offset + 499);
    if (error) throw new Error(table + ": " + error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return rows;
}

export default function ExportDataPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data: auth, error: authError } = await supabaseBrowser.auth.getUser();
      if (authError || !auth.user) throw new Error("Please log in to NutriLog first.");
      const uid = auth.user.id;
      const [meals, sessions, profile] = await Promise.all([
        allRows("meals", "logged_at,meal_name,raw_input,calories,protein_g,carbs_g,fat_g", uid, "logged_at"),
        allRows("exercise_sessions", "id,title,activity_type,performed_at,duration_seconds,distance_m,effort,notes,exercise_sets(exercise_name,exercise_order,set_number,weight_kg,reps,rir)", uid, "performed_at"),
        supabaseBrowser.from("profiles").select("daily_calorie_target,protein_target_g,carbs_target_g,fat_target_g").eq("id", uid).maybeSingle()
      ]);
      if (profile.error) throw new Error(profile.error.message);
      const payload = {
        format: "nutrilog-export-v1",
        exported_at: new Date().toISOString(),
        timezone_note: "Timestamps are ISO; interpret dates in your local timezone when analysing.",
        targets: profile.data,
        meals,
        workouts: sessions
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nutrilog-export-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/" className="text-blue-700 hover:underline">← Back to NutriLog</Link>
        <h1 className="mt-5 text-2xl font-bold">Export your data</h1>
        <p className="mt-3 text-slate-700">Download your nutrition history, workout sessions, sets and current macro targets as a JSON file. Nothing is shared automatically.</p>
        <p className="mt-2 text-sm text-slate-600">The export may contain personal health and food information. Keep it somewhere private, and upload it to ChatGPT only if you choose to.</p>
        <button type="button" disabled={busy} onClick={download} className="mt-5 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
          {busy ? "Preparing export…" : "Download JSON export"}
        </button>
        {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      </div>
    </main>
  );
}
