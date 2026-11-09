"use client";
import { useEffect, useMemo, useState } from "react";

type Meal = { id: string; meal_name: string | null; raw_input: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; logged_at: string };
export function QuickLog({ token, onLogged }: { token: string | null; onLogged: () => Promise<void> }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Meal | null>(null);
  const [multiplier, setMultiplier] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    fetch("/api/quick-log", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error("Could not load previous meals"); return r.json(); })
      .then(d => setMeals(d.meals || []))
      .catch(e => setError(e.message));
  }, [token]);
  const matches = useMemo(() => meals.filter(m => (m.meal_name || m.raw_input).toLowerCase().includes(query.toLowerCase())).slice(0, 12), [meals, query]);
  async function repeat() {
    if (!selected || !token || busy) return;
    const amount = Number(multiplier);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 20) { setError("Enter a quantity between 0 and 20"); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/quick-log", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sourceId: selected.id, multiplier: amount }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not log meal");
      setSelected(null); setQuery(""); await onLogged();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="mt-5 border-t pt-4 space-y-3">
    <h3 className="font-semibold text-gray-900">Repeat a previous meal</h3>
    <input aria-label="Search previous meals" className="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder:text-gray-400" placeholder="Search previous meals…" value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }} />
    <div className="max-h-52 overflow-y-auto space-y-1">
      {matches.map(m => <button type="button" key={m.id} onClick={() => setSelected(m)} className={`block w-full rounded-lg p-2 text-left text-sm ${selected?.id === m.id ? "bg-blue-100" : "bg-gray-50 hover:bg-blue-50"}`}>
        <span className="font-medium text-gray-900">{m.meal_name || m.raw_input}</span>
        <span className="block text-gray-600">{Math.round(m.calories)} kcal · P {Math.round(m.protein_g)}g · C {Math.round(m.carbs_g)}g · F {Math.round(m.fat_g)}g</span>
      </button>)}
      {!matches.length && <p className="text-sm text-gray-500">No matching meals yet.</p>}
    </div>
    {selected && <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <label className="text-sm text-gray-800">Quantity multiplier
        <input type="number" min="0.1" max="20" step="0.1" value={multiplier} onChange={e => setMultiplier(e.target.value)} className="block w-24 rounded border border-gray-300 bg-white p-2 text-gray-900" />
      </label>
      <button type="button" onClick={repeat} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? "Logging…" : "Log this meal"}</button>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
