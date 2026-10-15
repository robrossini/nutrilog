import { NextRequest, NextResponse } from "next/server";
import { createSupabaseUserClient, getBearerToken } from "../../../lib/supabase";
import { isValidWeighIn } from "../../../lib/progress";

export const runtime = "nodejs";

async function authenticate(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return null;
  const supabase = createSupabaseUserClient(token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch 90 days of source records; group into local calendar days in the browser.
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 90);
    const sinceISO = since.toISOString();
    const sinceDate = sinceISO.slice(0, 10);

    const [profile, meals, sessions, weights] = await Promise.all([
      auth.supabase.from("profiles")
        .select("daily_calorie_target,protein_target_g,carbs_target_g,fat_target_g,weight_kg")
        .eq("id", auth.user.id).maybeSingle(),
      auth.supabase.from("meals")
        .select("logged_at,calories,protein_g,carbs_g,fat_g")
        .eq("user_id", auth.user.id).gte("logged_at", sinceISO)
        .order("logged_at", { ascending: false }).limit(1000),
      auth.supabase.from("exercise_sessions")
        .select("id,activity_type,title,performed_at,duration_seconds,distance_m,exercise_sets(exercise_name,weight_kg,reps)")
        .eq("user_id", auth.user.id).gte("performed_at", sinceISO)
        .order("performed_at", { ascending: false }).limit(500),
      auth.supabase.from("bodyweight_entries")
        .select("recorded_on,weight_kg")
        .eq("user_id", auth.user.id).gte("recorded_on", sinceDate)
        .order("recorded_on", { ascending: true }).limit(100),
    ]);

    if (weights.error) {
      // Make an uninstalled Phase 3 migration distinguishable from an empty weigh-in history.
      return NextResponse.json({ error: "Unable to load weigh-ins. Check that the Phase 3 bodyweight migration has been applied." }, { status: 503 });
    }
    if (profile.error || meals.error || sessions.error) {
      return NextResponse.json({ error: "Unable to load progress data" }, { status: 500 });
    }
    return NextResponse.json({
      profile: profile.data,
      meals: meals.data ?? [],
      sessions: sessions.data ?? [],
      weights: weights.data ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Unable to load progress data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => null);
    const date = body?.recorded_on;
    const weight = body?.weight_kg;
    if (!isValidWeighIn(date, weight)) {
      return NextResponse.json({ error: "Enter a valid date and weight between 30 and 300 kg." }, { status: 400 });
    }
    // A check-in is only for today or earlier, with a small allowance for local/UTC offset.
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (date > tomorrow.toISOString().slice(0, 10)) {
      return NextResponse.json({ error: "Weigh-in date cannot be in the future." }, { status: 400 });
    }
    const { error } = await auth.supabase.from("bodyweight_entries")
      .upsert({ user_id: auth.user.id, recorded_on: date, weight_kg: weight },
        { onConflict: "user_id,recorded_on" });
    if (error) return NextResponse.json({ error: "Unable to save weigh-in. Has the Phase 3 migration been applied?" }, { status: 500 });

    // Keep the current profile weight in step with a check-in made for today.
    const today = new Date().toISOString().slice(0, 10);
    if (date === today) {
      const { error: profileError } = await auth.supabase.from("profiles")
        .update({ weight_kg: weight }).eq("id", auth.user.id);
      if (profileError) {
        return NextResponse.json({ error: "Weigh-in saved, but profile weight could not be updated." }, { status: 500 });
      }
    }
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Unable to save weigh-in" }, { status: 500 });
  }
}
