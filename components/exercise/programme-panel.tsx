"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PlanDay, SessionForPlan, TrainingPlan } from "../../lib/training-plan";
import { currentPlanWeek, localISODate, plannedWorkoutCompleted, WEEKDAYS } from "../../lib/training-plan";

type Props = {
  token: string;
  history: SessionForPlan[];
  onStart: (day: PlanDay, plan: TrainingPlan, week: number) => void;
};

function scheduledDate(monday: string, week: number, weekday: number): string {
  const date = new Date(monday + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + (week - 1) * 7 + weekday);
  return date.toISOString().slice(0, 10);
}

export function ProgrammePanel({ token, history, onStart }: Props) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/exercise/plan", { headers: { Authorization: "Bearer " + token } })
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Cannot load programme");
        return json;
      })
      .then(json => { if (!cancelled) { setPlan(json.plan ?? null); setError(""); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load training plan"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const week = plan ? currentPlanWeek(plan.start_date) : 1;
  const displayWeek = plan ? Math.max(1, Math.min(plan.duration_weeks, week)) : 1;
  const days = useMemo(() => plan ? [...plan.schedule].sort((a, b) => a.weekday - b.weekday) : [], [plan]);
  const done = plan ? days.filter(day => history.some(session => plannedWorkoutCompleted(session, plan, day, displayWeek))) : [];
  const nextDay = days.find(day => !done.some(d => d.id === day.id));

  function select(day: PlanDay) {
    if (!plan || plan.status !== "active" || week < 1 || week > plan.duration_weeks) return;
    onStart(day, plan, displayWeek);
    document.getElementById("workout-logger")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Training programme">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Your programme</h2>
          <p className="text-sm text-slate-700">Planned workouts are suggestions, not obligations. Move or adjust them as needed.</p>
        </div>
        <Link href="/exercise/plan" className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">Edit programme</Link>
      </div>
      {loading ? <p className="text-sm text-slate-700">Loading schedule…</p> : error ? (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          {error} <Link href="/exercise/plan" className="underline">Open programme setup</Link>
        </p>
      ) : !plan ? (
        <div className="rounded-lg bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-950">Start with an editable 16-week plan</h3>
          <p className="mt-1 text-sm text-blue-900">Three gym sessions and two easy runs each week. Choose the dates, move sessions, and edit every exercise before activating.</p>
          <Link href="/exercise/plan" className="mt-3 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Set up your plan</Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-900">{plan.name}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{plan.status === "paused" ? "Paused" : week < 1 ? "Starts soon" : week > plan.duration_weeks ? "Programme finished" : "Week " + week + " of " + plan.duration_weeks}</span>
            <span className="font-medium text-slate-700">{done.length} / {days.length} sessions logged for week {displayWeek}</span>
          </div>
          {plan.status === "active" && week >= 1 && week <= plan.duration_weeks && nextDay && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 p-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Next suggested session</p>
                <p className="font-semibold text-blue-950">{nextDay.title} — {WEEKDAYS[nextDay.weekday]}</p>
              </div>
              <button type="button" onClick={() => select(nextDay)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Start this workout</button>
            </div>
          )}
          {plan.status === "paused" && <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">Programme paused. Resume it in Edit programme to start planned sessions. Manual logging is still available below.</p>}
          {week < 1 && <p className="text-sm text-slate-700">Your programme begins on {new Date(plan.start_date + "T12:00:00Z").toLocaleDateString("en-GB")}. You can still log unscheduled workouts.</p>}
          {week > plan.duration_weeks && <p className="text-sm text-slate-700">You've reached the end of this programme. Review or archive it in Edit programme to start another.</p>}
          <div className="space-y-2">
            {days.map(day => {
              const complete = done.some(d => d.id === day.id);
              const date = scheduledDate(plan.start_date, displayWeek, day.weekday);
              return (
                <div key={day.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-semibold text-slate-900">{day.title}</p>
                    <p className="text-sm text-slate-700">
                      {WEEKDAYS[day.weekday]}, {new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" · "}{day.activity_type === "strength" ? day.exercises.length + " exercises" : (day.target_duration_min ? day.target_duration_min + " min suggested" : "Easy run")}
                    </p>
                    {day.notes && <p className="mt-1 text-xs text-slate-600">{day.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {complete && <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-800">Logged</span>}
                    {plan.status === "active" && week >= 1 && week <= plan.duration_weeks && <button type="button" onClick={() => select(day)} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">{complete ? "Log again" : "Start"}</button>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-600">Week 1–2: consider slightly fewer sets and keep several reps in reserve as you build consistency. Weight suggestions are optional and should not override how you feel.</p>
        </>
      )}
    </section>
  );
}
