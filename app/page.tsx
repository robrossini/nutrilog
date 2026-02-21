"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isToday, startOfDay } from "date-fns";
import { Calendar, History, Plus } from "lucide-react";
import { MealLogInput } from "../components/meal-logger/meal-log-input";
import { MealCard } from "../components/meal-logger/meal-card";
import { MacrosSummary } from "../components/meal-logger/macros-summary";
import { TopTabs } from "../components/meal-logger/top-tabs";
import type { BackendMeal, UIMeal } from "../lib/meal-types";
import { supabaseBrowser } from "../lib/supabase-client";

type Profile = {
  display_name: string | null;
  email: string | null;
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
};

export default function HomePage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [meals, setMeals] = useState<BackendMeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabaseBrowser.auth.getSession();

      if (!data.session) {
        router.replace("/login");
        return;
      }

      setToken(data.session.access_token);
      setAuthReady(true);

      const profileRes = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });

      const profileJson = await profileRes.json();
      if (profileRes.ok) setProfile(profileJson.profile);

      await loadMeals(
        activeTab === "today" ? "today" : "month",
        data.session.access_token
      );
    };

    run();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          setToken(null);
          setProfile(null);
          router.replace("/login");
          return;
        }
        setToken(session.access_token);
      }
    );

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMeals(range: "today" | "month", bearerToken?: string) {
    const useToken = bearerToken || token;
    if (!useToken) return;

    setLoadingMeals(true);
    setError(null);

    try {
      const res = await fetch(`/api/meals?range=${range}`, {
        headers: { Authorization: `Bearer ${useToken}` },
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`);
        return;
      }

      setMeals(data.meals || []);
    } catch (e: any) {
      setError(e.message || "Connection error");
    } finally {
      setLoadingMeals(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadMeals(activeTab === "today" ? "today" : "month");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token]);

  async function handleLogMeal(text: string) {
    if (!text.trim() || !token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/log-meal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input: text }),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
        return;
      }

      await loadMeals(activeTab === "today" ? "today" : "month");
    } catch (e: any) {
      setError(e.message || "Connection error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMeal(id: string) {
    if (!token) return;
    setError(null);

    try {
      const res = await fetch(`/api/meals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        setError(data.error || "Failed to delete meal");
        return;
      }

      await loadMeals(activeTab === "today" ? "today" : "month");
    } catch (e: any) {
      setError(e.message || "Failed to delete meal");
    }
  }

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();
    router.push("/login");
  }

  const uiMeals: UIMeal[] = useMemo(
    () =>
      meals.map((m) => ({
        id: m.id,
        description: m.meal_name || m.raw_input,
        calories: Math.round(Number(m.calories || 0)),
        protein: Math.round(Number(m.protein_g || 0)),
        carbs: Math.round(Number(m.carbs_g || 0)),
        fat: Math.round(Number(m.fat_g || 0)),
        timestamp: new Date(m.logged_at).getTime(),
        mealName: m.meal_name,
      })),
    [meals]
  );

  const todaysMeals = useMemo(() => uiMeals.filter((m) => isToday(m.timestamp)), [uiMeals]);

  const todaysTotals = useMemo(
    () =>
      todaysMeals.reduce(
        (acc, meal) => ({
          calories: acc.calories + meal.calories,
          protein: acc.protein + meal.protein,
          carbs: acc.carbs + meal.carbs,
          fat: acc.fat + meal.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [todaysMeals]
  );

  const groupedMeals = useMemo(() => {
    return uiMeals.reduce((acc, meal) => {
      const dateKey = format(startOfDay(meal.timestamp), "yyyy-MM-dd");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(meal);
      return acc;
    }, {} as Record<string, UIMeal[]>);
  }, [uiMeals]);

  const sortedDates = useMemo(
    () => Object.keys(groupedMeals).sort((a, b) => b.localeCompare(a)),
    [groupedMeals]
  );

  if (!authReady) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">NutriLog</h1>
            <p className="text-gray-600">
              {profile?.display_name
                ? `Welcome back, ${profile.display_name}`
                : "Log meals naturally with AI-powered nutrition estimation"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>

        <TopTabs activeTab={activeTab} onChange={setActiveTab} />

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {activeTab === "today" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Log a Meal</h2>
              </div>
              <MealLogInput onSubmitMeal={handleLogMeal} isProcessing={loading} />
            </div>

            <MacrosSummary
              totalCalories={todaysTotals.calories}
              totalProtein={todaysTotals.protein}
              totalCarbs={todaysTotals.carbs}
              totalFat={todaysTotals.fat}
              calorieGoal={profile?.daily_calorie_target ?? 2000}
            />

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Today&apos;s Meals ({todaysMeals.length})
              </h2>
              {loadingMeals ? (
                <div className="text-center py-8 text-gray-500">Loading…</div>
              ) : todaysMeals.length > 0 ? (
                <div className="space-y-3">
                  {todaysMeals.map((meal) => (
                    <MealCard key={meal.id} meal={meal} onDelete={handleDeleteMeal} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No meals logged today</p>
                  <p className="text-sm mt-1">Start by logging your first meal above</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            {loadingMeals ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                Loading history…
              </div>
            ) : sortedDates.length > 0 ? (
              sortedDates.map((dateKey) => {
                const dateMeals = groupedMeals[dateKey];
                const dayTotals = dateMeals.reduce(
                  (acc, meal) => ({
                    calories: acc.calories + meal.calories,
                    protein: acc.protein + meal.protein,
                    carbs: acc.carbs + meal.carbs,
                    fat: acc.fat + meal.fat,
                  }),
                  { calories: 0, protein: 0, carbs: 0, fat: 0 }
                );

                return (
                  <div key={dateKey} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="mb-4 pb-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-600">
                        <span>{dayTotals.calories} cal</span>
                        <span>•</span>
                        <span>{dayTotals.protein}g protein</span>
                        <span>•</span>
                        <span>{dayTotals.carbs}g carbs</span>
                        <span>•</span>
                        <span>{dayTotals.fat}g fat</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {dateMeals.map((meal) => (
                        <MealCard key={meal.id} meal={meal} onDelete={handleDeleteMeal} />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No meal history yet</p>
                <p className="text-sm mt-1">Your logged meals will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}