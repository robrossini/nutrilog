# Nutrilog Mind — weekly check-ins and email reminders

This feature adds a private weekly reflection at /mind. It does not change food, exercise,
weight, onboarding or existing profile data. Ratings are intentionally neutral; the only
generic sensitive-behaviour field is "Other unwanted habits" (1–5). No specific behaviour
categories are recorded.

## Deployment steps (required before reminders will work)

1. In the Supabase project linked to the production app, back up your database, then
   run **supabase/migrations/20261104_mind_checkins.sql** in the SQL editor.
   This creates the check-ins, reminder preferences and internal send ledger with RLS.
   Do not rerun previous migrations.
2. In Vercel project settings, configure these **server-only** environment variables:
   - SUPABASE_SECRET_KEY — Supabase secret API key (sb_secret_...) from Settings > API Keys.
     The older SUPABASE_SERVICE_ROLE_KEY also works as a fallback during migration.
     Never prefix either name with NEXT_PUBLIC_.
   - CRON_SECRET — generate a strong random token. Vercel Cron uses it in Authorization.
   - RESEND_API_KEY — email sending API key from Resend.
   - MIND_REMINDER_FROM — verified sender, e.g. Nutrilog <reminders@your-verified-domain.com>.
   - APP_URL — public production HTTPS origin, e.g. https://your-app.vercel.app.
   The existing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY remain unchanged.
3. Verify the sender domain/address in Resend. A test-only Resend sender generally
   cannot send to arbitrary users. Do not commit any credentials to GitHub.
4. Deploy the branch to Vercel, test /mind and the APIs, then merge to main and deploy
   to production. Vercel production deployments register the cron in vercel.json.
5. Open /mind, sign in and **enable email reminders** (off by default). The reminder
   destination is the confirmed email attached to the signed-in Supabase account.

## Timing and completion rules

- Vercel Cron invokes GET /api/cron/mind-reminders once daily at **19:00 UTC**.
  This corresponds to 19:00 GMT in winter and 20:00 BST in summer.
  Hobby plans may execute the scheduled job within an hourly window.
- Sunday: first reminder for the Monday–Sunday week ending that day.
- Monday–Saturday: reminder for that same previous Monday–Sunday week,
  **only if it still has no check-in**.
- A save (including later edits) creates/updates a unique user/week row.
  Once a row exists, no further reminders for that week are sent.
- The following Sunday starts a new week; old missed weeks can still be
  backfilled manually, but don't generate indefinite overdue reminders.
- One reminder per user/calendar day, guarded by a unique ledger constraint.
  Cron retries for the same day do not send another message.
- Switching reminders off immediately stops future sends. Opting in is always
  voluntary; no email is sent to unconfirmed addresses.
- The email contains a link to /mind?week=YYYY-MM-DD. It contains no scores
  or private answers. The user must sign in to view and submit the form.

## Acceptance checks

1. Unauthenticated /mind redirects to /login; after login the reminder link returns
   to the originally requested week (for existing onboarded users).
2. Save a check-in; refresh and confirm all six 1–5 questions, alcohol units,
   five checkboxes and optional reflection are restored. Resaving edits that week.
3. Check that selecting another week does not overwrite the first; confirm entries
   from other users cannot be read or edited (Supabase RLS).
4. Check reminder toggle is off until enabled. Disable it and verify it persists.
5. Verify Vercel has all environment variables and the verified sender is working.
   The cron endpoint must respond 401 without its CRON_SECRET Authorization header.
6. Trigger the cron using a secure manual request with the secret in the
   Authorization header (do not expose it in browser or screenshots). Check
   provider logs for one reminder, and call it again on the same London calendar
   day to confirm no duplicate. Save the due week's entry and confirm future
   runs skip it. Then test opt-out.
7. Validate in production after merging: scheduled jobs run only for production
   deployments, not arbitrary preview builds.

## Privacy and limitations

- User data is protected by Supabase row-level security; the admin service-role
  key is used **only** in the server cron route.
- Reminder delivery ledger is server-only and records user, week and reminder date.
  No score or reflection is included in delivery logs or outgoing messages.
- Email itself exposes the fact that a weekly check-in is due. Turn reminders
  off if that is a concern; normal email privacy depends on the mail provider.
- All ratings are personal reflections, not diagnoses or clinical scores.
- The cron processes up to 500 opt-in accounts per run; add pagination/queues if
  the app grows. Delivery is best effort; downstream provider outages may delay
  one day's reminder. Never log tokens or email addresses.
