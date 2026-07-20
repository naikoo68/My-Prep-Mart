import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Mail, User as UserIcon, Loader2, Clock, ShieldCheck, RefreshCw, CalendarClock } from "lucide-react";
import { cbtService } from "../../services";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "");

// Card wrapper. Defined at module scope (NOT inside CbtRegister) so it keeps a
// stable identity across renders — otherwise the form inputs would remount and
// lose focus on every keystroke.
function ExamShell({ meta, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="card w-full max-w-md p-7">
        <div className="mb-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 text-white">
            <GraduationCap className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-extrabold">{meta?.name || "Online Exam"}</h1>
          {meta && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {meta.questionCount} questions · {meta.duration} min · {meta.marks} marks
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// CBT sign-in gate. Before the exam starts the candidate registers with name +
// email and (when the exam requires it) verifies a one-time code emailed to
// them. On success we fetch the questions and hand control back to the player.
//   onStarted(startResponse, candidate)  — candidate = { name, email, sessionToken }
export default function CbtRegister({ token, onStarted, onExit }) {
  const [meta, setMeta] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState("");

  const [stage, setStage] = useState("form"); // form | otp
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [done, setDone] = useState(false); // already-completed lock

  const loadMeta = useCallback(() => {
    setLoadingMeta(true);
    setMetaError("");
    cbtService
      .examMeta(token)
      .then(setMeta)
      .catch((e) => setMetaError(e.message))
      .finally(() => setLoadingMeta(false));
  }, [token]);
  useEffect(loadMeta, [loadMeta]);

  const requireOtp = meta?.requireOtp !== false;

  // Fetch questions for a verified candidate and start the exam.
  const beginExam = async (sessionToken) => {
    const res = await cbtService.start(token, { email: email.trim().toLowerCase(), sessionToken });
    onStarted(res, { name: name.trim(), email: email.trim().toLowerCase(), sessionToken });
  };

  // Step 1 — register (send OTP) or, when OTP isn't required, start directly.
  const submitForm = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please enter your full name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email address.");
    setBusy(true);
    try {
      if (!requireOtp) {
        await beginExam(""); // no OTP for this exam
        return;
      }
      const r = await cbtService.register(token, { name: name.trim(), email: email.trim().toLowerCase() });
      setInfo(`We emailed a 6-digit code to ${r.email}. Enter it below to start.`);
      setStage("otp");
    } catch (err) {
      if (err?.data?.alreadyCompleted) { setDone(true); return; }
      setError(err.message || "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2 — verify OTP, then start.
  const submitOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\d{4,8}$/.test(code.trim())) return setError("Enter the code from your email.");
    setBusy(true);
    try {
      const v = await cbtService.verify(token, { email: email.trim().toLowerCase(), code: code.trim() });
      await beginExam(v.sessionToken);
    } catch (err) {
      if (err?.data?.alreadyCompleted) { setDone(true); return; }
      setError(err.message || "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(""); setBusy(true);
    try {
      const r = await cbtService.register(token, { name: name.trim(), email: email.trim().toLowerCase() });
      setInfo(`A new code was sent to ${r.email}.`);
      setCode("");
    } catch (err) {
      setError(err.message || "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  };

  if (loadingMeta) return <ExamShell meta={meta}><div className="flex justify-center py-6 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div></ExamShell>;
  if (metaError) return <ExamShell meta={meta}><p className="text-center text-sm text-rose-600">{metaError}</p><button onClick={loadMeta} className="btn-outline mt-4 w-full"><RefreshCw className="h-4 w-4" /> Retry</button></ExamShell>;

  // Already completed → hard stop.
  if (done) {
    return (
      <ExamShell meta={meta}>
        <div className="text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-3 font-semibold">You've already taken this exam.</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Only one attempt is allowed. Your result will be emailed after the exam ends.</p>
          <button onClick={onExit} className="btn-outline mt-5 w-full">Back to exams</button>
        </div>
      </ExamShell>
    );
  }

  // Window states that block entry.
  if (meta.state === "ended" || meta.state === "released") {
    return <ExamShell meta={meta}><div className="text-center"><Clock className="mx-auto h-10 w-10 text-rose-500" /><p className="mt-3 font-semibold">This exam has ended.</p><button onClick={onExit} className="btn-outline mt-5 w-full">Back to exams</button></div></ExamShell>;
  }
  if (meta.state === "off") {
    return <ExamShell meta={meta}><div className="text-center"><Clock className="mx-auto h-10 w-10 text-amber-500" /><p className="mt-3 font-semibold">This exam isn't open right now.</p><p className="mt-1 text-sm text-slate-500">Please check back later.</p><button onClick={loadMeta} className="btn-outline mt-5 w-full"><RefreshCw className="h-4 w-4" /> Check again</button></div></ExamShell>;
  }
  if (meta.state === "scheduled") {
    return (
      <ExamShell meta={meta}>
        <div className="text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-brand-500" />
          <p className="mt-3 font-semibold">This exam hasn't started yet.</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Opens at <b>{fmtDate(meta.startAt)}</b>.</p>
          <button onClick={loadMeta} className="btn-primary mt-5 w-full"><RefreshCw className="h-4 w-4" /> Check again</button>
          <button onClick={onExit} className="btn-ghost mt-2 w-full text-sm">Back to exams</button>
        </div>
      </ExamShell>
    );
  }

  // Open → registration / OTP.
  return (
    <ExamShell meta={meta}>
      {stage === "form" ? (
        <form onSubmit={submitForm} className="space-y-3">
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
            <p className="mt-1 text-xs text-slate-400">
              {requireOtp ? "We'll email a code to verify it's you. " : ""}Your result (with rank) is emailed here after the exam ends.
            </p>
          </div>
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
          {meta.endAt && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">Exam closes at <b>{fmtDate(meta.endAt)}</b> — the timer ends then even if you join late.</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : requireOtp ? <Mail className="h-4 w-4" /> : null}
            {busy ? "Please wait…" : requireOtp ? "Send code" : "Start Exam"}
          </button>
          <button type="button" onClick={onExit} className="btn-ghost w-full text-sm">Cancel</button>
        </form>
      ) : (
        <form onSubmit={submitOtp} className="space-y-3">
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
            {busy ? "Verifying…" : "Verify & Start Exam"}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setStage("form"); setError(""); setInfo(""); }} className="text-slate-500 hover:underline">← Change email</button>
            <button type="button" onClick={resend} disabled={busy} className="text-brand-600 hover:underline disabled:opacity-50">Resend code</button>
          </div>
        </form>
      )}
      <p className="mt-3 text-center text-[11px] text-slate-400">The timer starts as soon as the exam opens.</p>
    </ExamShell>
  );
}
