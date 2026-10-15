"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const label = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const Empty = ({ children }: { children: string }) => <p className="flex h-60 items-center justify-center text-center text-sm text-slate-600">{children}</p>;
export type NutritionPoint = { date: string; calories: number; protein: number; carbs: number; fat: number };
export type WeightPoint = { recorded_on: string; weight_kg: number };
export type LiftPoint = { date: string; weight: number; reps: number };
export type RunPoint = { id: string; date: string; distance: number; pace: number };
const axes = { fontSize: 11 };
export function NutritionChart({ data, target }: { data: NutritionPoint[]; target: number | null }) {
  return <section className={card}>
    <h2 className="text-lg font-bold">Daily calories</h2>
    <p className="mb-3 text-sm text-slate-600">Unlogged days are excluded, not counted as zero.</p>
    {data.length ? <div className="h-60" aria-label="Calories per logged day">
      <ResponsiveContainer><BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={label} minTickGap={16} tick={axes} />
        <YAxis tick={axes} width={45} />
        <Tooltip labelFormatter={v => label(String(v))} formatter={v => [Math.round(Number(v)) + " kcal", "Intake"]} />
        <Bar dataKey="calories" fill="#2563eb" radius={[3,3,0,0]} />
        {target != null && target > 0 && <ReferenceLine y={target} stroke="#b91c1c" strokeDasharray="5 4" />}
      </BarChart></ResponsiveContainer>
    </div> : <Empty>Log meals to see your calorie trend.</Empty>}
    <p className="mt-2 text-xs text-slate-600">Red dashed line = your current calorie goal.</p>
  </section>;
}
export function WeightChart({ data }: { data: WeightPoint[] }) {
  return <section className={card}>
    <h2 className="text-lg font-bold">Bodyweight</h2>
    <p className="mb-3 text-sm text-slate-600">Dated weigh-ins, not your undated profile weight.</p>
    {data.length ? <div className="h-60" aria-label="Bodyweight in kilograms">
      <ResponsiveContainer><LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="recorded_on" tickFormatter={label} minTickGap={16} tick={axes} />
        <YAxis domain={["auto","auto"]} tick={axes} width={45} />
        <Tooltip labelFormatter={v => label(String(v))} formatter={v => [Number(v).toFixed(1) + " kg", "Weight"]} />
        <Line dataKey="weight_kg" stroke="#0f766e" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart></ResponsiveContainer>
    </div> : <Empty>Save a weigh-in to start a bodyweight trend.</Empty>}
  </section>;
}
export function LiftChart({ data, exercise }: { data: LiftPoint[]; exercise: string }) {
  return <section className={card}>
    <h2 className="text-lg font-bold">Strength: {exercise || "No exercise yet"}</h2>
    <p className="mb-3 text-sm text-slate-600">Heaviest completed set per day; compare at similar reps.</p>
    {data.length ? <div className="h-60" aria-label="Heaviest working weight in kilograms">
      <ResponsiveContainer><LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={label} tick={axes} minTickGap={16} />
        <YAxis domain={["auto","auto"]} tick={axes} width={45} />
        <Tooltip labelFormatter={v => label(String(v))} formatter={(_v, _n, props) => [props.payload.weight + " kg × " + props.payload.reps + " reps", "Top set"]} />
        <Line dataKey="weight" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart></ResponsiveContainer>
    </div> : <Empty>Log completed sets with weights and reps to build your strength chart.</Empty>}
  </section>;
}
export function RunChart({ data }: { data: RunPoint[] }) {
  return <section className={card}>
    <h2 className="text-lg font-bold">Running distance</h2>
    <p className="mb-3 text-sm text-slate-600">Distance per run in kilometres.</p>
    {data.length ? <div className="h-60" aria-label="Distance of logged runs">
      <ResponsiveContainer><BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={label} minTickGap={16} tick={axes} />
        <YAxis tick={axes} width={45} />
        <Tooltip labelFormatter={v => label(String(v))} formatter={v => [Number(v).toFixed(2) + " km", "Distance"]} />
        <Bar dataKey="distance" fill="#ea580c" radius={[3,3,0,0]} />
      </BarChart></ResponsiveContainer>
    </div> : <Empty>Log runs with distance and duration to see a trend.</Empty>}
    <p className="mt-2 text-xs text-slate-600">Outdoor and treadmill runs are combined.</p>
  </section>;
}
