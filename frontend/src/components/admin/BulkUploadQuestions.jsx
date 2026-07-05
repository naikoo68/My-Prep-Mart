import { useState } from "react";
import { X, Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

// Parse a single CSV line, respecting double-quoted fields (so commas and
// quotes can appear inside a question or option).
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function correctIndex(v) {
  const s = String(v ?? "").trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(s)) return "ABCD".indexOf(s);
  const n = parseInt(s, 10);
  if (n >= 1 && n <= 4) return n - 1;
  return 0;
}

// Turns pasted CSV text into question objects + a list of skipped-row errors.
export function parseQuestionsCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  const errors = [];
  lines.forEach((line, idx) => {
    const cells = parseCsvLine(line);
    // Skip an optional header row.
    if (idx === 0 && /^(text|question)$/i.test(cells[0] || "")) return;
    if (cells.length < 5) { errors.push(`Line ${idx + 1}: needs a question + 4 options`); return; }
    const [qtext, a, b, c, d, correct, difficulty, explanation] = cells;
    if (!qtext || !a || !b || !c || !d) { errors.push(`Line ${idx + 1}: empty question or option`); return; }
    rows.push({
      type: "mcq",
      text: qtext,
      options: [a, b, c, d],
      correct: correctIndex(correct),
      difficulty: ["Easy", "Medium", "Hard"].includes(difficulty) ? difficulty : "Medium",
      explanation: explanation || "",
      status: "published",
    });
  });
  return { rows, errors };
}

const TEMPLATE =
  "Question,Option A,Option B,Option C,Option D,Correct,Difficulty,Explanation\n" +
  '"What is 2+2?",3,4,5,6,B,Easy,"2+2 equals 4"\n' +
  '"Speed of light (m/s)?","3x10^8","1x10^6","3x10^6","9x10^8",A,Medium,';

// Reusable bulk-upload modal. `onUpload(questions)` should return a promise
// (e.g. resolving to { inserted }). Used for both quizzes and test series.
export default function BulkUploadQuestions({ open, onClose, onUpload, title = "Bulk Upload Questions" }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!open) return null;

  const { rows, errors } = parseQuestionsCsv(text);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const submit = async () => {
    if (!rows.length) { setMsg("Nothing to upload — add at least one valid row."); return; }
    setBusy(true);
    setMsg("");
    try {
      const res = await onUpload(rows);
      setMsg(`✓ Uploaded ${res?.inserted ?? rows.length} question(s).`);
      setText("");
      setTimeout(onClose, 1000);
    } catch (e) {
      setMsg(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-2xl animate-scale-in card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold"><Upload className="h-5 w-5" /> {title}</h3>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
          <p className="font-semibold">CSV format (one question per line):</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            <code>Question, Option A, Option B, Option C, Option D, Correct, Difficulty, Explanation</code>
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-500 dark:text-slate-400">
            <li><b>Correct</b>: A/B/C/D (or 1–4).</li>
            <li><b>Difficulty</b> &amp; <b>Explanation</b> are optional.</li>
            <li>Wrap any value containing a comma in "double quotes".</li>
            <li>Tip: build it in Excel/Google Sheets, then <b>Save/Download as CSV</b> and upload the file below.</li>
          </ul>
          <button
            type="button"
            onClick={() => setText(TEMPLATE)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
          >
            <FileText className="h-3.5 w-3.5" /> Load example
          </button>
        </div>

        <div className="mb-3">
          <label className="btn-outline cursor-pointer">
            <FileText className="h-4 w-4" /> Choose CSV file
            <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFile} />
          </label>
        </div>

        <textarea
          rows={9}
          className="input resize-y font-mono text-xs"
          placeholder="Paste your CSV rows here, or use “Choose CSV file” above…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {rows.length > 0 && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> {rows.length} valid question(s) ready
            </span>
          )}
          {errors.length > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> {errors.length} row(s) will be skipped
            </span>
          )}
        </div>
        {errors.length > 0 && (
          <div className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            {errors.slice(0, 8).map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}

        {msg && <p className="mt-3 text-sm font-medium">{msg}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          <button type="button" onClick={submit} disabled={busy || !rows.length} className="btn-primary">
            {busy ? "Uploading…" : `Upload ${rows.length || ""} Question(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
