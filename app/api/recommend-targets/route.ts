import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getBearerToken } from "../../../lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const age = Number(body.age);
    const height_cm = Number(body.height_cm);
    const weight_kg = Number(body.weight_kg);
    const goal_type = String(body.goal_type || "");
    const target_weight_change_kg = body.target_weight_change_kg == null ? null : Number(body.target_weight_change_kg);
    const sex = String(body.sex || "prefer_not_to_say");
    const activity_level = String(body.activity_level || "moderately_active");

    if (!Number.isFinite(age) || !Number.isFinite(height_cm) || !Number.isFinite(weight_kg)) {
      return NextResponse.json({ error: "Age, height and weight are required" }, { status: 400 });
    }
    if (!["lose_weight", "build_muscle", "maintain"].includes(goal_type)) {
      return NextResponse.json({ error: "Invalid goal_type" }, { status: 400 });
    }
    if (!['male', 'female', 'other', 'prefer_not_to_say'].includes(sex)) {
      return NextResponse.json({ error: "Invalid sex" }, { status: 400 });
    }
    if (!['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'].includes(activity_level)) {
      return NextResponse.json({ error: "Invalid activity_level" }, { status: 400 });
    }
    if ((goal_type === "lose_weight" || goal_type === "build_muscle") && !Number.isFinite(target_weight_change_kg)) {
      return NextResponse.json({ error: "Target weight change is required for this goal" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
You are helping estimate calorie and macro targets for a nutrition tracking app.
Return JSON only.

Inputs:
- age: ${age}
- height_cm: ${height_cm}
- weight_kg: ${weight_kg}
- goal_type: ${goal_type}
- target_weight_change_kg: ${target_weight_change_kg ?? "null"}
- sex: ${sex}
- activity_level: ${activity_level}

Rules:
- Give a practical estimate, not medical advice.
- Use the provided activity level to estimate maintenance calories.
- Use sex as an input if provided, but keep guidance general and non-medical.
- Use a reasonable timeframe/rate for gain/loss and mention it briefly in notes.
- Protein should be higher for muscle gain and weight loss.
- Carbs and fat should both be present (not extreme keto by default).
- Return integers for all macro/calorie values.
- Include a short explanation (1-3 sentences) with assumptions and a note to adjust based on progress.

JSON shape:
{
  "daily_calorie_target": number,
  "protein_target_g": number,
  "carbs_target_g": number,
  "fat_target_g": number,
  "notes": "string"
}
`.trim();

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [{ role: "user", content: prompt }],
      text: { format: { type: "json_object" } },
    });

    const raw = resp.output_text?.trim();
    if (!raw) return NextResponse.json({ error: "Empty model response" }, { status: 502 });

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON from model", raw }, { status: 502 });
    }

    return NextResponse.json({ recommendation: parsed });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
