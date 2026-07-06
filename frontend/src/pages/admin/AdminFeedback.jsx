import { useEffect, useState } from "react";
import { Trash2, Check, Star } from "lucide-react";
import { feedbackService } from "../../services";
import Badge from "../../components/ui/Badge";
import { Loading, ErrorState, EmptyState } from "../../components/ui/AsyncState";

export default function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    feedbackService.list().then((d) => setItems(d.items || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleRead = async (f) => {
    try {
      const r = await feedbackService.toggleRead(f._id, !f.read);
      setItems((l) => l.map((x) => (x._id === f._id ? { ...x, read: r.read } : x)));
    } catch (e) { setError(e.message); }
  };
  const remove = async (f) => {
    if (!window.confirm("Delete this feedback?")) return;
    try {
      await feedbackService.remove(f._id);
      setItems((l) => l.filter((x) => x._id !== f._id));
    } catch (e) { setError(e.message); }
  };

  const ctxVariant = (c) => (c === "question" ? "accent" : "brand");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Feedback</h1>
          <p className="text-slate-500 dark:text-slate-400">What students say about questions, quizzes and tests.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {items.filter((f) => !f.read).length} new
        </span>
      </div>

      {loading ? (
        <Loading label="Loading feedback..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState message="No feedback yet." />
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <div key={f._id} className={`card p-4 ${f.read ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ctxVariant(f.context)}>{f.context}</Badge>
                    {f.rating ? (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">{f.rating}<Star className="h-3 w-3 fill-current" /></span>
                    ) : null}
                    {f.source ? <span className="text-xs text-slate-400">{f.source}</span> : null}
                    {!f.read && <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">NEW</span>}
                  </div>
                  {f.questionText ? <p className="mt-1 truncate text-xs italic text-slate-400">Q: {f.questionText}</p> : null}
                  <p className="mt-1 text-sm">{f.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{f.name}{f.email ? ` · ${f.email}` : ""} · {new Date(f.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  <button onClick={() => toggleRead(f)} title={f.read ? "Mark unread" : "Mark read"} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"><Check className="h-4 w-4" /></button>
                  <button onClick={() => remove(f)} title="Delete" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
