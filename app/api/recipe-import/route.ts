import { NextResponse } from "next/server";
import { createSupabaseUserClient, getBearerToken } from "../../../lib/supabase";
export const runtime = "nodejs";

function recipeObjects(value: any): any[] {
  if (Array.isArray(value)) return value.flatMap(recipeObjects);
  if (!value || typeof value !== "object") return [];
  const children = value["@graph"] ? recipeObjects(value["@graph"]) : [];
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  return types.some((t: any) => typeof t === "string" && t.toLowerCase().endsWith("recipe")) ? [value, ...children] : children;
}
function numberFrom(value: unknown): number | null {
  const match = String(value ?? "").match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : null;
}
function servings(value: unknown): number | null {
  if (Array.isArray(value)) return servings(value[0]);
  return numberFrom(value);
}
export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = createSupabaseUserClient(token);
    const { data: userData } = await db.auth.getUser();
    if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    if (typeof body?.url !== "string") return NextResponse.json({ error: "Enter a recipe URL" }, { status: 400 });
    const url = new URL(body.url);
    // Only fetch from a known recipe domain to prevent server-side request forgery.
    if (url.protocol !== "https:" || !["www.bbcgoodfood.com", "bbcgoodfood.com"].includes(url.hostname) || url.port || !url.pathname.startsWith("/recipes/")) {
      return NextResponse.json({ error: "Currently supports BBC Good Food recipe links only" }, { status: 400 });
    }
    const response = await fetch(url.toString(), { headers: { "User-Agent": "NutriLogRecipeImporter/1.0" }, signal: AbortSignal.timeout(8000), redirect: "error" });
    if (!response.ok) return NextResponse.json({ error: "Could not retrieve recipe" }, { status: 422 });
    const html = (await response.text()).slice(0, 2_000_000);
    const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    const recipes = scripts.flatMap(m => { try { return recipeObjects(JSON.parse(m[1])); } catch { return []; } });
    const recipe = recipes[0];
    if (!recipe) return NextResponse.json({ error: "No structured recipe data found" }, { status: 422 });
    const n = recipe.nutrition || {};
    const calories = numberFrom(n.calories), protein = numberFrom(n.proteinContent), carbs = numberFrom(n.carbohydrateContent), fat = numberFrom(n.fatContent);
    const yieldCount = servings(recipe.recipeYield);
    if ([calories, protein, carbs, fat].some(v => v === null) || !yieldCount || yieldCount <= 0) {
      return NextResponse.json({ error: "Recipe nutrition or serving count missing; please log manually" }, { status: 422 });
    }
    return NextResponse.json({ recipe: { name: String(recipe.name || "Imported recipe"), url: url.toString(), servings: yieldCount, calories, protein, carbs, fat, ingredients: Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [] } });
  } catch (e: any) { return NextResponse.json({ error: e?.message || "Could not import recipe" }, { status: 500 }); }
}
