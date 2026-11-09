"use client";
import { useState } from "react";
type Recipe = { name: string; url: string; servings: number; calories: number; protein: number; carbs: number; fat: number; ingredients: string[] };
export function RecipeImport({ token, onLogged }: { token: string | null; onLogged: () => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [portion, setPortion] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function importRecipe() {
    if (!token || busy) return;
    setBusy(true); setError(""); setRecipe(null);
    try {
      const res = await fetch("/api/recipe-import", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setRecipe(data.recipe);
      setPortion("1");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function logRecipe() {
    if (!token || !recipe || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/log-recipe", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...recipe, portion: Number(portion) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not log recipe");
      setRecipe(null); setUrl(""); await onLogged();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="mt-5 border-t pt-4 space-y-3">
    <h3 className="font-semibold text-gray-900">Import a recipe URL</h3>
    <p className="text-sm text-gray-600">BBC Good Food links supported. Review nutrition before logging; values are taken from the recipe website, not recalculated.</p>
    <div className="flex flex-wrap gap-2">
      <input type="url" aria-label="Recipe URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.bbcgoodfood.com/recipes/..." className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder:text-gray-400" />
      <button type="button" onClick={importRecipe} disabled={!url || busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Import</button>
    </div>
    {recipe && <div className="space-y-3 rounded-lg border p-3 text-gray-900">
      <h4 className="font-medium">{recipe.name}</h4>
      <p className="text-sm">Recipe yields {recipe.servings} serving(s). Nutrition below is per published serving.</p>
      <div className="grid grid-cols-2 gap-2">
        {(["calories", "protein", "carbs", "fat"] as const).map(key => <label key={key} className="text-sm capitalize">{key} {key === "calories" ? "(kcal)" : "(g)"}
          <input type="number" min="0" value={recipe[key]} onChange={e => setRecipe({ ...recipe, [key]: Number(e.target.value) })} className="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-gray-900" />
        </label>)}
      </div>
      <label className="block text-sm">Servings eaten
        <input type="number" min="0.1" max="50" step="0.1" value={portion} onChange={e => setPortion(e.target.value)} className="mt-1 block w-28 rounded border border-gray-300 bg-white p-2 text-gray-900" />
      </label>
      <p className="text-sm">Total: {Math.round(recipe.calories * Number(portion || 0))} kcal · {Math.round(recipe.protein * Number(portion || 0))}g protein · {Math.round(recipe.carbs * Number(portion || 0))}g carbs · {Math.round(recipe.fat * Number(portion || 0))}g fat</p>
      <button type="button" onClick={logRecipe} disabled={busy || !Number(portion) || Number(portion) < 0} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Log recipe</button>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
