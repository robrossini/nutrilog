import type { PlanExercise, SessionForPlan } from "./training-plan";

export type WeightSuggestion = {
  weight_kg: number | null;
  next_weight_kg: number | null;
  message: string;
  increased: boolean;
};

function incrementForExercise(name: string): number {
  // Dumbbell movements: per-dumbbell increments; conservative and adjustable.
  if (/dumbbell|lateral raise|biceps curl/i.test(name)) return 1;
  return 2.5;
}

export function suggestWeight(
  exercise: PlanExercise,
  history: SessionForPlan[],
  workout?: { training_plan_id: string; planned_day_id: string; title: string }
): WeightSuggestion {
  const sorted = [...history].sort((a, b) => b.performed_at.localeCompare(a.performed_at));
  const recent = sorted.find(session => {
    if (session.activity_type !== "strength" ||
        !(session.exercise_sets ?? []).some(s => s.exercise_name.toLowerCase() === exercise.name.toLowerCase())) return false;
    if (!workout) return true;
    // Prevent a lighter squat variation on Gym C from overwriting Gym A's working weight.
    const plannedMatch = session.training_plan_id === workout.training_plan_id &&
      session.planned_day_id === workout.planned_day_id;
    const earlierManualMatch = !session.training_plan_id &&
      session.title.toLowerCase() === workout.title.toLowerCase();
    return plannedMatch || earlierManualMatch;
  });
  const oldSets = (recent?.exercise_sets ?? [])
    .filter(s => s.exercise_name.toLowerCase() === exercise.name.toLowerCase())
    .sort((a, b) => a.set_number - b.set_number);

  const weighted = oldSets.filter(s => s.weight_kg !== null && s.weight_kg > 0);
  if (!weighted.length) {
    return {
      weight_kg: exercise.starting_weight_kg,
      next_weight_kg: null,
      message: exercise.starting_weight_kg == null ? "No previous weight. Choose a comfortable starting load." : "Starting estimate — adjust as needed.",
      increased: false,
    };
  }
  const lastWeight = weighted[weighted.length - 1].weight_kg!;
  const comparable = weighted.filter(s => Math.abs((s.weight_kg ?? 0) - lastWeight) < 0.001);
  const allRepsReached = comparable.length >= exercise.target_sets &&
    comparable.slice(-exercise.target_sets).every(s => s.reps >= exercise.rep_max && (s.rir == null || s.rir >= 1));
  const consistentWorkingWeights = comparable.length === weighted.length;
  const goodToIncrease = allRepsReached && consistentWorkingWeights;
  const step = incrementForExercise(exercise.name);

  return {
    weight_kg: lastWeight,
    next_weight_kg: goodToIncrease ? Math.round((lastWeight + step) * 100) / 100 : null,
    message: goodToIncrease
      ? "You met the rep target last time. Consider +" + step + " kg if technique and recovery feel good."
      : "Repeat the last working weight, aiming for " + exercise.rep_min + "–" + exercise.rep_max + " reps.",
    increased: goodToIncrease,
  };
}
