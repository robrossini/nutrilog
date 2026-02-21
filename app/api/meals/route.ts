import { NextResponse } from "next/server";
import { createSupabaseUserClient, getBearerToken } from "../../../lib/supabase";

export const runtime = "nodejs";

function startOfTodayUTCISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoUTCISO(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const range = (searchParams.get("range") || "today") as "today" | "month";

    let fromISO: string;
    if (range === "today") fromISO = startOfTodayUTCISO();
    else fromISO = daysAgoUTCISO(31); // "month" ≈ last 31 days

    // RLS should already enforce user_id = auth.uid()
    // but we also filter by user_id explicitly (belt & braces).
    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", fromISO)
      .order("logged_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ meals: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}