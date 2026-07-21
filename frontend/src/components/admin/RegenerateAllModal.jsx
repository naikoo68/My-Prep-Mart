import { useEffect, useState } from "react";
import { X, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Server, KeyRound } from "lucide-react";
import { aiService } from "../../services";
import { useAuth } from "../../context/AuthContext";

/**
 * RegenerateAllModal — AI-regenerates EVERY question in one quiz or test in
 * place: rebuilds the options, correct answer, explanation and per-option notes
 * to fit each stem, and reshuffles the Column B order of pair/matching
 * questions (recomputing the correct answer). Runs as a background job with
 * progress. Nothing about the question stem's meaning changes.
 *
 * Props:
 *  - open: boolean
 *  - target: { quiz } | { testSeries }  — the id set to regenerate
 *  - title: string  — the quiz/test name (shown in the header)
 *  - onClose()
 *  - onDone()  — called after a successful run so the parent can reload questions
 */
export default function RegenerateAllModal({ open, target, title, onClose, onDone }) {
  const { user } = useAuth();
  const isClient = user?.role === "client" && user?.aiAccess;
  const canChooseSource = isClient && user?.aiAllowInbuilt !== false && user?.aiAllowSelf !== false;
  const [srcMode, setSrcMode] = useState(user?.aiMode === "self" ? "self" : "inbuilt");
  const [status, setStatus] = useState(null);
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setMsg("");
    setProgress(null);
    setBusy(false);
    setNotes("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    aiService
      .status(isClient ? srcMode : undefined)
      .then((s) => { setStatus(s); setModel(s?.model || (s?.models && s.models[0]) || ""); })
      .catch(() => setStatus({ enabled: false }));
  }, [open, srcMode, isClient]);

  if (!open) return null;

  const run = async () => {
    setBusy(true);
    setMsg("Starting…");
    setProgress(null);
    try {
      const { jobId, requested } = await aiService.regenerateAll({
        ...target,
        model: model || undefined,
        notes: notes.trim() || undefined,
        mode: isClient ? srcMode : undefined,
      });
      if (!jobId) throw new Error("Could not start.");
      setProgress({ done: 0, total: requested });
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      let done = false;
      for (let i = 0; i < 400 && !done; i++) {
        await sleep(2000);
        let s;
        try { s = await aiService.job(jobId); } catch { continue; }
        const total = s.requested || requested;
        if (s.status === "done") {
          const doneCount = s.updatedCount ?? s.count ?? total;
          setProgress({ done: doneCount, total });
          const note = s.error === "quota"
            ? " — stopped early (AI quota reached). Click again to finish the rest."
            : s.error === "partial" || doneCount < total
            ? ` — ${total - doneCount} couldn't be regenerated. Click “Regenerate all” again to finish them.`
            : "";
          setMsg(`✓ Regenerated ${doneCount} of ${total} question(s)${note}`);
          done = true;
          onDone?.();
        } else if (s.status === "error") {
          setMsg(s.error || "Failed.");
          done = true;
        } else {
          setProgress({ done: s.count || 0, total });
          setMsg(`Regenerating… ${s.count || 0} of ${total}`);
        }
      }
      if (!done) setMsg("Still working — this is taking longer than expected. It keeps running in the background; reopen later.");
    } catch (e) {
      setMsg(e.message || "Failed.");
    } finally {
      setBusy(false);
    }
  };

  const pct = progress && progress.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={busy ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-lg animate-scale-in card p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold"><RefreshCw className="h-5 w-5 text-violet-600" /> Regenerate all questions</h3>
          <button onClick={onClose} disabled={busy}><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{title}</p>

        {canChooseSource && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-semibold">API source</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSrcMode("inbuilt")} disabled={busy}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${srcMode === "inbuilt" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300" : "border-slate-200 text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300"}`}>
                <Server className="h-4 w-4" /> Built-in APIs
              </button>
              <button type="button" onClick={() => setSrcMode("self")} disabled={busy}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${srcMode === "self" ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300" : "border-slate-200 text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300"}`}>
                <KeyRound className="h-4 w-4" /> My own APIs
              </button>
            </div>
          </div>
        )}

        {status && !status.enabled ? (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> AI is not available</p>
            <p className="mt-1">{isClient ? "Add an API key in the AI tab, or ask your administrator." : "Add an API key in Admin → AI Keys to enable this."}</p>
          </div>
        ) : (
          <>
            <div className="mb-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              This rebuilds the <b>options, correct answer, explanation and per-option notes</b> of{" "}
              <b>every question</b> in this {target?.testSeries ? "test" : "quiz"} to fit each stem, and
              reshuffles the <b>Column B order</b> of pair/matching questions (recomputing the correct answer).
              The question wording &amp; meaning are kept.
            </div>

            {status?.models && status.models.length > 1 && (
              <div className="mb-3">
                <label className="mb-1 block text-sm font-semibold">AI model</label>
                <select className="input" value={model} onChange={(e) => setModel(e.target.value)} disabled={busy}>
                  {status.models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            <label className="mb-1 block text-sm font-semibold">Instructions (optional — followed strictly)</label>
            <textarea
              rows={2}
              className="input resize-y"
              placeholder='e.g. "Keep options in Hindi", "Make distractors harder", "Only NCERT facts"'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
            />

            {progress && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>{progress.done} / {progress.total} regenerated</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            <button type="button" onClick={run} disabled={busy} className="btn-primary mt-4 w-full">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Regenerating…</> : <><RefreshCw className="h-4 w-4" /> Regenerate all questions</>}
            </button>
          </>
        )}

        {msg && (
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
            {msg.startsWith("✓") && <CheckCircle2 className="h-4 w-4 text-emerald-600" />} {msg}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-outline">Close</button>
        </div>
      </div>
    </div>
  );
}
