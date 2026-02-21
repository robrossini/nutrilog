import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseUserClient, getBearerToken } from "../../../lib/supabase";

export const runtime = "nodejs";

type ParsedMeal = {
  meal_name: string;
  items: Array<{
    item_name: string;
    quantity_text: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    confidence: number;
  }>;
  assumptions: string[];
};

function sumMacros(parsed: ParsedMeal) {
  const totals = parsed.items.reduce(
    (acc, it) => ({
      calories: acc.calories + (Number(it.calories) || 0),
      protein_g: acc.protein_g + (Number(it.protein_g) || 0),
      carbs_g: acc.carbs_g + (Number(it.carbs_g) || 0),
      fat_g: acc.fat_g + (Number(it.fat_g) || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return {
    calories: Math.round(totals.calories),
    protein_g: Math.round(totals.protein_g),
    carbs_g: Math.round(totals.carbs_g),
    fat_g: Math.round(totals.fat_g),
  };
}

// Fixed hourly window (UTC): e.g. 14:00:00Z → 14:59:59Z
function hourWindowStartUTC(d: Date) {
  const x = new Date(d);
  x.setUTCMinutes(0, 0, 0);
  return x.toISOString();
}

const MAX_CALLS_PER_HOUR = 20;

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseUserClient(token);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ RATE LIMIT (20 per hour per user)
    // This is a "fixed window" limiter per UTC hour.
    const windowStart = hourWindowStartUTC(new Date());

    // Fetch current usage for this user+window
    const { data: usageRow, error: usageErr } = await supabase
      .from("ai_usage_hourly")
      .select("count")
      .eq("user_id", user.id)
      .eq("window_start", windowStart)
      .maybeSingle();

    if (usageErr) {
      return NextResponse.json({ error: `Rate limit check failed: ${usageErr.message}` }, { status: 500 });
    }

    const currentCount = usageRow?.count ?? 0;

    if (currentCount >= MAX_CALLS_PER_HOUR) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          details: `Max ${MAX_CALLS_PER_HOUR} AI calls per hour.`,
        },
        { status: 429 }
      );
    }

    // Reserve a slot BEFORE calling OpenAI (prevents double-spend on retries)
    // Upsert row and increment count.
    const { error: reserveErr } = await supabase
      .from("ai_usage_hourly")
      .upsert(
        {
          user_id: user.id,
          window_start: windowStart,
          count: currentCount + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,window_start" }
      );

    if (reserveErr) {
      return NextResponse.json({ error: `Rate limit reserve failed: ${reserveErr.message}` }, { status: 500 });
    }

    // -------------- Normal request flow below --------------

    const body = await req.json().catch(() => null);
    const input = body?.input;

    if (typeof input !== "string" || input.trim().length === 0) {
      return NextResponse.json({ error: "Missing or invalid input" }, { status: 400 });
    }
    if (input.length > 1000) {
      return NextResponse.json({ error: "Input too long" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });

    const SYSTEM_PROMPT = `
You are a nutrition logging assistant.
Convert meal descriptions into a structured nutrition estimate.

Rules:
- Return valid JSON only.
- Be practical and reasonably accurate, not perfect.
- Split combined meals into individual food items where possible.
- Estimate portions when unclear and list assumptions.
- Macros should be in grams. Calories should be kcal.
- Include confidence between 0 and 1 for each item.
- If uncertain, make a sensible estimate and explain assumptions.
`.trim();

    const USER_PROMPT = (text: string) => `
Log this meal: "${text}"

Return JSON in exactly this shape:
{
  "meal_name": "string",
  "items": [
    {
      "item_name": "string",
      "quantity_text": "string",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "confidence": number
    }
  ],
  "assumptions": ["string"]
}
`.trim();

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT(input) },
      ],
      text: { format: { type: "json_object" } },
    });

    const raw = resp.output_text?.trim();
    if (!raw) {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }

    let parsed: ParsedMeal;
    try {
      parsed = JSON.parse(raw) as ParsedMeal;
    } catch {
      return NextResponse.json({ error: "Model returned invalid JSON", raw }, { status: 502 });
    }

    const totals = sumMacros(parsed);

    const { data: inserted, error: insertErr } = await supabase
      .from("meals")
      .insert({
        user_id: user.id,
        raw_input: input,
        meal_name: parsed.meal_name || input,
        calories: totals.calories,
        protein_g: totals.protein_g,
        carbs_g: totals.carbs_g,
        fat_g: totals.fat_g,
        logged_at: new Date().toISOString(),
        // If you don't have this column, remove it:
        parsed_json: parsed,
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: inserted?.id,
      data: parsed,
      rate_limit: {
        window_start: windowStart,
        used: currentCount + 1,
        limit: MAX_CALLS_PER_HOUR,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}