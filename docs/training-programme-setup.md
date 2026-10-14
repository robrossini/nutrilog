# Training programme (Phase 2): deploy and acceptance tests

## Prerequisites

- Phase 1 exercise tables are already installed (20261014_exercise_logging.sql).
- NutriLog Vercel Preview is connected to the **same** Supabase project as the original exercise logger.
- Back up your Supabase database first. Keep all credentials private.

## Database migration (one new SQL file)

In Supabase > SQL Editor, review and run only:

\`supabase/migrations/20261014_training_programmes.sql\`

**Do not rerun the earlier exercise-logging migration.**

This adds \`training_plans\`, plus three **nullable** references on \`exercise_sessions\` to identify the associated plan, day and week. It does not remove your existing exercises, workouts or nutrition records. Existing workout history remains intact.

Check Table Editor for \`training_plans\`, and verify \`exercise_sessions\` has \`training_plan_id\`, \`planned_day_id\`, and \`planned_week\`.

The plan table uses Supabase RLS with a per-user ownership policy. Planned workout API writes verify the plan belongs to the authenticated user; no service-role access is used.

## Preview acceptance checklist

1. Visit the latest PR preview in Vercel. Open Exercise.
2. Under **Your programme**, click **Set up your plan**.
3. Confirm the suggested 16-week template shows Monday Gym A, Tuesday run, Wednesday Gym B, Friday Gym C, Saturday run.
4. Edit an exercise weight and rep range, change a scheduled day, and save.
5. Return to Exercise and confirm the week, planned sessions, and **Next suggested session** appear.
6. Start Gym A. Verify planned sets appear with **0 achieved reps** rather than fabricated completed reps.
7. Check that previous Gym A loads are prefilled, but Gym C weights are not incorrectly substituted.
8. Enter actual reps. Check a suggested increase must be manually accepted via **Use ... kg**.
9. Save, refresh, and confirm that only the chosen plan day is shown as logged, with the full historical sets preserved.
10. Return to Edit programme, change an exercise or move a day, save and verify the earlier completed workout remains unchanged.
11. Pause programme; planned-session Start buttons should be unavailable while manual logging still works. Resume it in Edit programme.
12. Check a planned run, distance/duration and running history.
13. Confirm the original nutrition dashboard, onboarding and meal logging are unchanged.

## Automated checks

GitHub Actions runs \`npx tsc --noEmit\`, \`node --test tests/progression.test.cjs\`, and \`npm run build\`. A green run verifies compilation and deterministic progression rules; it does **not** replace the Supabase integration and browser tests above.

## Known limitations

- Plans are weekly templates; moving a workout for a *single week* without changing the template and marking a day intentionally skipped are not yet dedicated actions. You can manually choose any workout day and log it on another date.
- In-progress workout autosave, historical session editing and wearable integrations are not yet implemented.
- Load suggestions are conservative heuristics, not individualised medical/exercise advice. Adjust for technique, fatigue, pain and equipment increments.
- Training plan and workout writes are separate operations; there is not yet an atomic database transaction for a whole session with its sets.
- The exercise history request currently returns only the 100 most recent sessions; progression uses available returned history.

Keep the pull request in draft until you have tested the Vercel Preview after the new SQL migration.
