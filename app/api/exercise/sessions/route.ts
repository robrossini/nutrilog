import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseUserClient, getBearerToken } from "../../../../lib/supabase";


const setSchema = z.object({
 exercise_name: z.string().trim().min(1).max(120),
 exercise_order: z.number().int().min(0),
 set_number: z.number().int().positive(),
 weight_kg: z.number().min(0).max(1000).nullable(),
 reps: z.number().int().min(0).max(1000),
 rir: z.number().int().min(0).max(10).nullable().optional(),
});
const sessionSchema = z.object({
 activity_type: z.enum(["strength","run"]),
 title: z.string().trim().min(1).max(120),
 performed_at: z.string().datetime(),
 duration_seconds: z.number().int().min(0).max(86400).nullable().optional(),
 distance_m: z.number().min(0).max(1000000).nullable().optional(),
 effort: z.number().int().min(1).max(10).nullable().optional(),
 notes: z.string().max(2000).nullable().optional(),
 training_plan_id: z.string().uuid().optional(),
 planned_day_id: z.string().min(1).max(60).optional(),
 planned_week: z.number().int().min(1).max(52).optional(),
 sets: z.array(setSchema).max(150).default([]),
}).refine(v => v.activity_type !== "strength" || v.sets.length > 0, "Strength workouts need at least one set");

export async function GET(req: NextRequest) {
 const token=getBearerToken(req);
 if (!token) return NextResponse.json({error:"Unauthorized"},{status:401});
 const supabase=createSupabaseUserClient(token);
 const {data:userData,error:userError}=await supabase.auth.getUser();
 if(userError||!userData.user)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data,error}=await supabase.from("exercise_sessions").select("*, exercise_sets(*)").eq("user_id",userData.user.id).order("performed_at",{ascending:false}).limit(100);
 if(error) return NextResponse.json({error:"Unable to load sessions"},{status:500});
 return NextResponse.json({sessions:data??[]});
}
export async function POST(req: NextRequest) {
 const token=getBearerToken(req);
 if(!token) return NextResponse.json({error:"Unauthorized"},{status:401});
 let body:unknown;
 try {body=await req.json();} catch {return NextResponse.json({error:"Invalid JSON"},{status:400});}
 const parsed=sessionSchema.safeParse(body);
 if(!parsed.success) return NextResponse.json({error:parsed.error.flatten()},{status:400});
 const supabase=createSupabaseUserClient(token);
 const {data:userData,error:userError}=await supabase.auth.getUser();
 if(userError||!userData.user)return NextResponse.json({error:"Unauthorized"},{status:401});
 // Planned sessions must reference a programme owned by the authenticated user.
 if (parsed.data.training_plan_id || parsed.data.planned_day_id || parsed.data.planned_week) {
  if (!parsed.data.training_plan_id || !parsed.data.planned_day_id || !parsed.data.planned_week) {
   return NextResponse.json({error:"Incomplete planned workout reference"},{status:400});
  }
  const {data:plan,error:planError}=await supabase.from("training_plans")
   .select("id,status,duration_weeks,schedule")
   .eq("id",parsed.data.training_plan_id).eq("user_id",userData.user.id).maybeSingle();
  if(planError || !plan || plan.status!=="active"){
   return NextResponse.json({error:"Active training programme not found"},{status:400});
  }
  const schedule=Array.isArray(plan.schedule)?plan.schedule:[];
  const day=schedule.find((d:any)=>d.id===parsed.data.planned_day_id);
  if(!day || day.activity_type!==parsed.data.activity_type || parsed.data.planned_week>plan.duration_weeks){
   return NextResponse.json({error:"Workout does not match your training plan"},{status:400});
  }
 }
 const {sets,...session}=parsed.data;
 const {data:created,error}=await supabase.from("exercise_sessions").insert({...session,user_id:userData.user.id}).select("id").single();
 if(error||!created) return NextResponse.json({error:"Unable to create session"},{status:500});
 if(sets.length) {
  const {error:setError}=await supabase.from("exercise_sets").insert(sets.map(s=>({...s,session_id:created.id})));
  if(setError) {
   await supabase.from("exercise_sessions").delete().eq("id",created.id).eq("user_id",userData.user.id);
   return NextResponse.json({error:"Unable to save sets; session rolled back"},{status:500});
  }
 }
 return NextResponse.json({id:created.id},{status:201});
}
