import { NextResponse } from "next/server";
import { createSupabaseUserClient, getBearerToken } from "../../../lib/supabase";
export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = createSupabaseUserClient(token);
    const { data } = await db.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const b = await req.json();
    const name = String(b.name || "").trim().slice(0, 150);
    const portion = Number(b.portion);
    const macros = ["calories", "protein", "carbs", "fat"].map(k => Number(b[k]));
    if (!name || !Number.isFinite(portion) || portion <= 0 || portion > 50 || macros.some(n => !Number.isFinite(n) || n < 0 || n > 10000)) {
      return NextResponse.json({ error: "Invalid recipe details" }, { status: 400 });
    }
    const [calories, protein_g, carbs_g, fat_g] = macros.map(n => Math.round(n * portion));
    const { error } = await db.from("meals").insert({
      user_id: data.user.id, meal_name: name,
      raw_input: `${name} — ${portion} serving(s) (recipe import)`,
      calories, protein_g, carbs_g, fat_g, logged_at: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e?.message || "Could not log recipe" }, { status: 500 }); }
}
