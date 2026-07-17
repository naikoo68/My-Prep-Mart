import { useEffect, useState } from "react";
import { X, Loader2, CheckCircle2, ClipboardList } from "lucide-react";
import { testService } from "../../services";
import { Loading, ErrorState } from "../ui/AsyncState";

// Question fields copied when adding an existing question into a test series.
// (Ids / timestamps / relations are intentionally omitted so a fresh copy is
// created inside the target test.)
const COPY_FIELDS = [
  "type", "text", "options", "correct", "optionExplanations", "explanation",
  "difficulty", "columnA", "columnB", "assertion", "reason", "tableRows",
  "image", "status",
];

// Lets an admin add ONE existing question (e.g. from the quiz bank) into a Test
// Series. Shows a picker of the admin's tests; when the chosen test defines
// per-subject sections, an optional section can be selected (the backend also
// enforces the per-subject limit).
export default function AddToTestModal({ question, onClose }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testId, setTestId] = useState("");
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLoading(true);
    testService
      .adminList()
      .then((rows) => setTests(Array.isArray(rows) ? rows : []))
      .catch((e) => setError(e.message || "Could not load tests."))
      .finally(() => setLoading(false));
  }, []);

  const selected = tests.find((t) => t._id === testId);
  const sections = Array.isArray(selected?.subjectPlan)
    ? selected.subjectPlan.map((p) => p.subject).filter(Boolean)
    : [];

  const add = async () => {
    if (!testId) { setError("Choose a test to add this question to."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {};
      for (const f of COPY_FIELDS) if (question?.[f] !== undefined) payload[f] = question[f];
      if (section) payload.section = section;
      await testService.addQuestion(testId, payload);
      setDone(true);
      setTimeout(onClose, 1100);
    } catch (e) {
      setError(e?.message || "Could not add the question to that test.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-12 w-full max-w-md animate-scale-in card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <ClipboardList className="h-5 w-5 text-brand-600" /> Add question to a test
          </h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-8 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" />
            <p className="font-semibold">Added to the test.</p>
          </div>
        ) : loading ? (
          <Loading label="Loading tests..." />
        ) : error && !tests.length ? (
          <ErrorState message={error} />
        ) : !tests.length ? (
          <p className="py-6 text-center text-sm text-slate-500">No test series found. Create a test first, then add questions to it.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Test series</label>
              <select className="input" value={testId} onChange={(e) => { setTestId(e.target.value); setSection(""); }}>
                <option value="">— Select a test —</option>
                {tests.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}{t.questionCount != null ? ` (${t.questionCount} Qs)` : ""}
                  </option>
                ))}
              </select>
            </div>

            {sections.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Section / subject <span className="font-normal text-slate-400">(optional)</span></label>
                <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
                  <option value="">— No specific section —</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">Each subject has a question limit; adding beyond it will be blocked.</p>
              </div>
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="btn-outline">Cancel</button>
              <button onClick={add} disabled={saving || !testId} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                {saving ? "Adding…" : "Add to test"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
