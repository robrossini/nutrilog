// Shared data transformations for the Phase 3 dashboard. No synthetic zeros for unlogged days.
export type ProgressMeal = {
  logged_at: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};
export type ProgressSet = { exercise_name: string; weight_kg: number | null; reps: number | null };
export type ProgressSession = {
  id: string;
  activity_type: "strength" | "run";
  performed_at: string;
  title: string;
  duration_seconds: number | null;
  distance_m: number | null;
  exercise_sets: ProgressSet[] | null;
};
export type ProgressWeight = { recorded_on: string; weight_kg: number };

export function localDay(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") +
    "-" + String(date.getDate()).padStart(2, "0");
}

export function dateDaysAgo(days: number, today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return localDay(d.toISOString());
}

export function dailyNutrition(meals: ProgressMeal[]) {
  const byDay = new Map<string, { date: string; calories: number; protein: number; carbs: number; fat: number }>();
  for (const meal of meals) {
    const date = localDay(meal.logged_at);
    if (!date) continue;
    const day = byDay.get(date) ?? { date, calories: 0, protein: 0, carbs: 0, fat: 0 };
    day.calories += Number(meal.calories) || 0;
    day.protein += Number(meal.protein_g) || 0;
    day.carbs += Number(meal.carbs_g) || 0;
    day.fat += Number(meal.fat_g) || 0;
    byDay.set(date, day);
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function exerciseNames(sessions: ProgressSession[]): string[] {
  const found = new Map<string, string>();
  for (const session of sessions) {
    if (session.activity_type !== "strength") continue;
    for (const set of session.exercise_sets ?? []) {
      const name = (set.exercise_name ?? "").trim();
      if (name && !found.has(name.toLowerCase())) found.set(name.toLowerCase(), name);
    }
  }
  return Array.from(found.values()).sort((a, b) => a.localeCompare(b));
}

export function strengthSeries(sessions: ProgressSession[], exercise: string) {
  const byDay = new Map<string, { date: string; weight: number; reps: number }>();
  for (const session of sessions) {
    if (session.activity_type !== "strength") continue;
    const date = localDay(session.performed_at);
    if (!date) continue;
    for (const set of session.exercise_sets ?? []) {
      const load = Number(set.weight_kg);
      if (set.exercise_name?.trim().toLowerCase() !== exercise.toLowerCase() ||
          set.weight_kg == null || !Number.isFinite(load) || load <= 0 ||
          !set.reps || set.reps <= 0) continue;
      const prior = byDay.get(date);
      if (!prior || load > prior.weight || (load === prior.weight && set.reps > prior.reps)) {
        byDay.set(date, { date, weight: load, reps: set.reps });
      }
    }
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function runSeries(sessions: ProgressSession[]) {
  return sessions
    .filter(s => s.activity_type === "run" && Number(s.distance_m) > 0 && Number(s.duration_seconds) > 0)
    .map(s => ({
      id: s.id,
      date: localDay(s.performed_at),
      distance: Number(s.distance_m) / 1000,
      pace: Number(s.duration_seconds) / 60 / (Number(s.distance_m) / 1000),
    }))
    .filter(s => s.date !== "" && Number.isFinite(s.pace))
    .sort((a, b) => a.date.localeCompare(b.date));
}
