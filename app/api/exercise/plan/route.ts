import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserClient, getBearerToken } from "../../../../lib/supabase";

const exerciseSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
  target_sets: z.number().int().min(1).max(12),
  rep_min: z.number().int().min(1).max(100),
  rep_max: z.number().int().min(1).max(100),
  starting_weight_kg: z.number().min(0).max(1000).nullable(),
}).refine(x => x.rep_max >= x.rep_min, "Rep maximum must be at least the minimum");

const daySchema = z.object({
  id: z.string().trim().min(1).max(60),
  weekday: z.number().int().min(0).max(6),
  activity_type: z.enum(["strength", "run"]),
  title: z.string().trim().min(1).max(120),
  exercises: z.array(exerciseSchema).max(25),
  target_duration_min: z.number().int().min(1).max(600).nullable(),
  notes: z.string().max(1000),
}).refine(day => day.activity_type !== "strength" || day.exercises.length > 0, "Gym days must have exercises");

const planSchema = z.object({
  name: z.string().trim().min(1).max(120),
  goal: z.string().trim().max(600),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  duration_weeks: z.number().int().min(1).max(52),
  status: z.enum(["active", "paused", "archived"]),
  schedule: z.array(daySchema).min(1).max(14),
}).superRefine((plan, ctx) => {
  if (!Number.isFinite(Date.parse(plan.start_date + "T12:00:00Z")) ||
      new Date(plan.start_date + "T12:00:00Z").toISOString().slice(0, 10) !== plan.start_date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid start date", path: ["start_date"] });
  }
  if (new Date(plan.start_date + "T12:00:00Z").getUTCDay() !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Plan must start on Monday", path: ["start_date"] });
  }
  const ids = plan.schedule.map(d => d.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each workout needs a distinct ID", path: ["schedule"] });
  }
});

async function authenticated(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return null;
  const supabase = createSupabaseUserClient(token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticated(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await auth.supabase
      .from("training_plans")
      .select("id,name,goal,start_date,duration_weeks,status,schedule")
      .eq("user_id", auth.user.id)
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load training plan. Has the training programme SQL migration been applied?" }, { status: 503 });
    return NextResponse.json({ plan: data ?? null });
  } catch {
    return NextResponse.json({ error: "Unable to load plan" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticated(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => null);
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    if (parsed.data.status === "archived") return NextResponse.json({ error: "Cannot create an archived plan" }, { status: 400 });
    const { data, error } = await auth.supabase
      .from("training_plans")
      .insert({ ...parsed.data, user_id: auth.user.id })
      .select("id,name,goal,start_date,duration_weeks,status,schedule")
      .single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Archive your current programme before creating another." : "Unable to save plan. Check that the training programme migration is installed." }, { status: error.code === "23505" ? 409 : 500 });
    return NextResponse.json({ plan: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create plan" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await authenticated(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => null);
    const id = z.string().uuid().safeParse(body?.id);
    const parsed = planSchema.safeParse(body);
    if (!id.success || !parsed.success) return NextResponse.json({ error: !parsed.success ? parsed.error.flatten() : "Invalid plan ID" }, { status: 400 });
    const { data, error } = await auth.supabase
      .from("training_plans")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id.data)
      .eq("user_id", auth.user.id)
      .select("id,name,goal,start_date,duration_weeks,status,schedule")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to update plan" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json({ plan: data });
  } catch {
    return NextResponse.json({ error: "Unable to update plan" }, { status: 500 });
  }
}
