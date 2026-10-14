"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "../../../lib/supabase-client";
import { defaultPlan, mondayOf, WEEKDAYS } from "../../../lib/training-plan";
import type { PlanDay, PlanExercise, TrainingPlan } from "../../../lib/training-plan";

type Draft = Omit<TrainingPlan, "id"> & { id?: string };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200";

export default function TrainingPlanPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState<Draft>(() => defaultPlan());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) { router.replace("/login"); return; }
      if (cancelled) return;
      setToken(data.session.access_token);
      try {
        const res = await fetch("/api/exercise/plan", {
          headers: { Authorization: "Bearer " + data.session.access_token },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Unable to load plan");
        if (!cancelled && json.plan) setDraft(json.plan);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load plan");
      } finally { if (!cancelled) setLoaded(true); }
    }
    load();
    return () => { cancelled = true; };
  }, [router]);

  function updateDay(dayId: string, update: Partial<PlanDay>) {
    setDraft(old => ({ ...old, schedule: old.schedule.map(day => day.id === dayId ? { ...day, ...update } : day) }));
    setMessage("");
  }

  function changeExercise(dayId: string, exerciseId: string, update: Partial<PlanExercise>) {
    setDraft(old => ({
      ...old,
      schedule: old.schedule.map(day => day.id === dayId
        ? { ...day, exercises: day.exercises.map(exercise => exercise.id === exerciseId ? { ...exercise, ...update } : exercise) }
        : day),
    }));
    setMessage("");
  }

  function addDay(activity_type: "strength" | "run") {
    setDraft(old => ({
      ...old,
      schedule: [...old.schedule, {
        id: crypto.randomUUID(),
        weekday: 3,
        activity_type,
        title: activity_type === "run" ? "Easy run" : "New gym day",
        exercises: activity_type === "run" ? [] : [{
          id: crypto.randomUUID(), name: "New exercise",
          target_sets: 3, rep_min: 8, rep_max: 10, starting_weight_kg: null,
        }],
        target_duration_min: activity_type === "run" ? 25 : null,
        notes: "",
      }],
    }));
    setMessage("");
  }

  async function save(status: Draft["status"] = draft.status) {
    if (!token || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = { ...draft, status };
      const response = await fetch("/api/exercise/plan", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        const issue = json.error;
        const first = issue?.fieldErrors && Object.values(issue.fieldErrors).flat().find(Boolean);
        throw new Error(typeof issue === "string" ? issue : typeof first === "string" ? first : "Check plan fields and try again");
      }
      if (status === "archived") {
        setDraft(defaultPlan());
        setMessage("Plan archived. You can start a new plan whenever you're ready.");
      } else {
        setDraft(json.plan);
        setMessage(status === "paused" ? "Programme paused." : "Programme saved.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save programme");
    } finally { setSaving(false); }
  }

  if (!loaded) return <main className="min-h-screen bg-blue-50 p-6 text-slate-900">Loading training programme…</main>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 text-slate-900 [color-scheme:light]">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <Link href="/exercise" className="text-sm font-semibold text-blue-700 hover:underline">← Back to exercise</Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Training programme</h1>
          <p className="mt-1 text-sm text-slate-700">Build a flexible weekly routine. Changing a plan never rewrites your completed workout history.</p>
        </header>
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {!draft.id && <p className="rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-900">Suggested 16-week lean bulk plan. Review and save it to activate your schedule.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">Programme name
              <input className={"mt-1 " + field} value={draft.name} maxLength={120} onChange={e => setDraft(old => ({ ...old, name: e.target.value }))} />
            </label>
            <label className="text-sm font-semibold text-slate-800">Start week (Monday)
              <input className={"mt-1 " + field} type="date" value={draft.start_date} onChange={e => { if(e.target.value) setDraft(old => ({ ...old, start_date: mondayOf(e.target.value) })); }} />
            </label>
            <label className="text-sm font-semibold text-slate-800">Duration in weeks
              <input className={"mt-1 " + field} type="number" min={1} max={52} value={draft.duration_weeks} onChange={e => setDraft(old => ({ ...old, duration_weeks: Number(e.target.value) }))} />
            </label>
            <label className="text-sm font-semibold text-slate-800">Status
              <select className={"mt-1 " + field} value={draft.status} onChange={e => setDraft(old => ({ ...old, status: e.target.value as Draft["status"] }))} disabled={!draft.id}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-800">Goal
            <textarea className={"mt-1 " + field} rows={2} maxLength={600} value={draft.goal} onChange={e => setDraft(old => ({ ...old, goal: e.target.value }))} />
          </label>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-slate-900">Weekly schedule</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => addDay("strength")} disabled={draft.schedule.length >= 14} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"><Plus size={16}/> Gym day</button>
              <button type="button" onClick={() => addDay("run")} disabled={draft.schedule.length >= 14} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"><Plus size={16}/> Run</button>
            </div>
          </div>
          {[...draft.schedule].sort((a,b) => a.weekday-b.weekday).map(day => (
            <article key={day.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[150px_1fr]">
                  <label className="text-xs font-semibold text-slate-700">Scheduled day
                    <select className={"mt-1 " + field} value={day.weekday} onChange={e => updateDay(day.id, { weekday: Number(e.target.value) })}>
                      {WEEKDAYS.map((label, index) => <option key={label} value={index}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">Workout title
                    <input className={"mt-1 " + field} value={day.title} onChange={e => updateDay(day.id, { title: e.target.value })} />
                  </label>
                </div>
                <button type="button" aria-label={"Remove " + day.title + " from weekly schedule"} title="Remove day" onClick={() => {
                  setDraft(old => ({ ...old, schedule: old.schedule.filter(x => x.id !== day.id) }));
                }} disabled={draft.schedule.length <= 1} className="mt-5 rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:opacity-40"><Trash2 size={18}/></button>
              </div>
              {day.activity_type === "strength" ? (
                <div className="space-y-3">
                  {day.exercises.map(exercise => (
                    <div key={exercise.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-2">
                        <label className="min-w-0 flex-1 text-xs font-semibold text-slate-700">Exercise name
                          <input className={"mt-1 " + field} value={exercise.name} onChange={e => changeExercise(day.id, exercise.id, { name: e.target.value })} />
                        </label>
                        <button type="button" aria-label={"Remove " + exercise.name} title="Remove exercise" disabled={day.exercises.length <= 1} onClick={() => updateDay(day.id, { exercises: day.exercises.filter(e => e.id !== exercise.id) })} className="mt-5 rounded-lg p-2 text-red-700 hover:bg-red-100 disabled:opacity-40"><Trash2 size={17}/></button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <label className="text-xs font-semibold text-slate-700">Sets
                          <input className={"mt-1 " + field} type="number" min={1} max={12} value={exercise.target_sets} onChange={e => changeExercise(day.id, exercise.id, { target_sets: Number(e.target.value) })} />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">Min reps
                          <input className={"mt-1 " + field} type="number" min={1} max={100} value={exercise.rep_min} onChange={e => changeExercise(day.id, exercise.id, { rep_min: Number(e.target.value) })} />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">Max reps
                          <input className={"mt-1 " + field} type="number" min={1} max={100} value={exercise.rep_max} onChange={e => changeExercise(day.id, exercise.id, { rep_max: Number(e.target.value) })} />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">Start weight kg
                          <input className={"mt-1 " + field} type="number" min={0} step={0.5} placeholder="No estimate" value={exercise.starting_weight_kg ?? ""} onChange={e => changeExercise(day.id, exercise.id, { starting_weight_kg: e.target.value === "" ? null : Number(e.target.value) })} />
                        </label>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => updateDay(day.id, { exercises: [...day.exercises, {
                    id: crypto.randomUUID(),
                    name: "New exercise", target_sets: 3, rep_min: 8, rep_max: 10, starting_weight_kg: null,
                  }] })} disabled={day.exercises.length >= 25} className="text-sm font-semibold text-blue-700 hover:underline disabled:opacity-40">+ Add exercise</button>
                </div>
              ) : (
                <label className="block text-sm font-semibold text-slate-700">Suggested run duration (minutes)
                  <input type="number" min={1} max={600} value={day.target_duration_min ?? ""} onChange={e => updateDay(day.id, { target_duration_min: e.target.value ? Number(e.target.value) : null })} className={"mt-1 max-w-xs " + field} />
                </label>
              )}
              <label className="block text-xs font-semibold text-slate-700">Workout notes
                <textarea className={"mt-1 " + field} rows={2} value={day.notes} onChange={e => updateDay(day.id, { notes: e.target.value })} />
              </label>
            </article>
          ))}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {error && <p className="text-sm font-semibold text-red-700" role="alert">{error}</p>}
          {message && <p className="text-sm font-semibold text-green-800" role="status">{message}</p>}
          <button type="button" disabled={saving} onClick={() => save()} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {saving ? "Saving…" : draft.id ? "Save programme changes" : "Activate this programme"}
          </button>
          {draft.id && <button type="button" disabled={saving} onClick={() => {
            if (window.confirm("Archive this programme? Completed workouts will stay in your history, and you can then create another programme.")) save("archived");
          }} className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Archive programme</button>}
        </section>
      </div>
    </main>
  );
}
