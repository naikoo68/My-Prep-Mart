import { useState } from "react";
import { X, Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

// Full CSV parser that respects double-quoted fields — which may contain
// commas AND line breaks (e.g. a multi-line "Consider the following
// statements…" question). Returns an array of records (each an array of cells).
function parseCsvRecords(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote ""
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* ignore */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  row.push(field);
  rows.push(row);
  // Keep only records that have some content; trim each cell.
  return rows.filter((r) => r.some((f) => String(f).trim() !== "")).map((r) => r.map((f) => f.trim()));
}

function correctIndex(v) {
  const s = String(v ?? "").trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(s)) return "ABCD".indexOf(s);
  const n = parseInt(s, 10);
  if (n >= 1 && n <= 4) return n - 1;
  return 0;
}

const asDifficulty = (d) => (["Easy", "Medium", "Hard"].includes(d) ? d : "Medium");
const splitList = (s) => String(s || "").split("|").map((x) => x.trim()).filter(Boolean);

// Builds the per-option brief notes (why each WRONG option is wrong). The four
// cells align to options A–D; the correct option's cell is always cleared,
// since the correct answer is covered by the detailed Explanation column.
// Returns undefined when no notes were supplied so we don't store empty arrays.
function buildOptionExplanations(cells, correctIdx) {
  const four = [cells[0], cells[1], cells[2], cells[3]].map((x) => String(x || "").trim());
  if (!four.some(Boolean)) return undefined;
  four[correctIdx] = "";
  return four;
}

// Turns pasted CSV text into question objects + a list of skipped-row errors.
// Supports four row shapes (all end with optional Difficulty, Explanation, WhyA..D):
//   MCQ (default):  Question, OptionA..D, Correct, ...
//   Matching:       matching, Question, ColumnA, ColumnB, OptionA..D, Correct, ...
//   Statement:      statement, Intro, Statements, OptionA..D, Correct, ...
//   Pair:           pair, Intro, LeftList, RightList, OptionA..D, Correct, ...
// Explanation is the DETAILED note for the correct answer; WhyA..D are optional
// BRIEF notes shown when a student selects that (wrong) option — the correct
// option's Why cell is ignored. ColumnA/ColumnB/Statements/LeftList/RightList
// are pipe-separated lists, e.g. "Newton|Bohr|Curie".
export function parseQuestionsCsv(text) {
  const records = parseCsvRecords(text);
  const rows = [];
  const errors = [];
  records.forEach((cells, idx) => {
    const first = (cells[0] || "").toLowerCase();

    // Skip an optional header row.
    if (idx === 0 && /^(type|text|question)$/i.test(first)) return;

    // ---- Matching row ----
    if (first === "matching") {
      const [, qtext, colA, colB, a, b, c, d, correct, difficulty, explanation, wa, wb, wc, wd] = cells;
      const columnA = splitList(colA);
      const columnB = splitList(colB);
      if (!qtext || columnA.length < 2 || columnB.length < 2 || !a || !b || !c || !d) {
        errors.push(`Row ${idx + 1}: matching needs a question, ColumnA & ColumnB (2+ items each, pipe-separated) and 4 options`);
        return;
      }
      const ci = correctIndex(correct);
      const optExp = buildOptionExplanations([wa, wb, wc, wd], ci);
      rows.push({
        type: "matching",
        text: qtext,
        columnA,
        columnB,
        options: [a, b, c, d],
        correct: ci,
        difficulty: asDifficulty(difficulty),
        explanation: explanation || "",
        ...(optExp ? { optionExplanations: optExp } : {}),
        status: "published",
      });
      return;
    }

    // ---- Statement-based row ----
    if (first === "statement") {
      const [, qtext, statements, a, b, c, d, correct, difficulty, explanation, wa, wb, wc, wd] = cells;
      const columnA = splitList(statements);
      if (!qtext || columnA.length < 2 || !a || !b || !c || !d) {
        errors.push(`Row ${idx + 1}: statement needs an intro, 2+ pipe-separated statements and 4 options`);
        return;
      }
      const ci = correctIndex(correct);
      const optExp = buildOptionExplanations([wa, wb, wc, wd], ci);
      rows.push({
        type: "statement",
        text: qtext,
        columnA,
        options: [a, b, c, d],
        correct: ci,
        difficulty: asDifficulty(difficulty),
        explanation: explanation || "",
        ...(optExp ? { optionExplanations: optExp } : {}),
        status: "published",
      });
      return;
    }

    // ---- Pair-matching row (how many pairs are correct) ----
    if (first === "pair") {
      const [, qtext, leftList, rightList, a, b, c, d, correct, difficulty, explanation, wa, wb, wc, wd] = cells;
      const columnA = splitList(leftList);
      const columnB = splitList(rightList);
      if (!qtext || columnA.length < 2 || columnA.length !== columnB.length || !a || !b || !c || !d) {
        errors.push(`Row ${idx + 1}: pair needs an intro, equal-length Left & Right lists (2+ items, pipe-separated) and 4 options`);
        return;
      }
      const ci = correctIndex(correct);
      const optExp = buildOptionExplanations([wa, wb, wc, wd], ci);
      rows.push({
        type: "pair",
        text: qtext,
        columnA,
        columnB,
        options: [a, b, c, d],
        correct: ci,
        difficulty: asDifficulty(difficulty),
        explanation: explanation || "",
        ...(optExp ? { optionExplanations: optExp } : {}),
        status: "published",
      });
      return;
    }

    // ---- MCQ row (optionally prefixed with "mcq") ----
    const cols = first === "mcq" ? cells.slice(1) : cells;
    if (cols.length < 5) { errors.push(`Row ${idx + 1}: needs a question + 4 options`); return; }
    const [qtext, a, b, c, d, correct, difficulty, explanation, wa, wb, wc, wd] = cols;
    if (!qtext || !a || !b || !c || !d) { errors.push(`Row ${idx + 1}: empty question or option`); return; }
    const ci = correctIndex(correct);
    const optExp = buildOptionExplanations([wa, wb, wc, wd], ci);
    rows.push({
      type: "mcq",
      text: qtext,
      options: [a, b, c, d],
      correct: ci,
      difficulty: asDifficulty(difficulty),
      explanation: explanation || "",
      ...(optExp ? { optionExplanations: optExp } : {}),
      status: "published",
    });
  });
  return { rows, errors };
}

const TEMPLATE =
  "Question,Option A,Option B,Option C,Option D,Correct,Difficulty,Explanation,WhyA,WhyB,WhyC,WhyD\n" +
  '"What is 2+2?",3,4,5,6,B,Easy,"2+2 equals 4 because you add two and two.","3 is 2+1, not 2+2.",,"5 is 2+3.","6 is 2+4."\n' +
  '"Speed of light in vacuum (m/s)?","3x10^8","1x10^6","3x10^6","9x10^8",A,Medium,"Light travels at ~3x10^8 m/s in vacuum.",,"Too small by 100x.","Too small by 100x.","This is higher than the actual value."\n' +
  'matching,"Match the scientist to the discovery","Newton|Einstein|Bohr|Curie","Relativity|Gravity|Atom model|Radioactivity","1-II, 2-I, 3-III, 4-IV","1-I, 2-II, 3-III, 4-IV","1-III, 2-IV, 3-I, 4-II","1-IV, 2-III, 3-II, 4-I",A,Medium,"Newton-Gravity, Einstein-Relativity, Bohr-Atom model, Curie-Radioactivity",,"Swaps Newton and Einstein.","All mappings are shifted.","Order is fully reversed."\n' +
  'statement,"Consider the following statements:","The Sun is a star.|The Moon is a planet.|Water boils at 100°C at sea level.","1 and 3 only","2 and 3 only","1 and 2 only","1, 2 and 3",A,Medium,"Statements 1 and 3 are correct; the Moon is a satellite, not a planet.",,"Statement 2 is wrong — the Moon is a satellite.","Includes the wrong statement 2.","Includes the wrong statement 2."\n' +
  'pair,"Consider the following pairs (River — Tributary):","Ganga|Indus|Krishna","Yamuna|Chenab|Tungabhadra","Only one pair","Only two pairs","Only three pairs","All four pairs",C,Medium,"All three pairs are correctly matched.","Undercount.","Undercount.",,"There are only three pairs listed."';

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
          <p className="mt-1 text-slate-500 dark:text-slate-400">Every row ends with the same tail: <code>…, Correct, Difficulty, Explanation, WhyA, WhyB, WhyC, WhyD</code></p>
          <p className="mt-1 text-slate-500 dark:text-slate-400"><b>MCQ:</b> <code>Question, Option A, Option B, Option C, Option D, …tail</code></p>
          <p className="mt-1 text-slate-500 dark:text-slate-400"><b>Matching:</b> <code>matching, Question, ColumnA, ColumnB, Option A–D, …tail</code></p>
          <p className="mt-1 text-slate-500 dark:text-slate-400"><b>Statement:</b> <code>statement, Intro, Statements, Option A–D, …tail</code></p>
          <p className="mt-1 text-slate-500 dark:text-slate-400"><b>Pair:</b> <code>pair, Intro, LeftList, RightList, Option A–D, …tail</code></p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-500 dark:text-slate-400">
            <li><b>Correct</b>: A/B/C/D (or 1–4) — the correct answer option.</li>
            <li><b>Explanation</b>: the <b>detailed</b> explanation of the correct answer (shown after answering).</li>
            <li><b>WhyA–WhyD</b> (optional): a <b>brief</b> note for each option explaining why it is wrong — shown when a student picks it. Leave the correct option's cell blank (it's ignored).</li>
            <li><b>Lists</b> (ColumnA/ColumnB, Statements, LeftList/RightList): separate items with a pipe <code>|</code>, e.g. <code>"Newton|Bohr|Curie"</code>.</li>
            <li><b>Matching option</b> is a sequence like <code>1-III, 2-I, 3-IV, 4-II</code>. <b>Statement</b> options are combos like <code>"1 and 2 only"</code>. <b>Pair</b> options are counts like <code>"Only two pairs"</code>.</li>
            <li>Wrap any value containing a comma in "double quotes". Difficulty, Explanation &amp; Why columns are optional.</li>
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
