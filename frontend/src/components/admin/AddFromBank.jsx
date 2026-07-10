import { useEffect, useState } from "react";
import { X, Library, Loader2 } from "lucide-react";
import { contentService, practiceService, testService } from "../../services";
import QuestionBankComposer, { rowsToPlan } from "./QuestionBankComposer";

// Modal: add questions to a test by pulling them from the Quiz and Practice
// question banks (choose subjects + how many per subject).
export default function AddFromBank({ open, onClose, testId, title = "Add Questions from Bank", onDone }) {
  const [quizSubjects, setQuizSubjects] = useState([]);
  const [practiceSubjects, setPracticeSubjects] = useState([]);
  const [rows, setRows] = useState([{ source: "quiz", subjectId: "", count: 5 }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setMsg("");
    setRows([{ source: "quiz", subjectId: "", count: 5 }]);
    contentService.subjects().then(setQuizSubjects).catch(() => setQuizSubjects([]));
    practiceService.allSubjects().then(setPracticeSubjects).catch(() => setPracticeSubjects([]));
  }, [open]);

  if (!open) return null;

  const add = async () => {
    const plan = rowsToPlan(rows);
    if (!plan.quizPlan.length && !plan.practicePlan.length) {
      setMsg("Pick at least one subject and a count.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await testService.populate(testId, plan);
      setMsg(`✓ Added ${res?.inserted ?? 0} question(s) to the test.`);
      onDone?.(res?.inserted ?? 0);
      setTimeout(onClose, 900);
    } catch (e) {
      setMsg(e.message || "Couldn't add questions.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-xl animate-scale-in card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Library className="h-5 w-5 text-brand-600" /> {title}
          </h3>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <p className="mb-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          Copies existing questions from your <b>Quizzes</b> and <b>Practice</b> content into this test. Choose each
          subject and how many questions to pull.
        </p>

        <QuestionBankComposer
          rows={rows}
          onChange={setRows}
          quizSubjects={quizSubjects}
          practiceSubjects={practiceSubjects}
        />

        {msg && <p className="mt-3 text-sm font-medium">{msg}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-outline">Close</button>
          <button type="button" onClick={add} disabled={busy} className="btn-primary">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</> : "Add to Test"}
          </button>
        </div>
      </div>
    </div>
  );
}
