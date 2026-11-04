const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(fs.readFileSync("lib/mind.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const context = { exports: {}, Date, Intl, Number, String };
vm.runInNewContext(compiled, context, { filename: "lib/mind.ts" });
const { mondayOf, dueWeekStart, validWeekStart, currentWeekStart, londonDate } = context.exports;

test("a Sunday reminder targets the Monday of the week that just ended", () => {
  assert.equal(dueWeekStart("2026-11-08"), "2026-11-02");
  assert.equal(dueWeekStart("2026-11-15"), "2026-11-09");
});
test("the following Monday through Saturday still target the previous week", () => {
  assert.equal(dueWeekStart("2026-11-09"), "2026-11-02");
  assert.equal(dueWeekStart("2026-11-14"), "2026-11-02");
});
test("Monday and Sunday are grouped into the same week", () => {
  assert.equal(mondayOf("2026-11-02"), "2026-11-02");
  assert.equal(mondayOf("2026-11-08"), "2026-11-02");
});
test("current week uses London local calendar date around DST", () => {
  assert.equal(londonDate(new Date("2026-07-05T23:30:00Z")), "2026-07-06");
  assert.equal(currentWeekStart(new Date("2026-07-05T23:30:00Z")), "2026-07-06");
  assert.equal(londonDate(new Date("2026-11-01T00:30:00Z")), "2026-11-01");
});
test("rejects malformed, non-Monday and future week start", () => {
  const now = new Date("2026-11-04T16:00:00Z");
  assert.equal(validWeekStart("2026-11-02", now), true);
  assert.equal(validWeekStart("2026-10-26", now), true);
  assert.equal(validWeekStart("2026-11-03", now), false);
  assert.equal(validWeekStart("2026-11-09", now), false);
  assert.equal(validWeekStart("2026-02-30", now), false);
  assert.equal(validWeekStart("2025-08-04", now), false);
});
