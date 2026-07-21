import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, Sparkles } from "lucide-react";
import { settingsService } from "../../services";

const blankPlan = () => ({ name: "", maxPerBatch: 50, perWindow: 100, windowMinutes: 5 });
const num = (v, min, max) => Math.max(min, Math.min(max, parseInt(v, 10) || min));

// Admin-only card: set the admin's own per-batch limit AND define the AI plans
// (per-batch max + questions per rolling window) that get assigned to clients
// on the Clients page. Reads/writes the singleton site Settings.
export default function AiPlansManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [globalMax, setGlobalMax] = useState(500);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    settingsService
      .get()
      .then((s) => {
        setGlobalMax(s?.aiMaxPerBatch ?? 500);
        setPlans(Array.isArray(s?.aiPlans) ? s.aiPlans.map((p) => ({ ...p })) : []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const setPlan = (i, key, val) => setPlans((ps) => ps.map((p, j) => (j === i ? { ...p, [key]: val } : p)));
  const addPlan = () => setPlans((ps) => [...ps, blankPlan()]);
  const removePlan = (i) => setPlans((ps) => ps.filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const cleanPlans = plans
        .map((p) => ({
          name: String(p.name || "").trim(),
          maxPerBatch: num(p.maxPerBatch, 1, 5000),
          perWindow: num(p.perWindow, 1, 100000),
          windowMinutes: num(p.windowMinutes, 1, 1440),
        }))
        .filter((p) => p.name);
      const res = await settingsService.update({ aiMaxPerBatch: num(globalMax, 1, 5000), aiPlans: cleanPlans });
      setGlobalMax(res?.aiMaxPerBatch ?? globalMax);
      setPlans((res?.aiPlans || cleanPlans).map((p) => ({ ...p })));
      setMsg("✓ Saved AI limits & plans.");
    } catch (e) {
      setErr(e.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-brand-600" /> AI generation limits &amp; plans</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Set your own per-batch limit, and define plans (per-batch max + questions per window) to assign to clients on the <b>Clients</b> page.
          </p>
        </div>
        <button onClick={save} disabled={saving || loading} className="btn-primary flex-shrink-0">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save</>}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
      ) : (
        <>
          <div className="mb-4 max-w-xs">
            <label className="mb-1 block text-sm font-semibold">Admin — max questions per batch</label>
            <input type="number" min={1} max={5000} value={globalMax} onChange={(e) => setGlobalMax(e.target.value)} className="input" />
            <p className="mt-1 text-xs text-slate-400">Your own cap for one generation. Also the ceiling no plan can exceed.</p>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Client plans</p>
            <button onClick={addPlan} className="btn-outline py-1 text-xs"><Plus className="h-3.5 w-3.5" /> Add plan</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60">
                  <th className="px-3 py-2 text-left font-semibold">Plan name</th>
                  <th className="px-3 py-2 text-left font-semibold">Max / batch</th>
                  <th className="px-3 py-2 text-left font-semibold">Questions / window</th>
                  <th className="px-3 py-2 text-left font-semibold">Window (min)</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">No plans yet. Click “Add plan”.</td></tr>
                ) : plans.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-3 py-2"><input value={p.name} onChange={(e) => setPlan(i, "name", e.target.value)} placeholder="e.g. Pro" className="input !py-1" /></td>
                    <td className="px-3 py-2"><input type="number" min={1} value={p.maxPerBatch} onChange={(e) => setPlan(i, "maxPerBatch", e.target.value)} className="input !py-1 w-24" /></td>
                    <td className="px-3 py-2"><input type="number" min={1} value={p.perWindow} onChange={(e) => setPlan(i, "perWindow", e.target.value)} className="input !py-1 w-24" /></td>
                    <td className="px-3 py-2"><input type="number" min={1} value={p.windowMinutes} onChange={(e) => setPlan(i, "windowMinutes", e.target.value)} className="input !py-1 w-20" /></td>
                    <td className="px-3 py-2 text-right"><button onClick={() => removePlan(i)} title="Remove plan" className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Example: <b>Questions / window = 100</b> and <b>Window = 5</b> means a client on that plan can generate up to 100 questions every 5 minutes. Assign plans to clients in <b>Clients</b>.
          </p>
          {msg && <p className="mt-2 text-sm font-medium text-emerald-600">{msg}</p>}
          {err && <p className="mt-2 text-sm font-medium text-rose-600">{err}</p>}
        </>
      )}
    </div>
  );
}
