const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("lib/progress.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {}, Date, Map, Number, String };
vm.runInNewContext(compiled, context, { filename: "lib/progress.ts" });
const { dailyNutrition, exerciseNames, strengthSeries, runSeries } = context.exports;

test("sums food by day without fabricating days with zero intake", () => {
  const result = dailyNutrition([
    { logged_at: "2026-10-15T11:00:00Z", calories: 450, protein_g: 20, carbs_g: 45, fat_g: 10 },
    { logged_at: "2026-10-15T17:00:00Z", calories: 700, protein_g: 35, carbs_g: 70, fat_g: 20 },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].calories, 1150);
  assert.equal(result[0].protein, 55);
});

test("strength shows the top completed set for a day, ignoring zero reps and unweighted rows", () => {
  const sessions = [{
    id: "s1", activity_type: "strength", title: "Gym A", performed_at: "2026-10-15T12:00:00Z",
    exercise_sets: [
      { exercise_name: "Bench press", weight_kg: 60, reps: 5 },
      { exercise_name: "BENCH PRESS", weight_kg: 65, reps: 0 },
      { exercise_name: "Bench press", weight_kg: 62.5, reps: 4 },
      { exercise_name: "Plank", weight_kg: null, reps: 1 },
    ],
  }];
  assert.equal(exerciseNames(sessions).length, 2);
  const result = strengthSeries(sessions, "bench press");
  assert.equal(result.length, 1);
  assert.equal(result[0].weight, 62.5);
  assert.equal(result[0].reps, 4);
});

test("only runs with actual distance and duration yield pace", () => {
  const sessions = [
    { id: "a", activity_type: "run", performed_at: "2026-10-15T10:00:00Z", distance_m: 4000, duration_seconds: 1800 },
    { id: "b", activity_type: "run", performed_at: "2026-10-14T10:00:00Z", distance_m: 0, duration_seconds: 1500 },
    { id: "c", activity_type: "strength", performed_at: "2026-10-13T10:00:00Z", distance_m: null, duration_seconds: null },
  ];
  const result = runSeries(sessions);
  assert.equal(result.length, 1);
  assert.equal(result[0].distance, 4);
  assert.equal(result[0].pace, 7.5);
});
