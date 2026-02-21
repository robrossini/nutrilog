import { NextResponse } from "next/server";
import { createSupabaseUserClient, getBearerToken } from "../../../lib/supabase";

export const runtime = "nodejs";

const ALLOWED_GOALS = ["lose_weight", "build_muscle", "maintain"] as const;
const ALLOWED_SEX = ["male", "female", "other", "prefer_not_to_say"] as const;
const ALLOWED_ACTIVITY = ["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"] as const;
type GoalType = (typeof ALLOWED_GOALS)[number];

function sanitizeNumber(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getAuthedUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const supabase = createSupabaseUserClient(token);
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userErr || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user };
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("error" in auth) return auth.error;
    const { supabase, user } = auth;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data) {
      const bootstrap = {
        id: user.id,
        email: user.email,
        display_name:
          (user.user_metadata?.display_name as string | undefined) ||
          user.email?.split("@")[0] ||
          null,
        daily_calorie_target: 2000,
        protein_target_g: 150,
        carbs_target_g: 180,
        fat_target_g: 70,
      sex: "prefer_not_to_say",
      activity_level: "moderately_active",
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("profiles")
        .upsert(bootstrap, { onConflict: "id" })
        .select("*")
        .single();

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
      return NextResponse.json({ profile: inserted });
    }

    return NextResponse.json({ profile: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if ("error" in auth) return auth.error;
    const { supabase, user } = auth;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const goal = body.goal_type;
    if (goal != null && !ALLOWED_GOALS.includes(goal as GoalType)) {
      return NextResponse.json({ error: "Invalid goal_type" }, { status: 400 });
    }

    const sex = body.sex;
    if (sex != null && !ALLOWED_SEX.includes(sex)) {
      return NextResponse.json({ error: "Invalid sex" }, { status: 400 });
    }

    const activity = body.activity_level;
    if (activity != null && !ALLOWED_ACTIVITY.includes(activity)) {
      return NextResponse.json({ error: "Invalid activity_level" }, { status: 400 });
    }

    const payload: Record<string, any> = {
      id: user.id,
      email: user.email,
      display_name: typeof body.display_name === "string" ? body.display_name.trim() || null : undefined,
      daily_calorie_target: sanitizeNumber(body.daily_calorie_target),
      protein_target_g: sanitizeNumber(body.protein_target_g),
      carbs_target_g: sanitizeNumber(body.carbs_target_g),
      fat_target_g: sanitizeNumber(body.fat_target_g),
      age: sanitizeNumber(body.age),
      height_cm: sanitizeNumber(body.height_cm),
      weight_kg: sanitizeNumber(body.weight_kg),
      goal_type: goal ?? null,
      target_weight_change_kg: sanitizeNumber(body.target_weight_change_kg),
      sex: sex ?? null,
      activity_level: activity ?? null,
      target_recommendation_notes:
        typeof body.target_recommendation_notes === "string"
          ? body.target_recommendation_notes
          : null,
    };

    const hasCore = !!(
      payload.age &&
      payload.height_cm &&
      payload.weight_kg &&
      payload.goal_type &&
      payload.sex &&
      payload.activity_level
    );
    const needsTargetChange = payload.goal_type === "lose_weight" || payload.goal_type === "build_muscle";
    const hasTargetChange = !needsTargetChange || !!payload.target_weight_change_kg;
    const hasMacros = !!(
      payload.daily_calorie_target &&
      payload.protein_target_g &&
      payload.carbs_target_g &&
      payload.fat_target_g
    );

    if (hasCore && hasTargetChange && hasMacros) {
      payload.onboarding_completed_at = body.onboarding_completed_at || new Date().toISOString();
    } else if ("onboarding_completed_at" in body) {
      payload.onboarding_completed_at = null;
    }

    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ profile: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
