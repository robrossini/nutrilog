import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserClient, getBearerToken } from "../../../lib/supabase";
import { currentWeekStart, validWeekStart } from "../../../lib/mind";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rating = z.number().int().min(1).max(5);
const checkinSchema = z.object({
  week_start: z.string(),
  mood: rating,
  enjoyment: rating,
  concentration: rating,
  social_anxiety: rating,
  phone_usage: rating,
  unwanted_habits: rating,
  alcohol_units: z.number().finite().min(0).max(200),
  enjoyable_activities: z.boolean(),
  meaningful_social_contact: z.boolean(),
  creative_activity: z.boolean(),
  reading: z.boolean(),
  social_anxiety_practice: z.boolean(),
  reflection: z.string().max(2000).default(""),
}).strict();

async function authenticate(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return null;
  const supabase = createSupabaseUserClient(token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [checkins, reminders] = await Promise.all([
      auth.supabase.from("mind_checkins").select("*")
        .eq("user_id", auth.userId).order("week_start", { ascending: false }).limit(53),
      auth.supabase.from("mind_reminder_preferences").select("enabled")
        .eq("user_id", auth.userId).maybeSingle(),
    ]);
    if (checkins.error || reminders.error) {
      return NextResponse.json({ error: "Unable to load Mind. Apply the Mind Supabase migration first." }, { status: 503 });
    }
    return NextResponse.json({
      checkins: checkins.data ?? [],
      reminders_enabled: reminders.data?.enabled ?? false,
      current_week_start: currentWeekStart(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load Mind" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => null);
    const parsed = checkinSchema.safeParse(body);
    if (!parsed.success || !validWeekStart(parsed.data.week_start)) {
      return NextResponse.json({ error: "Please enter valid scores and a week within the last year." }, { status: 400 });
    }
    const { error } = await auth.supabase.from("mind_checkins").upsert({
      ...parsed.data,
      user_id: auth.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,week_start" });
    if (error) {
      return NextResponse.json({ error: "Unable to save check-in. Has the Mind database migration been applied?" }, { status: 503 });
    }
    return NextResponse.json({ saved: true, week_start: parsed.data.week_start });
  } catch {
    return NextResponse.json({ error: "Unable to save Mind check-in" }, { status: 500 });
  }
}
