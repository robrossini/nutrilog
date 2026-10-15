"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabase-client";
import { dailyNutrition, dateDaysAgo, exerciseNames, runSeries, strengthSeries } from "../../lib/progress";
import type { ProgressMeal, ProgressSession, ProgressWeight } from "../../lib/progress";
import { LiftChart, NutritionChart, RunChart, WeightChart } from "../../components/progress/charts";

type Profile = { daily_calorie_target: number | null; protein_target_g: number | null; carbs_target_g: number | null; fat_target_g: number | null; weight_kg: number | null };
type Payload = { profile: Profile | null; meals: ProgressMeal[]; sessions: ProgressSession[]; weights: ProgressWeight[] };
const blank: Payload = { profile: null, meals: [], sessions: [], weights: [] };
const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
function Metric({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    {detail && <p className="mt-1 text-xs text-slate-600">{detail}</p>}
  </div>;
}
export default function ProgressPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [data, setData] = useState<Payload>(blank);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [weightDate, setWeightDate] = useState(() => dateDaysAgo(0));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(accessToken: string) {
    const res = await fetch("/api/progress", {
      headers: { Authorization: "Bearer " + accessToken }, cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not load progress");
    setData(json as Payload);
  }
  useEffect(() => {
    let active = true;
    async function begin() {
      const { data: auth } = await supabaseBrowser.auth.getSession();
      if (!active) return;
      if (!auth.session) { router.replace("/login"); return; }
      const accessToken = auth.session.access_token;
      setToken(accessToken);
      try { await load(accessToken); }
      catch (e) { if (active) setError(e instanceof Error ? e.message : "Could not load progress"); }
      finally { if (active) setLoading(false); }
    }
    begin();
    return () => { active = false; };
  }, [router]);

  const cutoff = dateDaysAgo(range - 1);
  const meals = useMemo(() => data.meals.filter(m => dateDaysAgo(0, new Date(m.logged_at)) >= cutoff), [data.meals, cutoff]);
  const sessions = useMemo(() => data.sessions.filter(s => dateDaysAgo(0, new Date(s.performed_at)) >= cutoff), [data.sessions, cutoff]);
  const weights = useMemo(() => data.weights.filter(w => w.recorded_on >= cutoff), [data.weights, cutoff]);
  const nutrition = useMemo(() => dailyNutrition(meals), [meals]);
  const options = useMemo(() => exerciseNames(data.sessions), [data.sessions]);
  const selected = options.includes(exercise) ? exercise : options[0] ?? "";
  const lifts = useMemo(() => strengthSeries(sessions, selected), [sessions, selected]);
  const runs = useMemo(() => runSeries(sessions), [sessions]);
  const gymCount = sessions.filter(s => s.activity_type === "strength").length;
  const runCount = sessions.filter(s => s.activity_type === "run").length;
  const distanceKm = sessions.reduce((sum, s) => sum + (s.activity_type === "run" ? Number(s.distance_m) || 0 : 0), 0) / 1000;
  const avg = (key: "calories" | "protein" | "carbs" | "fat") =>
    nutrition.length ? Math.round(nutrition.reduce((sum, day) => sum + day[key], 0) / nutrition.length) : null;
  const latest = weights.length ? Number(weights[weights.length - 1].weight_kg) : null;
  const delta = weights.length > 1 ? latest! - Number(weights[0].weight_kg) : null;
  const pace = runs.length ? runs[runs.length - 1].pace : null;
  const paceSeconds = pace == null ? null : Math.round(pace * 60);
  const paceLabel = paceSeconds == null ? "—" : Math.floor(paceSeconds / 60) + ":" + String(paceSeconds % 60).padStart(2, "0") + "/km";

  async function saveWeight(e: FormEvent) {
    e.preventDefault();
    setError(""); setMessage("");
    const n = Number(weight);
    if (!weight.trim() || !Number.isFinite(n) || n < 30 || n > 300 || weightDate > dateDaysAgo(0)) {
      setError("Enter a valid past or present date and a weight between 30 and 300 kg.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ recorded_on: weightDate, weight_kg: n }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save weigh-in");
      await load(token);
      setWeight("");
      setMessage("Weigh-in saved. Re-entering the same date replaces its earlier value.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save weigh-in");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-6 text-slate-900">Loading progress…</main>;
  return <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 text-slate-900 [color-scheme:light]">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="flex gap-4 text-sm font-semibold text-blue-700">
            <Link href="/" className="hover:underline">← Food diary</Link>
            <Link href="/exercise" className="hover:underline">Exercise logger</Link>
          </nav>
          <h1 className="mt-2 text-3xl font-bold">Your progress</h1>
          <p className="mt-1 text-sm text-slate-700">See your nutrition, training, runs and bodyweight together.</p>
        </div>
        <div className="flex rounded-lg border border-slate-300 bg-white p-1" aria-label="Progress time range">
          {([7,30,90] as const).map(days => <button key={days} type="button"
            aria-pressed={range === days} onClick={() => setRange(days)}
            className={"rounded-md px-3 py-2 text-sm font-semibold " +
              (range === days ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100")}>
            {days} days
          </button>)}
        </div>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      <section>
        <h2 className="mb-3 text-xl font-bold">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric title="Gym workouts" value={String(gymCount)} detail={"Last " + range + " days"} />
          <Metric title="Runs" value={String(runCount)} detail={distanceKm.toFixed(1) + " km logged"} />
          <Metric title="Food diary days" value={String(nutrition.length)} detail={"Of " + range + " days"} />
          <Metric title="Avg. protein" value={avg("protein") == null ? "—" : avg("protein") + " g"} detail={"Target: " + (data.profile?.protein_target_g ?? "—") + " g"} />
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <NutritionChart data={nutrition} target={data.profile?.daily_calorie_target ?? null} />
          <p className="px-1 text-sm text-slate-700">Avg. logged day: <strong>{avg("calories") ?? "—"} kcal</strong> · carbs <strong>{avg("carbs") ?? "—"} g</strong> · fat <strong>{avg("fat") ?? "—"} g</strong></p>
          <p className="px-1 text-xs text-slate-600">Averages include days with at least one meal; incomplete days may lower them.</p>
        </div>
        <div className="space-y-3">
          <WeightChart data={weights} />
          <p className="text-sm text-slate-700">Latest check-in: <strong>{latest == null ? "—" : latest.toFixed(1) + " kg"}</strong> · Period change: <strong>{delta == null ? "—" : (delta > 0 ? "+" : "") + delta.toFixed(1) + " kg"}</strong></p>
          {!weights.length && data.profile?.weight_kg != null && <p className="text-xs text-slate-600">Profile weight: {data.profile.weight_kg} kg (not dated or included in the chart).</p>}
          <form onSubmit={saveWeight} className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
            <label className="text-sm font-semibold">Date<input type="date" required max={dateDaysAgo(0)} value={weightDate} onChange={e => setWeightDate(e.target.value)} className={"mt-1 block " + input} /></label>
            <label className="text-sm font-semibold">Weight (kg)<input type="number" required min="30" max="300" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className={"mt-1 block w-32 " + input} /></label>
            <button type="submit" disabled={saving || !token} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? "Saving…" : "Save weigh-in"}</button>
          </form>
        </div>
        <div>
          {options.length > 0 && <label className="mb-2 block text-sm font-semibold">Compare an exercise <select value={selected} onChange={e => setExercise(e.target.value)} className={"ml-2 max-w-52 " + input}>{options.map(name => <option key={name}>{name}</option>)}</select></label>}
          <LiftChart data={lifts} exercise={selected} />
        </div>
        <div className="space-y-2">
          <RunChart data={runs} />
          <p className="text-sm text-slate-700">Total distance: <strong>{distanceKm.toFixed(1)} km</strong> · Latest pace: <strong>{paceLabel}</strong></p>
        </div>
      </div>
      <p className="pb-6 text-xs text-slate-600">Based on up to 90 days of saved NutriLog entries. Unlogged days are not estimates.</p>
    </div>
  </main>;
}
