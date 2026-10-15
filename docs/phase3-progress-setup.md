# Phase 3: progress dashboard — setup & checks

Phase 3 adds a progress view at `/progress`, linked from the food diary and exercise logger.

## Before preview testing

1. Confirm the Phase 1 exercise and Phase 2 programme tables already exist in the same Supabase project that Vercel uses.
2. Back up the Supabase database.
3. In the Supabase SQL Editor, review and run **only** `supabase/migrations/20261015_bodyweight_entries.sql` for this phase.
   - It creates `bodyweight_entries` with one dated entry per user/day, and enables row-level security.
   - It does not edit or remove your existing meals, exercise sessions, programmes or profile.
   - You do not need to rerun Phase 1 or Phase 2 SQL.
4. Open the PR's Vercel preview. The progress page is not usable until this migration is run, and the API will show a specific error when it is missing.

## Acceptance checks

- Visit `/progress` after signing in, then try the 7 / 30 / 90-day selector.
- Verify gym workouts and runs reflect existing saved sessions, not planned but unperformed workouts.
- Confirm exercise selector and strength trends show the heaviest completed set each day, not planned or zero-rep sets. Reps are shown in the tooltip.
- Confirm a recorded run shows distance and latest pace. The charts deliberately combine outdoor/treadmill data.
- Confirm calorie and protein summaries use meal logs. A day with no entries is not treated as a zero-calorie day; partially logged days are included and the note explains this.
- Save a bodyweight check-in, refresh, and verify it persists. Save another for the same date and verify it updates, without duplicates.
- Confirm a check-in entered for today updates the current profile weight. Historical backfills do not overwrite it.
- Sign out and confirm `/progress` redirects to login. A different user should see only their own records.
- Verify existing meal logging and exercise tracking still work.

## Scope and caveats

- All charts use up to 90 days of data, and current (not historical) targets.
- Recharts show working-set weights rather than estimated one-rep maxima. Comparing different rep ranges directly can be misleading.
- This phase does not infer missing food entries, coach the user, or import data from wearables.
- The API limits its 90-day response to 1,000 meals, 500 workouts and 100 weigh-ins. If usage grows beyond those limits, pagination will be required.
- Frontend timezone controls chart grouping; near-midnight UTC dates may differ from the server's date. Today's profile-weight sync is currently based on UTC date.
- The Phase 3 migration is required. Do not merge into production until Supabase is ready and the preview is checked.
