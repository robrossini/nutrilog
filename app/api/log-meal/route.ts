import { NextRequest, NextResponse } from "next/server";
import { openai } from "../../../lib/openai";
import { SYSTEM_PROMPT, USER_PROMPT } from "../../../lib/prompts";
import { ParsedMealSchema } from "../../../lib/schemas";
import { sumMealTotals } from "../../../lib/nutrition";
import { supabaseAdmin } from "../../../lib/supabase";
import { ParsedMealItem } from "../../../lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = String(body?.input || "").trim();

    if (!input) {
      return NextResponse.json({ error: "Input is required" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT(input) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Model returned invalid JSON", raw },
        { status: 502 }
      );
    }

    const parsed = ParsedMealSchema.parse(parsedJson);
    const totals = sumMealTotals(parsed.items as ParsedMealItem[]);

    const { data: mealRow, error: mealError } = await supabaseAdmin
      .from("meals")
      .insert({
        raw_input: input,
        source: "text",
        meal_name: parsed.meal_name ?? "Meal",
        calories: totals.calories,
        protein_g: totals.protein_g,
        carbs_g: totals.carbs_g,
        fat_g: totals.fat_g,
        assumptions_json: parsed.assumptions,
        llm_json: parsed,
      })
      .select("*")
      .single();

    if (mealError) {
      console.error("Supabase insert meal error:", mealError);
      return NextResponse.json({ error: mealError.message }, { status: 500 });
    }

    const mealItemsPayload = parsed.items.map((item) => ({
      meal_id: mealRow.id,
      item_name: item.item_name,
      quantity_text: item.quantity_text,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      confidence: item.confidence ?? null,
    }));

    const { data: itemRows, error: itemsError } = await supabaseAdmin
      .from("meal_items")
      .insert(mealItemsPayload)
      .select("*");

    if (itemsError) {
      console.error("Supabase insert meal_items error:", itemsError);
      await supabaseAdmin.from("meals").delete().eq("id", mealRow.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ meal: mealRow, items: itemRows });
  } catch (err: any) {
    console.error("log-meal route error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}