import { NextRequest, NextResponse } from "next/server";
import { createSupabaseUserClient, getBearerToken } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = createSupabaseUserClient(token);
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json({ error: "Expected enabled: true or false" }, { status: 400 });
    }
    const { error } = await supabase.from("mind_reminder_preferences").upsert({
      user_id: data.user.id,
      enabled: body.enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "Could not update reminder setting" }, { status: 503 });
    return NextResponse.json({ enabled: body.enabled });
  } catch {
    return NextResponse.json({ error: "Could not update reminder setting" }, { status: 500 });
  }
}
