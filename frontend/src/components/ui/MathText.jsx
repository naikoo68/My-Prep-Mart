import katex from "katex";
import "katex/dist/katex.min.css";

// Renders text that may contain LaTeX math.
// Supports $...$ / $$...$$ AND the \(...\) / \[...\] delimiters that many AI
// models emit — all are normalised to $ form before rendering, so math in
// AI-generated questions AND explanations renders correctly.
//
// It also repairs a common AI artifact: literal "\n" / "\r\n" escape sequences
// left inside the text (instead of a real line break) are turned back into real
// line breaks in the prose (never inside math, so LaTeX like \neq is untouched).
function normalizeDelimiters(t) {
  return String(t ?? "")
    // \[ ... \]  →  $$ ... $$   (block math)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, e) => "$$" + e + "$$")
    // \( ... \)  →  $ ... $     (inline math)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, e) => "$" + e + "$");
}

// Turn stray literal "\n" (backslash + n) in PROSE into real newlines. Only used
// on non-math segments so real LaTeX commands (\neq, \nu, \times…) are safe.
const fixProseNewlines = (t) => t.replace(/\\r\\n|\\n|\\r/g, "\n");

export default function MathText({ children, className = "" }) {
  const text = normalizeDelimiters(children);

  if (!text.includes("$")) {
    // `whitespace-pre-line` preserves real line breaks in multi-line text.
    return <span className={`whitespace-pre-line ${className}`}>{fixProseNewlines(text)}</span>;
  }

  const parts = [];
  const regex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    parts.push({ type: "math", value: m[1] ?? m[2], block: !!m[1] });
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });

  return (
    <span className={`whitespace-pre-line ${className}`}>
      {parts.map((p, i) =>
        p.type === "math" ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(p.value, {
                throwOnError: false,
                displayMode: p.block,
              }),
            }}
          />
        ) : (
          <span key={i}>{fixProseNewlines(p.value)}</span>
        )
      )}
    </span>
  );
}
