import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MonitorCheck, Clock, FileText, Award, RefreshCw, CalendarClock, GraduationCap } from "lucide-react";
import { cbtService } from "../../services";
import { useSettings } from "../../context/SettingsContext";
import { Loading, ErrorState, EmptyState } from "../../components/ui/AsyncState";

const fmtDate = (d) => (d ? new Date(d).toLocaleString() : null);

// The single, public exam portal (one shareable link). Lists every exam the
// admin has added and switched Live. Candidates tap Start, sign in with their
// name + email, and take it. Results are emailed/shown only after the exam ends.
export default function CbtPortal() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    cbtService
      .portal()
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page flex items-center gap-3 py-5">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt={settings.siteName} className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
          )}
          <div>
            <p className="text-lg font-extrabold leading-none">{settings?.siteName || "Online Exams"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Online Examination Portal</p>
          </div>
        </div>
      </header>

      <div className="container-page py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold">
              <MonitorCheck className="h-6 w-6 text-brand-600" /> Available Exams
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Pick an exam to begin. You'll sign in with your name &amp; email — your scorecard and rank are emailed once the exam ends.
            </p>
          </div>
          <button onClick={load} disabled={loading} className="btn-outline">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <Loading label="Loading exams..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState message="No exams are live right now. Please check back later." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <div key={r._id} className="card flex flex-col p-5">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    {r.state === "scheduled" ? (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">Scheduled</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Live</span>
                    )}
                    {r.context && <span className="truncate text-xs text-slate-400">{r.context}</span>}
                  </div>
                  <h2 className="text-lg font-bold leading-snug">{r.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1"><FileText className="h-4 w-4" /> {r.questionCount} questions</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {r.duration} min</span>
                    <span className="inline-flex items-center gap-1"><Award className="h-4 w-4" /> {r.marks} marks</span>
                  </div>
                  {r.state === "scheduled" && r.startAt && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400">
                      <CalendarClock className="h-3.5 w-3.5" /> Opens {fmtDate(r.startAt)}
                    </p>
                  )}
                  {r.endAt && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <CalendarClock className="h-3.5 w-3.5" /> Closes {fmtDate(r.endAt)}
                    </p>
                  )}
                </div>
                <button onClick={() => navigate(`/cbt/exam/${r.token}`)} className="btn-primary mt-4 w-full">
                  <MonitorCheck className="h-4 w-4" /> {r.state === "scheduled" ? "View / Register" : "Start Exam"}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          Results (score &amp; rank) are released after each exam ends and sent to your email.
        </p>
      </div>
    </div>
  );
}
