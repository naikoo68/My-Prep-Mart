import { Plus, Trash2 } from "lucide-react";

// Rows of { source: "quiz"|"practice", subjectId, count } used to pull questions
// from the Quiz / Practice bank into a test. Controlled component.
export default function QuestionBankComposer({ rows, onChange, quizSubjects = [], practiceSubjects = [] }) {
  const setRow = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => onChange([...rows, { source: "quiz", subjectId: "", count: 5 }]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  const total = rows.reduce((s, r) => s + (r.subjectId ? parseInt(r.count, 10) || 0 : 0), 0);

  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const subjects = r.source === "practice" ? practiceSubjects : quizSubjects;
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={r.source}
              onChange={(e) => setRow(i, { source: e.target.value, subjectId: "" })}
              className="input w-28 py-1.5 text-sm"
            >
              <option value="quiz">Quizzes</option>
              <option value="practice">Practice</option>
            </select>
            <select
              value={r.subjectId}
              onChange={(e) => setRow(i, { subjectId: e.target.value })}
              className="input min-w-[10rem] flex-1 py-1.5 text-sm"
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}{s.stream ? ` (${s.stream})` : ""}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={200}
              value={r.count}
              onChange={(e) => setRow(i, { count: e.target.value })}
              className="input w-20 py-1.5 text-sm"
              title="Questions from this subject"
            />
            <button type="button" onClick={() => removeRow(i)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow} className="btn-outline py-1.5 text-sm">
          <Plus className="h-4 w-4" /> Add subject
        </button>
        {total > 0 && (
          <span className="text-xs font-semibold text-slate-500">≈ {total} question(s) will be pulled</span>
        )}
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-slate-400">Add a subject and choose how many questions to pull from the Quiz or Practice bank.</p>
      )}
    </div>
  );
}

// Convert composer rows → { quizPlan, practicePlan } for the /populate endpoint.
export function rowsToPlan(rows) {
  const quizPlan = [];
  const practicePlan = [];
  for (const r of rows || []) {
    const count = parseInt(r.count, 10) || 0;
    if (!r.subjectId || count <= 0) continue;
    if (r.source === "practice") practicePlan.push({ practiceSubject: r.subjectId, count });
    else quizPlan.push({ subject: r.subjectId, count });
  }
  return { quizPlan, practicePlan };
}
