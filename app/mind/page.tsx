"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../lib/supabase-client";
import { shiftDate } from "../../lib/mind";

type RatingKey = "mood" | "enjoyment" | "concentration" | "social_anxiety" | "phone_usage" | "unwanted_habits";
type CheckboxKey = "enjoyable_activities" | "meaningful_social_contact" | "creative_activity" | "reading" | "social_anxiety_practice";
type FormState = Record<RatingKey, number | null> & Record<CheckboxKey, boolean> & {
  alcohol_units: string;
  reflection: string;
};
type SavedCheckin = Omit<FormState, "alcohol_units"> & { week_start: string; alcohol_units: number };
const blankForm = (): FormState => ({
  mood: null, enjoyment: null, concentration: null, social_anxiety: null,
  phone_usage: null, unwanted_habits: null,
  alcohol_units: "", enjoyable_activities: false, meaningful_social_contact: false,
  creative_activity: false, reading: false, social_anxiety_practice: false, reflection: "",
});
const ratings: { key: RatingKey; label: string; low: string; high: string }[] = [
  { key: "mood", label: "Overall mood", low: "Very low", high: "Very good" },
  { key: "enjoyment", label: "Interest and enjoyment", low: "None", high: "A lot" },
  { key: "concentration", label: "Ability to concentrate", low: "Very poor", high: "Very good" },
  { key: "social_anxiety", label: "Social anxiety", low: "Minimal", high: "Severe" },
  { key: "phone_usage", label: "Problematic phone usage", low: "Hardly any", high: "Very frequent" },
  { key: "unwanted_habits", label: "Other unwanted habits", low: "Hardly any", high: "Very frequent" },
];
const activities: { key: CheckboxKey; label: string }[] = [
  { key: "enjoyable_activities", label: "Made time for two enjoyable, non-productive activities" },
  { key: "meaningful_social_contact", label: "Had at least one meaningful social interaction" },
  { key: "creative_activity", label: "Did one creative endeavour" },
  { key: "reading", label: "Read for 15 minutes on weekdays" },
  { key: "social_anxiety_practice", label: "Practised managing social anxiety" },
];
const formatWeek = (date: string) => new Date(date + "T12:00:00Z")
  .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const inputClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function MindPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [currentWeek, setCurrentWeek] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [entries, setEntries] = useState<SavedCheckin[]>([]);
  const [form, setForm] = useState<FormState>(blankForm);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingReminders, setUpdatingReminders] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        if (!mounted) return;
        if (!data.session) {
          router.replace("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search));
          return;
        }
        const accessToken = data.session.access_token;
        const response = await fetch("/api/mind", {
          headers: { Authorization: "Bearer " + accessToken }, cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load Mind");
        if (!mounted) return;
        setToken(accessToken);
        setEntries(body.checkins ?? []);
        setRemindersEnabled(Boolean(body.reminders_enabled));
        setCurrentWeek(body.current_week_start);
        const queryWeek = new URLSearchParams(window.location.search).get("week");
        const allowed = new Set(Array.from({ length: 53 }, (_, i) => shiftDate(body.current_week_start, -7 * i)));
        const week = queryWeek && allowed.has(queryWeek) ? queryWeek : body.current_week_start;
        setSelectedWeek(week);
        const existing = (body.checkins as SavedCheckin[]).find((item) => item.week_start === week);
        if (existing) setForm(toForm(existing));
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Unable to load Mind");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void init();
    return () => { mounted = false; };
  }, [router]);

  function toForm(item: SavedCheckin): FormState {
    return {
      mood: item.mood, enjoyment: item.enjoyment, concentration: item.concentration,
      social_anxiety: item.social_anxiety, phone_usage: item.phone_usage,
      unwanted_habits: item.unwanted_habits, alcohol_units: String(item.alcohol_units),
      enjoyable_activities: item.enjoyable_activities, meaningful_social_contact: item.meaningful_social_contact,
      creative_activity: item.creative_activity, reading: item.reading,
      social_anxiety_practice: item.social_anxiety_practice, reflection: item.reflection || "",
    };
  }

  function chooseWeek(week: string) {
    setSelectedWeek(week);
    const existing = entries.find((item) => item.week_start === week);
    setForm(existing ? toForm(existing) : blankForm());
    setError(""); setMessage("");
    window.history.replaceState(null, "", "/mind?week=" + encodeURIComponent(week));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    if (!ratings.every((rating) => {
      const value = form[rating.key];
      return typeof value === "number" && value >= 1 && value <= 5;
    })) {
      setError("Please select a score for every question.");
      return;
    }
    const units = Number(form.alcohol_units);
    if (!form.alcohol_units.trim() || !Number.isFinite(units) || units < 0 || units > 200) {
      setError("Please enter alcohol units from 0 to 200 (0 if none).");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, week_start: selectedWeek, alcohol_units: units };
      const response = await fetch("/api/mind", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save");
      setEntries((before) => [...before.filter((item) => item.week_start !== selectedWeek), payload as SavedCheckin]
        .sort((a, b) => b.week_start.localeCompare(a.week_start)));
      setMessage("Saved. Reminders for this week will now stop.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  async function changeReminders(enabled: boolean) {
    setUpdatingReminders(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/mind/preferences", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update reminders");
      setRemindersEnabled(enabled);
      setMessage(enabled ? "Reminders enabled." : "Reminders switched off.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update reminders");
    } finally {
      setUpdatingReminders(false);
    }
  }

  const weeks = useMemo(() => currentWeek
    ? Array.from({ length: 53 }, (_, index) => shiftDate(currentWeek, -7 * index))
    : [], [currentWeek]);
  const alreadySaved = entries.some((entry) => entry.week_start === selectedWeek);

  if (loading) return <main className="min-h-screen bg-slate-50 p-6 text-slate-900">Loading Mind…</main>;
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 text-slate-900 [color-scheme:light]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap justify-between gap-3">
          <div>
            <nav className="flex gap-4 text-sm font-semibold text-indigo-700">
              <Link href="/" className="hover:underline">← Food diary</Link>
              <Link href="/progress" className="hover:underline">Progress</Link>
            </nav>
            <h1 className="mt-3 text-3xl font-bold">Mind</h1>
            <p className="text-sm text-slate-600">A weekly reflection, not a performance score.</p>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Email reminders</h2>
              <p className="mt-1 text-sm text-slate-600">
                Sunday evening, then once daily until that week is completed. Stops automatically when saved.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={remindersEnabled} disabled={!token || updatingReminders}
                onChange={(event) => void changeReminders(event.target.checked)} className="h-5 w-5 accent-indigo-600" />
              {remindersEnabled ? "On" : "Off"}
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">Emails only contain a secure sign-in link, never your responses. You can switch them off here.</p>
        </section>

        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {message && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</div>}

        {token && <form onSubmit={save} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Weekly check-in</h2>
              <p className="text-sm text-slate-600">Answer for the week beginning on the selected Monday.</p>
            </div>
            <div>
              <label htmlFor="week" className="block text-sm font-medium">Week beginning</label>
              <select id="week" className={inputClass} value={selectedWeek} onChange={(e) => chooseWeek(e.target.value)}>
                {weeks.map((week) => <option key={week} value={week}>{formatWeek(week)}</option>)}
              </select>
            </div>
          </div>
          {alreadySaved && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">This week is complete. You can edit your answers and save again.</p>}

          <div className="space-y-5">
            {ratings.map((question) => (
              <fieldset key={question.key} className="space-y-2">
                <legend className="text-sm font-semibold">{question.label}</legend>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button type="button" key={value}
                      aria-pressed={form[question.key] === value}
                      onClick={() => setForm((old) => ({ ...old, [question.key]: value }))}
                      className={"rounded-lg border px-2 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-indigo-500 " +
                        (form[question.key] === value ? "border-indigo-600 bg-indigo-100 text-indigo-900" : "border-slate-300 bg-white hover:bg-slate-50")}>
                      {value}
                    </button>
                  ))}
                </div>
                <p className="flex justify-between text-xs text-slate-500"><span>1 = {question.low}</span><span>5 = {question.high}</span></p>
              </fieldset>
            ))}
          </div>

          <div>
            <label htmlFor="units" className="mb-1 block text-sm font-semibold">Alcohol this week (UK units)</label>
            <input id="units" type="number" min="0" max="200" step="0.1"
              className={inputClass} value={form.alcohol_units} placeholder="Enter 0 if none"
              onChange={(e) => setForm((old) => ({ ...old, alcohol_units: e.target.value }))} />
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold">What did you make time for?</legend>
            <div className="space-y-3">
              {activities.map((item) => <label key={item.key} className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600"
                  checked={form[item.key]} onChange={(e) => setForm((old) => ({ ...old, [item.key]: e.target.checked }))} />
                <span>{item.label}</span>
              </label>)}
            </div>
          </fieldset>
          <div>
            <label htmlFor="reflection" className="mb-1 block text-sm font-semibold">Anything worth noting? (optional)</label>
            <textarea id="reflection" rows={3} maxLength={2000} className={inputClass + " w-full"}
              placeholder="What helped, what felt difficult, or anything unusual…"
              value={form.reflection} onChange={(e) => setForm((old) => ({ ...old, reflection: e.target.value }))} />
          </div>
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
            {saving ? "Saving…" : alreadySaved ? "Update check-in" : "Complete check-in"}
          </button>
          <p className="text-xs text-slate-500">Only you can access your responses when signed in. There is no overall mental health score or diagnosis.</p>
        </form>}

        {entries.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Recent trends</h2>
          <p className="mb-4 text-xs text-slate-600">Mood, enjoyment and focus: higher is better. Anxiety: higher means more difficulty.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-slate-600">
                <th className="pb-2 pr-4">Week</th><th className="pb-2 pr-3">Mood</th>
                <th className="pb-2 pr-3">Enjoyment</th><th className="pb-2 pr-3">Focus</th><th className="pb-2">Anxiety</th>
              </tr></thead>
              <tbody>{entries.slice(0, 8).map((entry) => <tr key={entry.week_start} className="border-b border-slate-100">
                <td className="py-2 pr-4"><button type="button" onClick={() => chooseWeek(entry.week_start)} className="text-indigo-700 underline">{formatWeek(entry.week_start)}</button></td>
                <td className="py-2 pr-3">{entry.mood}</td><td className="py-2 pr-3">{entry.enjoyment}</td>
                <td className="py-2 pr-3">{entry.concentration}</td><td className="py-2">{entry.social_anxiety}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>}
      </div>
    </main>
  );
}
