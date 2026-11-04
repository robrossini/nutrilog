import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dueWeekStart, londonDate } from "../../../../lib/mind";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.MIND_REMINDER_FROM;
  const appUrl = process.env.APP_URL;
  if (!url || !serviceKey || !resendKey || !from || !appUrl) {
    return NextResponse.json({ error: "Reminder service is not configured" }, { status: 503 });
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(appUrl);
    if (baseUrl.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    return NextResponse.json({ error: "APP_URL must be an HTTPS URL" }, { status: 503 });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const day = londonDate();
  const week = dueWeekStart(day);
  const { data: users, error } = await admin.from("mind_reminder_preferences")
    .select("user_id").eq("enabled", true).limit(500);
  if (error) return NextResponse.json({ error: "Unable to read reminders" }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const user of users ?? []) {
    // A saved entry suppresses every subsequent reminder for that week.
    const { data: checkin, error: checkError } = await admin.from("mind_checkins")
      .select("id").eq("user_id", user.user_id).eq("week_start", week).maybeSingle();
    if (checkError) { failed++; continue; }
    if (checkin) { skipped++; continue; }

    // Claim today's reminder BEFORE sending. Unique key prevents duplicate cron deliveries.
    const { data: claim, error: claimError } = await admin.from("mind_reminder_deliveries")
      .insert({ user_id: user.user_id, week_start: week, reminder_date: day })
      .select("id").single();
    if (claimError || !claim) {
      if (claimError?.code === "23505") skipped++;
      else failed++;
      continue;
    }
    let delivered = false;
    try {
      // Respect a late opt-out or last-second check-in.
      const [preference, latest] = await Promise.all([
        admin.from("mind_reminder_preferences").select("enabled").eq("user_id", user.user_id).maybeSingle(),
        admin.from("mind_checkins").select("id").eq("user_id", user.user_id).eq("week_start", week).maybeSingle(),
      ]);
      if (preference.error || latest.error) throw new Error("Unable to reconfirm reminder state");
      if (!preference.data?.enabled || latest.data) {
        skipped++;
        await admin.from("mind_reminder_deliveries").delete().eq("id", claim.id);
        continue;
      }

      const { data: auth, error: authError } = await admin.auth.admin.getUserById(user.user_id);
      if (authError || !auth.user?.email || !auth.user.email_confirmed_at) {
        skipped++;
        await admin.from("mind_reminder_deliveries").delete().eq("id", claim.id);
        continue;
      }
      const link = new URL("/mind?week=" + encodeURIComponent(week), baseUrl).toString();
      const subject = "Your Nutrilog weekly check-in";
      // No check-in ratings, sensitive labels, or answers are ever included in email.
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + resendKey,
          "Content-Type": "application/json",
          "Idempotency-Key": "nutrilog-mind-" + user.user_id + "-" + day,
        },
        body: JSON.stringify({
          from,
          to: [auth.user.email],
          subject,
          text: "A quick reminder to complete your weekly check-in.\n\n" + link + "\n\nYou can turn reminders off in Nutrilog Mind.",
          html: '<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;color:#1f2937">' +
            '<h2>Nutrilog weekly check-in</h2>' +
            '<p>Your weekly check-in is ready. It takes about two minutes.</p>' +
            '<p><a href="' + link + '">Complete your check-in</a></p>' +
            '<p style="color:#6b7280;font-size:13px">Already completed it? You will not receive further reminders for that week. You can turn reminders off in Nutrilog Mind.</p></div>',
        }),
      });
      if (!response.ok) throw new Error("Email provider rejected reminder");
      delivered = true;
      const { error: markError } = await admin.from("mind_reminder_deliveries")
        .update({ sent_at: new Date().toISOString() }).eq("id", claim.id);
      if (markError) throw new Error("Unable to mark reminder delivered");
      sent++;
    } catch {
      failed++;
      // If email may already have sent, retain claim to avoid a duplicate.
      if (!delivered) await admin.from("mind_reminder_deliveries").delete().eq("id", claim.id);
    }
  }
  return NextResponse.json({ date: day, week_start: week, sent, skipped, failed }, {
    headers: { "Cache-Control": "no-store" },
  });
}
