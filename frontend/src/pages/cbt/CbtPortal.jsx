import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MonitorCheck, Clock, FileText, Award, RefreshCw, CalendarClock, GraduationCap,
  Mail, User as UserIcon, Loader2, ShieldCheck, LogOut, CheckCircle2,
} from "lucide-react";
import { cbtService } from "../../services";
import { useSettings } from "../../context/SettingsContext";
import { getCbtSession, setCbtSession, clearCbtSession } from "../../lib/cbtSession";
import { Loading, ErrorState, EmptyState } from "../../components/ui/AsyncState";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "");

/* -------- Registration card (name + email + OTP) — shown before sign-in -------- */
function RegisterCard({ onRegistered }) {
  const [stage, setStage] = useState("form"); // form | otp
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const sendCode = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please enter your full name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email address.");
    setBusy(true);
    try {
      const r = await cbtService.registerPortal({ name: name.trim(), email: email.trim().toLowerCase() });
      setInfo(`We emailed a 6-digit code to ${r.email}.`);
      setStage("otp");
    } catch (err) {
      setError(err.message || "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\d{4,8}$/.test(code.trim())) return setError("Enter the code from your email.");
    setBusy(true);
    try {
      const v = await cbtService.verifyPortal({ email: email.trim().toLowerCase(), code: code.trim() });
      onRegistered({ name: v.name || name.trim(), email: v.email, sessionToken: v.sessionToken });
    } catch (err) {
      setError(err.message || "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(""); setBusy(true);
    try {
      const r = await cbtService.registerPortal({ name: name.trim(), email: email.trim().toLowerCase() });
      setInfo(`A new code was sent to ${r.email}.`);
      setCode("");
    } catch (err) {
      setError(err.message || "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-7">
        <div className="mb-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 text-white">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-lg font-extrabold">Register to view &amp; take exams</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Verify your email once — then you can see which exams are live and take them.</p>
        </div>

        {stage === "form" ? (
          <form onSubmit={sendCode} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Full name</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700">
                <UserIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full bg-transparent py-2.5 text-sm outline-none" autoFocus />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Email</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700">
                <Mail className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className="w-full bg-transparent py-2.5 text-sm outline-none" />
              </div>
              <p className="mt-1 text-xs text-slate-400">Your results (with rank) are emailed here after each exam ends.</p>
            </div>
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {busy ? "Please wait…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{info}</p>}
            <div>
              <label className="mb-1 block text-sm font-semibold">Enter the 6-digit code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric"
                placeholder="______"
                className="w-full rounded-xl border border-slate-200 py-2.5 text-center text-2xl font-bold tracking-[0.4em] outline-none dark:border-slate-700 dark:bg-slate-800"
                autoFocus
              />
            </div>
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {busy ? "Verifying…" : "Verify & Continue"}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStage("form"); setError(""); setInfo(""); }} className="text-slate-500 hover:underline">← Change email</button>
              <button type="button" onClick={resend} disabled={busy} className="text-brand-600 hover:underline disabled:opacity-50">Resend code</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// The single, public exam portal (one shareable link). Students register once
// here (name + email + OTP); then they see which exams are live/scheduled and
// can start any live one — no per-exam sign-in.
export default function CbtPortal() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [session, setSession] = useState(getCbtSession());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadExams = useCallback(() => {
    if (!session) return;
    setLoading(true);
    setError("");
    cbtService
      .portal(session.email)
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);
  useEffect(loadExams, [loadExams]);

  const onRegistered = (s) => { setCbtSession(s); setSession(s); };
  const signOut = () => { clearCbtSession(); setSession(null); setRows([]); };

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
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold leading-none">{settings?.siteName || "Online Exams"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Online Examination Portal</p>
          </div>
          {session && (
            <div className="flex items-center gap-3">
              <span className="hidden text-right sm:block">
                <span className="block text-sm font-semibold leading-none">{session.name}</span>
                <span className="block text-xs text-slate-400">{session.email}</span>
              </span>
              <button onClick={signOut} className="btn-outline py-1.5 text-xs"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
            </div>
          )}
        </div>
      </header>

      <div className="container-page py-8">
        {!session ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="flex items-center justify-center gap-2 text-2xl font-extrabold">
                <MonitorCheck className="h-6 w-6 text-brand-600" /> Exam Portal
              </h1>
              <p className="text-slate-500 dark:text-slate-400">Register with your email to see and take the available exams.</p>
            </div>
            <RegisterCard onRegistered={onRegistered} />
          </>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold">
                  <MonitorCheck className="h-6 w-6 text-brand-600" /> Available Exams
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                  Hi {session.name}! Pick a live exam to begin. Your scorecard &amp; rank are emailed once the exam ends.
                </p>
              </div>
              <button onClick={loadExams} disabled={loading} className="btn-outline">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            {loading ? (
              <Loading label="Loading exams..." />
            ) : error ? (
              <ErrorState message={error} onRetry={loadExams} />
            ) : rows.length === 0 ? (
              <EmptyState message="No exams are available right now. Please check back later." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((r) => {
                  const scheduled = r.state === "scheduled";
                  return (
                    <div key={r._id} className="card flex flex-col p-5">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {r.completed ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Completed</span>
                          ) : scheduled ? (
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
                        {scheduled && r.startAt && (
                          <p className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400"><CalendarClock className="h-3.5 w-3.5" /> Opens {fmtDate(r.startAt)}</p>
                        )}
                        {r.endAt && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><CalendarClock className="h-3.5 w-3.5" /> Closes {fmtDate(r.endAt)}</p>
                        )}
                      </div>

                      {r.completed ? (
                        <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-500 dark:bg-slate-800">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Submitted — result after it ends
                        </div>
                      ) : scheduled ? (
                        <button disabled className="btn-outline mt-4 w-full cursor-not-allowed opacity-60">
                          <CalendarClock className="h-4 w-4" /> Not open yet
                        </button>
                      ) : (
                        <button onClick={() => navigate(`/cbt/exam/${r.token}`)} className="btn-primary mt-4 w-full">
                          <MonitorCheck className="h-4 w-4" /> Start Exam
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-8 text-center text-xs text-slate-400">
              Results (score &amp; rank) are released after each exam ends and sent to your email. One attempt per exam.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
