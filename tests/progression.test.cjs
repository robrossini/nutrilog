const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

// Transpile the actual TypeScript module (not a copy) without adding a test-runner dependency.
function loadTsModule(path) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {} };
  vm.runInNewContext(compiled, context, { filename: path });
  return context.exports;
}

const { suggestWeight } = loadTsModule("lib/progression.ts");
const { defaultPlan, currentPlanWeek, mondayOf } = loadTsModule("lib/training-plan.ts");

const squat = {
  id: "squat", name: "Barbell squat", target_sets: 3, rep_min: 5, rep_max: 5, starting_weight_kg: 55,
};

function history(reps = [5, 5, 5], weights = [55, 55, 55], rirs = [2, 2, 2]) {
  return [{
    id: "session-1", title: "Gym A", activity_type: "strength", performed_at: "2026-10-13T12:00:00Z",
    exercise_sets: reps.map((reps, i) => ({
      exercise_name: "Barbell squat", exercise_order: 0, set_number: i + 1,
      weight_kg: weights[i], reps, rir: rirs[i],
    })),
  }];
}

test("starting weights do not imply an increase without history", () => {
  const result = suggestWeight(squat, []);
  assert.equal(result.weight_kg, 55);
  assert.equal(result.next_weight_kg, null);
});

test("suggest a small increase after three completed top-range sets", () => {
  const result = suggestWeight(squat, history());
  assert.equal(result.weight_kg, 55);
  assert.equal(result.next_weight_kg, 57.5);
  assert.equal(result.increased, true);
});

test("repeat load if repetitions did not reach target", () => {
  const result = suggestWeight(squat, history([5, 5, 4]));
  assert.equal(result.weight_kg, 55);
  assert.equal(result.next_weight_kg, null);
});

test("repeat load if set was taken to zero reps in reserve", () => {
  const result = suggestWeight(squat, history([5, 5, 5], [55, 55, 55], [2, 1, 0]));
  assert.equal(result.next_weight_kg, null);
});

test("do not recommend increasing mixed weights as if all sets were alike", () => {
  const result = suggestWeight(squat, history([5, 5, 5], [50, 55, 55]));
  assert.equal(result.next_weight_kg, null);
});

test("Monday-aligned plan and accurate relative week calculation", () => {
  const plan = defaultPlan("2026-10-14");
  assert.equal(plan.start_date, "2026-10-12");
  assert.equal(currentPlanWeek(plan.start_date, "2026-10-14"), 1);
  assert.equal(currentPlanWeek(plan.start_date, "2026-10-19"), 2);
  assert.equal(mondayOf("2026-10-18"), "2026-10-12");
});

test("programme contains three gyms and two runs", () => {
  const plan = defaultPlan("2026-10-14");
  assert.equal(plan.schedule.filter(d => d.activity_type === "strength").length, 3);
  assert.equal(plan.schedule.filter(d => d.activity_type === "run").length, 2);
});


test("do not reuse a different gym day's squat weights", () => {
  const completed = history([8, 8, 8], [45, 45, 45]);
  completed[0].title = "Gym C";
  completed[0].training_plan_id = "plan-1";
  completed[0].planned_day_id = "gym-c";
  const recommendation = suggestWeight(squat, completed, {
    training_plan_id: "plan-1", planned_day_id: "gym-a", title: "Gym A",
  });
  assert.equal(recommendation.weight_kg, 55);
  assert.equal(recommendation.next_weight_kg, null);
});

test("uses an earlier manually logged session with the matching workout title", () => {
  const completed = history();
  const recommendation = suggestWeight(squat, completed, {
    training_plan_id: "plan-1", planned_day_id: "gym-a", title: "Gym A",
  });
  assert.equal(recommendation.next_weight_kg, 57.5);
});
