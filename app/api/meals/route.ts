import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { getUserFromRequest } from "../../../lib/api-auth";

function getRange(range: string) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === "week") {
    const day = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);

    end.setTime(start.getTime());
    end.setDate(start.getDate() + 7);
  } else if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    end.setMonth(start.getMonth() + 1, 1);
    end.setHours(0, 0, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 1);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const range = req.nextUrl.searchParams.get("range") || "today";
    const { start, end } = getRange(range);

    const { data: meals, error } = await supabaseAdmin
      .from("meals")
      .select("*, meal_items(*)")
      .eq("user_id", user.id)
      .gte("logged_at", start)
      .lt("logged_at", end)
      .order("logged_at", { ascending: false });

    if (error) {
      console.error("Supabase /api/meals error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const totals = (meals ?? []).reduce(
      (acc, meal: any) => {
        acc.calories += Number(meal.calories || 0);
        acc.protein_g += Number(meal.protein_g || 0);
        acc.carbs_g += Number(meal.carbs_g || 0);
        acc.fat_g += Number(meal.fat_g || 0);
        return acc;
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );

    return NextResponse.json({ meals: meals ?? [], totals });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}