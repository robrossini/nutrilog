import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { getUserFromRequest } from "../../../lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    let { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-create profile on first use
    if (!profile) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          display_name: user.email?.split("@")[0] ?? "User",
        })
        .select("*")
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      profile = inserted;
    }

    return NextResponse.json({ profile });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const payload = {
      display_name: String(body.display_name ?? "").trim() || null,
      daily_calorie_target: Number(body.daily_calorie_target ?? 2000),
      protein_target_g: Number(body.protein_target_g ?? 150),
      carbs_target_g: Number(body.carbs_target_g ?? 180),
      fat_target_g: Number(body.fat_target_g ?? 70),
      email: user.email,
    };

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: user.id, ...payload }, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}