"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase-client";
import { ProgrammePanel } from "../../components/exercise/programme-panel";
import { suggestWeight } from "../../lib/progression";
import type { WeightSuggestion } from "../../lib/progression";
import { localISODate } from "../../lib/training-plan";
import type { PlanDay, TrainingPlan } from "../../lib/training-plan";

type SetRow = {
  exercise_name: string;
  exercise_order: number;
  set_number: number;
  weight_kg: number | null;
  reps: number;
  rir: number | null;
};

type Session = {
  id: string;
  title: string;
  activity_type: "strength" | "run";
  performed_at: string;
  duration_seconds: number | null;
  distance_m: number | null;
  effort: number | null;
  notes: string | null;
  exercise_sets: SetRow[];
  training_plan_id?: string | null;
  planned_day_id?: string | null;
  planned_week?: number | null;
};

const templates: Record<string, string[]> = {
  "Gym A": ["Barbell squat", "Bench press", "Lat pulldown", "Romanian deadlift", "Lateral raise", "Plank"],
  "Gym B": ["Deadlift", "Incline dumbbell press", "Seated cable row", "Leg press", "Biceps curl", "Triceps pushdown"],
  "Gym C": ["Barbell squat", "Bench press", "Chest-supported row", "Leg curl", "Shoulder press", "Calf raise"],
};

const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200";

function groupSets(sets: SetRow[] = []) {
  const groups = new Map<number, { name: string; sets: SetRow[] }>();
  for (const set of [...sets].sort((a, b) => a.exercise_order - b.exercise_order || a.set_number - b.set_number)) {
    const group = groups.get(set.exercise_order);
    if (group) group.sets.push(set);
    else groups.set(set.exercise_order, { name: set.exercise_name, sets: [set] });
  }
  return Array.from(groups.values());
}

function paceLabel(distanceM: number, seconds: number) {
  if (distanceM <= 0 || seconds <= 0) return null;
  const paceSeconds = Math.round(seconds / (distanceM / 1000));
  return Math.floor(paceSeconds / 60) + ":" + String(paceSeconds % 60).padStart(2, "0") + "/km";
}

export default function ExercisePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [history, setHistory] = useState<Session[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [type, setType] = useState<"strength" | "run">("strength");
  const [title, setTitle] = useState("Gym A");
  const [sets, setSets] = useState<SetRow[]>([]);
  const [planned, setPlanned] = useState<{ training_plan_id: string; planned_day_id: string; planned_week: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, WeightSuggestion>>({});
  const [distance, setDistance] = useState("");
  const [minutes, setMinutes] = useState("");
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [performedAt, setPerformedAt] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setToken(data.session.access_token);
    });
  }, [router]);

  async function loadHistory(bearerToken: string) {
    const res = await fetch("/api/exercise/sessions", {
      headers: { Authorization: "Bearer " + bearerToken },
    });
    if (!res.ok) throw new Error("Could not load workout history");
    const data = await res.json();
    const sessions: Session[] = data.sessions ?? [];
    setHistory(sessions);
    setExpandedSessionId(current => current ?? sessions[0]?.id ?? null);
  }

  useEffect(() => {
    if (!token) return;
    loadHistory(token).catch(e => setError(e.message));
  }, [token]);

  function useTemplate(name: string) {
    setPlanned(null);
    setSuggestions({});
    setType("strength");
    setTitle(name);
    setSuccess("");
    const previous = history.find(s => s.title === name && s.activity_type === "strength");
    const next = (templates[name] ?? []).flatMap((exercise_name, exercise_order) => {
      const prior = (previous?.exercise_sets ?? [])
        .filter(s => s.exercise_name === exercise_name)
        .sort((a, b) => a.set_number - b.set_number);
      return Array.from({ length: prior.length || 3 }, (_, i) => ({
        exercise_name,
        exercise_order,
        set_number: i + 1,
        weight_kg: prior[i]?.weight_kg ?? null,
        reps: prior[i]?.reps ?? 5,
        rir: null,
      }));
    });
    setSets(next);
  }

  function startPlannedWorkout(day: PlanDay, plan: TrainingPlan, week: number) {
    setType(day.activity_type);
    setTitle(day.title);
    setPerformedAt(localISODate());
    setPlanned({ training_plan_id: plan.id, planned_day_id: day.id, planned_week: week });
    setNotes(day.notes || "");
    setError("");
    setSuccess("");
    if (day.activity_type === "strength") {
      const nextSuggestions: Record<number, WeightSuggestion> = {};
      const rows = day.exercises.flatMap((exercise, order) => {
        const suggestion = suggestWeight(exercise, history);
        nextSuggestions[order] = suggestion;
        return Array.from({ length: exercise.target_sets }, (_, index) => ({
          exercise_name: exercise.name,
          exercise_order: order,
          set_number: index + 1,
          weight_kg: suggestion.weight_kg,
          reps: 0, // Never pre-fill achieved reps for a workout not yet completed.
          rir: null,
        }));
      });
      setSuggestions(nextSuggestions);
      setSets(rows);
    } else {
      setSuggestions({});
      setSets([]);
      setDistance("");
      setMinutes(day.target_duration_min ? String(day.target_duration_min) : "");
      setEffort("");
    }
  }

  function changeSet(index: number, field: "weight_kg" | "reps" | "rir", value: string) {
    setSets(old => old.map((row, i) => i === index
      ? { ...row, [field]: field === "reps" ? Number(value) : value === "" ? null : Number(value) }
      : row
    ));
    setSuccess("");
  }

  function removeExercise(order: number) {
    // Only affects the workout currently being composed; saved history is not changed.
    setSets(old => old.filter(s => s.exercise_order !== order));
    setSuccess("");
  }

  function removeSet(order: number, setNumber: number) {
    setSets(old => old
      .filter(s => !(s.exercise_order === order && s.set_number === setNumber))
      .map(s => {
        if (s.exercise_order !== order || s.set_number < setNumber) return s;
        return { ...s, set_number: s.set_number - 1 };
      })
    );
    setSuccess("");
  }

  async function save() {
    if (!token || busy) return;
    if (type === "strength" && sets.some(s => s.reps <= 0)) {
      setError("Enter the repetitions you completed for every set, or remove sets you skipped.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    const payload = {
      activity_type: type,
      title: type === "run" && !planned ? "Run" : title,
      performed_at: new Date(performedAt + "T12:00:00").toISOString(),
      notes,
      ...(planned ?? {}),
      ...(type === "run"
        ? {
            distance_m: Number(distance) * 1000,
            duration_seconds: Math.round(Number(minutes) * 60),
            effort: effort ? Number(effort) : null,
            sets: [],
          }
        : { sets }),
    };
    try {
      const res = await fetch("/api/exercise/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(typeof result.error === "string" ? result.error : "Check the workout details and try again");
      setSuccess("Workout saved. You can see its full details below.");
      setNotes("");
      setPlanned(null);
      setSuggestions({});
      setSets([]);
      setDistance("");
      setMinutes("");
      setEffort("");
      setExpandedSessionId(result.id);
      await loadHistory(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save workout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 text-slate-900 [color-scheme:light]">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-sm font-medium text-blue-700 hover:underline">← Food diary</Link>
            <h1 className="text-3xl font-bold text-slate-900">Exercise</h1>
          </div>
          <Link href="/settings" className="text-sm font-medium text-slate-700 hover:underline">Settings</Link>
        </header>

        <ProgrammePanel token={token} history={history} onStart={startPlannedWorkout} />

        <div className="flex gap-2">
          {(["strength", "run"] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setPlanned(null); setSuggestions({}); setSuccess(""); }}
              className={"rounded-lg px-4 py-2 font-medium " + (type === t
                ? "bg-blue-700 text-white"
                : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50")}
            >
              {t === "strength" ? "Gym workout" : "Run"}
            </button>
          ))}
        </div>

        <section id="workout-logger" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            Date
            <input type="date" value={performedAt} onChange={e => setPerformedAt(e.target.value)} className={"mt-1 block max-w-xs " + inputClass} />
          </label>

          {type === "strength" ? (
            <>
              {planned && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                <strong>Planned workout:</strong> Previous weights or starting estimates are prefilled. Enter the reps you actually complete (starting at 0). Suggested increases are optional.
                <button type="button" className="ml-2 font-semibold underline" onClick={() => { setPlanned(null); setSuggestions({}); }}>Make unscheduled</button>
              </div>}
              <div className="flex flex-wrap gap-2">
                {Object.keys(templates).map(name => (
                  <button key={name} type="button" onClick={() => useTemplate(name)} className="rounded-lg bg-blue-50 px-3 py-2 font-medium text-blue-800 hover:bg-blue-100">{name}</button>
                ))}
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Workout name
                <input value={title} onChange={e => setTitle(e.target.value)} className={"mt-1 block " + inputClass} />
              </label>

              {Array.from(new Set(sets.map(s => s.exercise_order))).map(order => {
                const exerciseName = sets.find(s => s.exercise_order === order)?.exercise_name ?? "";
                return (
                  <div key={order} className="space-y-3 border-t border-slate-200 pt-4">
                    <div className="flex items-start gap-2">
                      <label className="flex-1 text-sm font-medium text-slate-700">
                        Exercise
                        <input
                          aria-label="Exercise name"
                          value={exerciseName}
                          onChange={e => { setSets(old => old.map(s => s.exercise_order === order ? { ...s, exercise_name: e.target.value } : s)); setSuggestions(old => { const next = { ...old }; delete next[order]; return next; }); setSuccess(""); }}
                          className={"mt-1 font-semibold " + inputClass}
                        />
                      </label>
                      <button type="button" onClick={() => removeExercise(order)} className="mt-5 inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50" aria-label={"Remove " + exerciseName + " from this workout"}>
                        <Trash2 size={16} aria-hidden="true" /> Remove
                      </button>
                    </div>
                    {suggestions[order] && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-950">
                        <span>{suggestions[order].message}</span>
                        {suggestions[order].next_weight_kg != null && (
                          <button type="button" className="rounded-lg border border-blue-300 bg-white px-3 py-2 font-semibold text-blue-800 hover:bg-blue-100" onClick={() => {
                            setSets(old => old.map(s => s.exercise_order === order ? { ...s, weight_kg: suggestions[order].next_weight_kg } : s));
                          }}>
                            Use {suggestions[order].next_weight_kg} kg
                          </button>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-[40px_1fr_1fr_1fr_38px] items-center gap-2 text-xs font-semibold text-slate-600">
                      <span>Set</span><span>kg</span><span>Reps</span><span>RIR</span><span></span>
                    </div>
                    {sets.map((set, index) => ({ set, index })).filter(({ set }) => set.exercise_order === order).map(({ set, index }) => (
                      <div key={set.set_number} className="grid grid-cols-[40px_1fr_1fr_1fr_38px] items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{set.set_number}</span>
                        <input aria-label={exerciseName + " set " + set.set_number + " weight in kilograms"} type="number" min="0" step="0.5" placeholder="BW" value={set.weight_kg ?? ""} onChange={e => changeSet(index, "weight_kg", e.target.value)} className={inputClass} />
                        <input aria-label={exerciseName + " set " + set.set_number + " repetitions"} type="number" min="0" value={set.reps} onChange={e => changeSet(index, "reps", e.target.value)} className={inputClass} />
                        <input aria-label={exerciseName + " set " + set.set_number + " reps in reserve"} type="number" min="0" max="10" placeholder="—" value={set.rir ?? ""} onChange={e => changeSet(index, "rir", e.target.value)} className={inputClass} />
                        <button type="button" onClick={() => removeSet(order, set.set_number)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-red-700" title="Remove set" aria-label={"Remove set " + set.set_number + " of " + exerciseName}>
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="text-sm font-semibold text-blue-700 hover:underline" onClick={() => {
                      setSets(old => [...old, {
                        exercise_name: old.find(s => s.exercise_order === order)?.exercise_name ?? "",
                        exercise_order: order,
                        set_number: Math.max(0, ...old.filter(s => s.exercise_order === order).map(s => s.set_number)) + 1,
                        weight_kg: null,
                        reps: 5,
                        rir: null,
                      }]);
                      setSuccess("");
                    }}>+ Add set</button>
                  </div>
                );
              })}
              <button type="button" className="font-semibold text-blue-700 hover:underline" onClick={() => {
                setSets(old => [...old, {
                  exercise_name: "New exercise",
                  exercise_order: Math.max(-1, ...old.map(s => s.exercise_order)) + 1,
                  set_number: 1,
                  weight_kg: null,
                  reps: 8,
                  rir: null,
                }]);
                setSuccess("");
              }}>+ Add exercise</button>
              {sets.length === 0 && <p className="text-sm text-slate-600">Choose a gym template or add an exercise to get started.</p>}
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Distance (km)
                <input type="number" min="0" step="0.01" value={distance} onChange={e => setDistance(e.target.value)} className={"mt-1 " + inputClass} />
              </label>
              <label className="text-sm font-medium text-slate-700">Duration (minutes)
                <input type="number" min="0" step="0.1" value={minutes} onChange={e => setMinutes(e.target.value)} className={"mt-1 " + inputClass} />
              </label>
              <label className="text-sm font-medium text-slate-700">Effort (1–10)
                <input type="number" min="1" max="10" value={effort} onChange={e => setEffort(e.target.value)} className={"mt-1 " + inputClass} />
              </label>
              <div className="self-end text-sm font-medium text-slate-700">
                {paceLabel(Number(distance) * 1000, Number(minutes) * 60) && "Pace: " + paceLabel(Number(distance) * 1000, Number(minutes) * 60)}
              </div>
            </div>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={"mt-1 " + inputClass} rows={2} />
          </label>
          {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
          {success && <p role="status" className="text-sm font-medium text-green-800">{success}</p>}
          <button
            type="button"
            disabled={busy || (type === "strength" && sets.length === 0) || (type === "run" && (!Number(distance) || !Number(minutes)))}
            onClick={save}
            className="w-full rounded-lg bg-blue-700 p-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >{busy ? "Saving…" : "Save workout"}</button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Recent workouts</h2>
          {history.length === 0 ? (
            <p className="text-slate-700">No sessions yet. Choose a gym template or log a run.</p>
          ) : (
            <div className="space-y-3">
              {history.map(session => {
                const groups = groupSets(session.exercise_sets);
                const expanded = expandedSessionId === session.id;
                return (
                  <article key={session.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={"session-details-" + session.id}
                      onClick={() => setExpandedSessionId(expanded ? null : session.id)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block text-base font-semibold text-slate-900">{session.title}</span>
                        <span className="block text-sm text-slate-700">{new Date(session.performed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span className="mt-1 block text-sm font-medium text-slate-800">
                          {session.activity_type === "run"
                            ? ((session.distance_m ?? 0) / 1000).toFixed(2) + " km · " + Math.round((session.duration_seconds ?? 0) / 60) + " min"
                            : groups.length + " exercises · " + (session.exercise_sets?.length ?? 0) + " sets"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-700">
                        {expanded ? "Hide details" : "View details"}
                        {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                      </span>
                    </button>
                    {expanded && (
                      <div id={"session-details-" + session.id} className="space-y-4 border-t border-slate-200 bg-slate-50 p-4">
                        {session.activity_type === "strength" ? groups.map((group, index) => (
                          <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
                            <h3 className="mb-2 font-semibold text-slate-900">{group.name}</h3>
                            <div className="grid grid-cols-[50px_1fr_1fr_60px] gap-2 border-b border-slate-200 pb-1 text-xs font-semibold text-slate-600">
                              <span>Set</span><span>Weight</span><span>Reps</span><span>RIR</span>
                            </div>
                            {group.sets.map(set => (
                              <div key={set.set_number} className="grid grid-cols-[50px_1fr_1fr_60px] gap-2 border-b border-slate-100 py-2 text-sm text-slate-900 last:border-0">
                                <span>{set.set_number}</span>
                                <span>{set.weight_kg == null ? "Bodyweight" : set.weight_kg + " kg"}</span>
                                <span>{set.reps}</span>
                                <span>{set.rir == null ? "—" : set.rir}</span>
                              </div>
                            ))}
                          </div>
                        )) : (
                          <div className="space-y-1 text-sm font-medium text-slate-800">
                            <p>Distance: {((session.distance_m ?? 0) / 1000).toFixed(2)} km</p>
                            <p>Duration: {Math.round((session.duration_seconds ?? 0) / 60)} minutes</p>
                            {paceLabel(session.distance_m ?? 0, session.duration_seconds ?? 0) && <p>Pace: {paceLabel(session.distance_m ?? 0, session.duration_seconds ?? 0)}</p>}
                            {session.effort != null && <p>Effort: {session.effort}/10</p>}
                          </div>
                        )}
                        {session.notes && <p className="text-sm text-slate-700"><span className="font-semibold">Notes:</span> {session.notes}</p>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
