export type PlanExercise = {
  id: string;
  name: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  starting_weight_kg: number | null;
};

export type PlanDay = {
  id: string;
  weekday: number; // Mon = 0 ... Sun = 6
  activity_type: "strength" | "run";
  title: string;
  exercises: PlanExercise[];
  target_duration_min: number | null;
  notes: string;
};

export type TrainingPlan = {
  id: string;
  name: string;
  goal: string;
  start_date: string;
  duration_weeks: number;
  status: "active" | "paused" | "archived";
  schedule: PlanDay[];
};

export type SessionForPlan = {
  id: string;
  activity_type: "strength" | "run";
  title: string;
  performed_at: string;
  training_plan_id?: string | null;
  planned_day_id?: string | null;
  planned_week?: number | null;
  exercise_sets?: {
    exercise_name: string;
    exercise_order: number;
    set_number: number;
    weight_kg: number | null;
    reps: number;
    rir: number | null;
  }[];
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function makeExercise(id: string, name: string, target_sets: number, rep_min: number, rep_max: number, starting_weight_kg: number | null): PlanExercise {
  return { id, name, target_sets, rep_min, rep_max, starting_weight_kg };
}

function strengthDay(id: string, weekday: number, title: string, exercises: PlanExercise[]): PlanDay {
  return { id, weekday, title, activity_type: "strength", exercises, target_duration_min: null, notes: "" };
}

function runDay(id: string, weekday: number, title: string): PlanDay {
  return { id, weekday, title, activity_type: "run", exercises: [], target_duration_min: 25, notes: "Easy conversational pace; use run/walk intervals if needed." };
}

export function defaultSchedule(): PlanDay[] {
  return [
    strengthDay("gym-a", 0, "Gym A", [
      makeExercise("squat", "Barbell squat", 3, 5, 5, 55),
      makeExercise("bench", "Bench press", 3, 5, 5, 52.5),
      makeExercise("pulldown", "Lat pulldown", 3, 8, 10, 47.5),
      makeExercise("rdl", "Romanian deadlift", 2, 8, 8, 45),
      makeExercise("lateral", "Lateral raise", 2, 12, 15, null),
      makeExercise("plank", "Plank", 2, 1, 1, null),
    ]),
    runDay("run-1", 1, "Easy run"),
    strengthDay("gym-b", 2, "Gym B", [
      makeExercise("deadlift", "Deadlift", 2, 5, 5, 60),
      makeExercise("incline", "Incline dumbbell press", 3, 8, 10, 16),
      makeExercise("row", "Seated cable row", 3, 10, 10, 40),
      makeExercise("leg-press", "Leg press", 3, 10, 10, null),
      makeExercise("curl", "Biceps curl", 2, 12, 12, null),
      makeExercise("pushdown", "Triceps pushdown", 2, 12, 12, null),
    ]),
    strengthDay("gym-c", 4, "Gym C", [
      makeExercise("squat", "Barbell squat", 3, 8, 8, 45),
      makeExercise("bench", "Bench press", 3, 8, 8, 45),
      makeExercise("supported-row", "Chest-supported row", 3, 10, 10, null),
      makeExercise("leg-curl", "Leg curl", 3, 12, 12, null),
      makeExercise("shoulder-press", "Shoulder press", 2, 10, 10, null),
      makeExercise("calf", "Calf raise", 3, 15, 15, null),
    ]),
    runDay("run-2", 5, "Easy run"),
  ];
}

export function localISODate(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

// Programme starts on a Monday so its weekly schedule stays aligned.
export function mondayOf(dateString: string): string {
  const date = new Date(dateString + "T12:00:00Z");
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

export function defaultPlan(today: string = localISODate()) {
  return {
    name: "16-week lean bulk",
    goal: "Build strength and muscle while rebuilding an easy 5K",
    start_date: mondayOf(today),
    duration_weeks: 16,
    status: "active" as const,
    schedule: defaultSchedule(),
  };
}

export function currentPlanWeek(start_date: string, now: string = localISODate()): number {
  const from = Date.parse(start_date + "T12:00:00Z");
  const to = Date.parse(now + "T12:00:00Z");
  return Math.floor((to - from) / (7 * 86400000)) + 1;
}

export function plannedWorkoutCompleted(session: SessionForPlan, plan: TrainingPlan, day: PlanDay, week: number): boolean {
  return session.training_plan_id === plan.id && session.planned_day_id === day.id && session.planned_week === week;
}
