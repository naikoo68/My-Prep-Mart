import MathText from "./MathText";

// The closing prompt shown under the statements/pairs list for these types.
export function closingPrompt(type) {
  if (type === "statement") return "Which of the statement(s) given above is/are correct?";
  if (type === "pair") return "How many of the above pairs are correctly matched?";
  if (type === "pairselect") return "Which of the pairs given above is/are correctly matched?";
  return "";
}

// Renders the numbered list that sits between the question stem and the answer
// options for statement/pair/pairselect question types:
//  - statement:  columnA holds the statements → "1. <statement>"
//  - pair:       columnA/columnB hold the two sides → "1. <left> — <right>"
//                (options are counts: "Only one pair"…)
//  - pairselect: same list as pair, but options are combinations ("1 and 2 only"…)
export default function StatementPairView({ q }) {
  if (!q) return null;

  let rows = null;
  if (q.type === "statement") {
    rows = (q.columnA || [])
      .filter((s) => s != null && String(s).trim() !== "")
      .map((s) => <MathText>{s}</MathText>);
  } else if (q.type === "pair" || q.type === "pairselect") {
    const left = q.columnA || [];
    const right = q.columnB || [];
    const n = Math.max(left.length, right.length);
    rows = Array.from({ length: n }, (_, i) => [left[i], right[i]])
      .filter(([a, b]) => (a && String(a).trim()) || (b && String(b).trim()))
      .map(([a, b]) => (
        <span className="flex flex-wrap items-center gap-1">
          <MathText>{a}</MathText>
          <span className="mx-1 text-slate-400">—</span>
          <MathText>{b}</MathText>
        </span>
      ));
  }

  if (!rows || !rows.length) return null;

  return (
    <div className="mt-3">
      <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        {rows.map((content, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="font-bold text-brand-700 dark:text-brand-300">{i + 1}.</span>
            {content}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">{closingPrompt(q.type)}</p>
    </div>
  );
}
