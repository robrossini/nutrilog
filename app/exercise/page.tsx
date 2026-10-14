"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabaseBrowser} from "../../lib/supabase-client";

type SetRow={exercise_name:string;exercise_order:number;set_number:number;weight_kg:number|null;reps:number;rir:number|null};
type Session={id:string;title:string;activity_type:string;performed_at:string;distance_m:number|null;duration_seconds:number|null;exercise_sets:SetRow[]};
const starter:{[key:string]:string[]}={
 "Gym A":["Barbell squat","Bench press","Lat pulldown","Romanian deadlift","Lateral raise","Plank"],
 "Gym B":["Deadlift","Incline dumbbell press","Seated cable row","Leg press","Biceps curl","Triceps pushdown"],
 "Gym C":["Barbell squat","Bench press","Chest-supported row","Leg curl","Shoulder press","Calf raise"],
};
export default function ExercisePage(){
 const router=useRouter();
 const [token,setToken]=useState("");
 const [history,setHistory]=useState<Session[]>([]);
 const [type,setType]=useState<"strength"|"run">("strength");
 const [title,setTitle]=useState("Gym A");
 const [sets,setSets]=useState<SetRow[]>([]);
 const [distance,setDistance]=useState("");
 const [minutes,setMinutes]=useState("");
 const [effort,setEffort]=useState("");
 const [notes,setNotes]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [performedAt,setPerformedAt]=useState(()=>new Date().toISOString().slice(0,10));
 useEffect(()=>{supabaseBrowser.auth.getSession().then(({data})=>{if(!data.session){router.replace("/login");return;}setToken(data.session.access_token);});},[router]);
 useEffect(()=>{if(!token)return;fetch("/api/exercise/sessions",{headers:{Authorization:"Bearer "+token}}).then(r=>r.json()).then(d=>setHistory(d.sessions??[])).catch(()=>setError("Could not load history"));},[token]);
 function useTemplate(name:string){
  setTitle(name);
  const previous=history.find(s=>s.title===name && s.activity_type==="strength");
  setSets((starter[name]??[]).map((exercise_name,i)=>{
   const prior=previous?.exercise_sets?.filter(s=>s.exercise_name===exercise_name).sort((a,b)=>a.set_number-b.set_number)??[];
   return Array.from({length:exercise_name==="Plank"?3:3},(_,j)=>({
    exercise_name,exercise_order:i,set_number:j+1,
    weight_kg:prior[j]?.weight_kg??null,reps:prior[j]?.reps??5,rir:null
   }));
  }).flat());
 }
 function change(index:number,field:keyof SetRow,value:string){
  setSets(old=>old.map((s,i)=>i!==index?s:{...s,[field]:field==="exercise_name"?value:field==="weight_kg"||field==="rir"?(value===""?null:Number(value)):Number(value)}));
 }
 async function save(){
  if(!token)return;
  setBusy(true);setError("");setSuccess("");
  const payload={activity_type:type,title:type==="run"?"Run":title,performed_at:new Date(performedAt+"T12:00:00").toISOString(),notes,
   ...(type==="run"?{distance_m:Number(distance)*1000,duration_seconds:Math.round(Number(minutes)*60),effort:effort?Number(effort):null,sets:[]}:{sets})};
  try{
   const res=await fetch("/api/exercise/sessions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(payload)});
   const result=await res.json();
   if(!res.ok)throw new Error(typeof result.error==="string"?result.error:"Check the session details and try again");
   const response=await fetch("/api/exercise/sessions",{headers:{Authorization:"Bearer "+token}});
   const data=await response.json();setHistory(data.sessions??[]);
   setSuccess("Workout saved.");setNotes("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save");}finally{setBusy(false);}
 }
 return <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4"><div className="mx-auto max-w-3xl space-y-5">
  <header className="flex items-center justify-between"><div><Link href="/" className="text-blue-600 text-sm">← Food diary</Link><h1 className="text-3xl font-bold text-gray-900">Exercise</h1></div><Link href="/settings" className="text-sm text-gray-600">Settings</Link></header>
  <div className="flex gap-2">{(["strength","run"] as const).map(t=><button key={t} onClick={()=>setType(t)} className={"rounded-lg px-4 py-2 "+(type===t?"bg-blue-600 text-white":"bg-white border")}>{t==="strength"?"Gym workout":"Run"}</button>)}</div>
  <section className="bg-white rounded-xl border p-4 space-y-4">
   <label className="block text-sm">Date <input type="date" value={performedAt} onChange={e=>setPerformedAt(e.target.value)} className="block border rounded-lg p-2 mt-1"/></label>
   {type==="strength"?<>
    <div className="flex flex-wrap gap-2">{Object.keys(starter).map(n=><button key={n} onClick={()=>useTemplate(n)} className="rounded-lg bg-blue-50 text-blue-700 px-3 py-2">{n}</button>)}</div>
    <label className="block text-sm">Workout name<input value={title} onChange={e=>setTitle(e.target.value)} className="block w-full border rounded-lg p-2 mt-1"/></label>
    {Array.from(new Set(sets.map(s=>s.exercise_order))).map(order=><div key={order} className="border-t pt-3 space-y-2">
     <input aria-label="Exercise name" className="font-semibold w-full border rounded p-2" value={sets.find(s=>s.exercise_order===order)?.exercise_name??""} onChange={e=>setSets(old=>old.map(s=>s.exercise_order===order?{...s,exercise_name:e.target.value}:s))}/>
     <div className="grid grid-cols-4 text-xs text-gray-500 gap-2"><span>Set</span><span>kg</span><span>Reps</span><span>RIR</span></div>
     {sets.map((s,i)=>({s,i})).filter(x=>x.s.exercise_order===order).map(({s,i})=><div key={i} className="grid grid-cols-4 gap-2 items-center">
      <span>{s.set_number}</span>
      <input aria-label="Weight kg" type="number" min="0" step="0.5" placeholder="BW" value={s.weight_kg??""} onChange={e=>change(i,"weight_kg",e.target.value)} className="w-full border rounded p-2"/>
      <input aria-label="Repetitions" type="number" min="0" value={s.reps} onChange={e=>change(i,"reps",e.target.value)} className="w-full border rounded p-2"/>
      <input aria-label="Reps in reserve" type="number" min="0" max="10" placeholder="—" value={s.rir??""} onChange={e=>change(i,"rir",e.target.value)} className="w-full border rounded p-2"/>
     </div>)}
     <button className="text-sm text-blue-600" onClick={()=>setSets(old=>[...old,{exercise_name:old.find(s=>s.exercise_order===order)?.exercise_name??"",exercise_order:order,set_number:old.filter(s=>s.exercise_order===order).length+1,weight_kg:null,reps:5,rir:null}])}>+ Add set</button>
    </div>)}
    <button className="text-sm text-blue-600" onClick={()=>setSets(old=>[...old,{exercise_name:"New exercise",exercise_order:Math.max(-1,...old.map(s=>s.exercise_order))+1,set_number:1,weight_kg:null,reps:8,rir:null}])}>+ Add exercise</button>
   </>:<div className="grid grid-cols-2 gap-3">
    <label className="text-sm">Distance (km)<input type="number" min="0" step="0.01" value={distance} onChange={e=>setDistance(e.target.value)} className="block w-full border rounded p-2 mt-1"/></label>
    <label className="text-sm">Duration (minutes)<input type="number" min="0" step="0.1" value={minutes} onChange={e=>setMinutes(e.target.value)} className="block w-full border rounded p-2 mt-1"/></label>
    <label className="text-sm">Effort (1–10)<input type="number" min="1" max="10" value={effort} onChange={e=>setEffort(e.target.value)} className="block w-full border rounded p-2 mt-1"/></label>
    <div className="text-sm text-gray-600 self-end">{Number(distance)>0&&Number(minutes)>0?`Pace: ${(Number(minutes)/Number(distance)).toFixed(2)} min/km`:""}</div>
   </div>}
   <label className="block text-sm">Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} className="block w-full border rounded p-2 mt-1" rows={2}/></label>
   {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}
   {success&&<p role="status" className="text-green-700 text-sm">{success}</p>}
   <button disabled={busy||(type==="strength"&&sets.length===0)||(type==="run"&&(!Number(distance)||!Number(minutes)))} onClick={save} className="w-full bg-blue-600 text-white rounded-lg p-3 disabled:opacity-50">{busy?"Saving…":"Save workout"}</button>
  </section>
  <section className="bg-white rounded-xl border p-4"><h2 className="font-semibold text-lg mb-3">Recent workouts</h2>
   {history.length===0?<p className="text-gray-500">No sessions yet. Choose a gym template or log a run.</p>:<div className="space-y-3">{history.map(s=><div key={s.id} className="border-b pb-2"><div className="font-medium">{s.title} <span className="text-gray-500 text-xs">{new Date(s.performed_at).toLocaleDateString("en-GB")}</span></div><div className="text-sm text-gray-600">{s.activity_type==="run"?`${((s.distance_m??0)/1000).toFixed(2)} km · ${Math.round((s.duration_seconds??0)/60)} min`:`${s.exercise_sets?.length??0} sets`}</div></div>)}</div>}
  </section>
 </div></main>;
}
