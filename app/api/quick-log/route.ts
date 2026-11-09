import { NextResponse } from "next/server";
import { createSupabaseUserClient, getBearerToken } from "../../../lib/supabase";

export const runtime = "nodejs";

async function authorized(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;
  const db = createSupabaseUserClient(token);
  const { data, error } = await db.auth.getUser();
  return error || !data.user ? null : { db, userId: data.user.id };
}

export async function GET(req: Request) {
  try {
    const auth = await authorized(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await auth.db.from("meals")
      .select("id,raw_input,meal_name,calories,protein_g,carbs_g,fat_g,logged_at")
      .eq("user_id", auth.userId).order("logged_at", { ascending: false }).limit(200);
    if (error) throw error;
    const seen = new Set<string>();
    const meals = (data || []).filter(m => {
      const key = (m.meal_name || m.raw_input || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    });
    return NextResponse.json({ meals });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load history" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authorized(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const sourceId = body?.sourceId;
    const multiplier = Number(body?.multiplier ?? 1);
    if (typeof sourceId !== "string" || !Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 20) {
      return NextResponse.json({ error: "Invalid meal or quantity" }, { status: 400 });
    }
    const { data: source, error: findError } = await auth.db.from("meals")
      .select("raw_input,meal_name,calories,protein_g,carbs_g,fat_g")
      .eq("user_id", auth.userId).eq("id", sourceId).single();
    if (findError || !source) return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    const scale = (value: unknown) => Math.round(Number(value || 0) * multiplier);
    const { error } = await auth.db.from("meals").insert({
      user_id: auth.userId,
      raw_input: multiplier === 1 ? source.raw_input : `${source.raw_input} (x${multiplier})`,
      meal_name: source.meal_name,
      calories: scale(source.calories),
      protein_g: scale(source.protein_g),
      carbs_g: scale(source.carbs_g),
      fat_g: scale(source.fat_g),
      logged_at: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to repeat meal" }, { status: 500 });
  }
}
