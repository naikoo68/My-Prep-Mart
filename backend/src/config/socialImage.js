import { uploadImage, isCloudinaryConfigured } from "./cloudinary.js";
import Settings from "../models/Settings.js";

// Renders a question into a quiz-style card image for Facebook/Instagram, built
// as an SVG and rasterised to PNG by Cloudinary. LaTeX is rendered natively in
// the SVG: \frac{a}{b} becomes a real STACKED fraction with a bar, and the rest
// (superscripts, Greek, operators) is converted to Unicode. No dependencies.

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
const esc = (s) => String(s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

// ---- LaTeX → Unicode (for everything except \frac, handled by the layout) ---
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ", "a": "ᵃ", "b": "ᵇ", "x": "ˣ" };
const SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", "n": "ₙ", "i": "ᵢ", "a": "ₐ", "x": "ₓ" };
const GREEK = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω" };
const OPS = { times: "×", div: "÷", pm: "±", mp: "∓", cdot: "·", ast: "∗", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", cong: "≅", sim: "∼", propto: "∝", rightarrow: "→", Rightarrow: "⇒", to: "→", leftarrow: "←", leftrightarrow: "↔", longrightarrow: "→", infty: "∞", prod: "∏", sum: "∑", int: "∫", partial: "∂", nabla: "∇", angle: "∠", perp: "⊥", parallel: "∥", cup: "∪", cap: "∩", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇", in: "∈", notin: "∉", forall: "∀", exists: "∃", therefore: "∴", because: "∵", cdots: "⋯", ldots: "…", dots: "…", prime: "′", circ: "∘", degree: "°", deg: "°", bullet: "•", ell: "ℓ", emptyset: "∅" };
const toScript = (str, map) => String(str).split("").map((c) => map[c] || c).join("");

function uni(input) {
  let s = String(input || "").replace(/\$/g, "");
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)");
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, "$1");
  s = s.replace(/\^\{([^{}]*)\}/g, (_, g) => toScript(g, SUP)).replace(/\^\s*([A-Za-z0-9+\-()])/g, (_, g) => toScript(g, SUP));
  s = s.replace(/_\{([^{}]*)\}/g, (_, g) => toScript(g, SUB)).replace(/_\s*([A-Za-z0-9+\-()])/g, (_, g) => toScript(g, SUB));
  s = s.replace(/\\left|\\right|\\!|\\,|\\;|\\:|\\quad|\\qquad/g, " ");
  s = s.replace(/\\([A-Za-z]+)/g, (_, name) => GREEK[name] || OPS[name] || "");
  s = s.replace(/[{}\\^_]/g, "");
  return s.replace(/\s+/g, " ").trim();
}

const T = (x, y, s, fill, txt, { weight = "400", anchor = "start", ls = "0" } = {}) =>
  `<text x="${x}" y="${y}" font-size="${s}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" font-family="Arial, Helvetica, sans-serif">${txt}</text>`;
const RR = (x, y, w, h, r, fill, stroke = "none", sw = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke !== "none" ? ` stroke="${stroke}" stroke-width="${sw}"` : ""}/>`;

const measure = (t, fs) => String(t).length * fs * 0.52; // approx text width
const hasFrac = (s) => /\\[dt]?frac/.test(String(s || ""));

// Read the two {..} groups after \frac (brace-balanced). Returns {a,b,end}|null.
function readTwoGroups(s, pos) {
  const grab = (p) => {
    while (p < s.length && s[p] === " ") p++;
    if (s[p] !== "{") return null;
    let depth = 0;
    for (let i = p; i < s.length; i++) { if (s[i] === "{") depth++; else if (s[i] === "}") { depth--; if (depth === 0) return { val: s.slice(p + 1, i), end: i + 1 }; } }
    return null;
  };
  const a = grab(pos); if (!a) return null;
  const b = grab(a.end); if (!b) return null;
  return { a: a.val, b: b.val, end: b.end };
}

// Inline math layout relative to origin (x=0, baseline y=0). Handles \frac as a
// real stacked fraction with a rule; other math becomes Unicode text.
function layoutInline(str, fs, color, weight = "400") {
  const parts = [];
  let x = 0, ascent = fs * 0.72, descent = fs * 0.22, buf = "", i = 0;
  const flush = () => { if (!buf) return; const u = uni(buf); if (u) { parts.push(T(x.toFixed(1), 0, fs, color, esc(u), { weight })); x += measure(u, fs); } buf = ""; };
  while (i < str.length) {
    const isFrac = str.startsWith("\\frac", i) || str.startsWith("\\dfrac", i) || str.startsWith("\\tfrac", i);
    if (isFrac) {
      const skip = /^\\[dt]frac/.test(str.slice(i)) ? 6 : 5;
      const g = readTwoGroups(str, i + skip);
      if (g) {
        flush();
        const nf = fs * 0.86;
        const nl = layoutInline(g.a, nf, color, weight);
        const dl = layoutInline(g.b, nf, color, weight);
        const fw = Math.max(nl.w, dl.w) + 12;
        const barY = -fs * 0.32;
        const numB = barY - fs * 0.08 - 0.2 * nf;
        const denB = barY + fs * 0.08 + 0.75 * nf;
        parts.push(`<g transform="translate(${(x + (fw - nl.w) / 2).toFixed(1)},${numB.toFixed(1)})">${nl.svg}</g>`);
        parts.push(`<line x1="${(x + 4).toFixed(1)}" y1="${barY.toFixed(1)}" x2="${(x + fw - 4).toFixed(1)}" y2="${barY.toFixed(1)}" stroke="${color}" stroke-width="${Math.max(1.6, fs * 0.05).toFixed(1)}"/>`);
        parts.push(`<g transform="translate(${(x + (fw - dl.w) / 2).toFixed(1)},${denB.toFixed(1)})">${dl.svg}</g>`);
        x += fw + fs * 0.12;
        ascent = Math.max(ascent, -numB + nl.ascent);
        descent = Math.max(descent, denB + dl.descent);
        i = g.end;
        continue;
      }
    }
    buf += str[i]; i++;
  }
  flush();
  return { w: x, ascent, descent, svg: parts.join("") };
}

// Height a content string will occupy in `availW` at font `size`.
function measureContent(str, availW, size) {
  if (hasFrac(str)) {
    const lay = layoutInline(String(str), size, "#000");
    const scale = lay.w > availW ? availW / lay.w : 1;
    return (lay.ascent + lay.descent) * scale + 6;
  }
  const lines = wrap(str, Math.max(8, Math.floor(availW / (size * 0.52))));
  return Math.max(size * 1.28, lines.length * size * 1.28);
}

// Emit a content string into `els` at (x, yTop) within `availW`. Returns height.
function emitContent(els, str, x, yTop, availW, { size, color, weight = "400" }) {
  if (hasFrac(str)) {
    const lay = layoutInline(String(str), size, color, weight);
    const scale = lay.w > availW ? availW / lay.w : 1;
    const asc = lay.ascent * scale;
    els.push(`<g transform="translate(${x.toFixed(1)},${(yTop + asc).toFixed(1)}) scale(${scale.toFixed(3)})">${lay.svg}</g>`);
    return (lay.ascent + lay.descent) * scale + 6;
  }
  const lines = wrap(str, Math.max(8, Math.floor(availW / (size * 0.52))));
  const lineH = size * 1.28;
  lines.forEach((ln, k) => els.push(T(x, yTop + size + k * lineH, size, color, esc(ln), { weight })));
  return Math.max(lineH, lines.length * lineH);
}

// Greedy word-wrap on the Unicode-converted text (used for non-fraction text).
function wrap(text, maxChars) {
  const words = uni(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) cur = (cur + " " + w).trim();
    else { if (cur) lines.push(cur); cur = w.length > maxChars ? w.slice(0, maxChars - 1) + "…" : w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Build the quiz-style card SVG.
function buildQuestionSvg(q, opts = {}) {
  const W = 1080, PAD = 56;
  const brand = opts.brandColor || "#4f46e5";
  const accent = "#ea580c";
  const siteName = esc(uni(opts.siteName || "My Study Guide"));
  const els = [];
  let y = 150;

  const diff = q.difficulty || "Medium";
  const dc = diff === "Hard" ? ["#fee2e2", "#dc2626"] : diff === "Easy" ? ["#dcfce7", "#16a34a"] : ["#fef9c3", "#ca8a04"];
  els.push(RR(PAD, y, 118, 46, 12, dc[0]));
  els.push(T(PAD + 59, y + 31, 26, dc[1], esc(diff), { weight: "700", anchor: "middle" }));
  els.push(T(W - PAD, y + 31, 26, "#94a3b8", "Question of the day", { anchor: "end" }));
  y += 46 + 30;

  // Stem.
  y += emitContent(els, q.text || "Question", PAD, y, W - 2 * PAD, { size: 40, color: "#0f172a", weight: "800" }) + 26;

  const isColumns = ["matching", "pair", "pairselect"].includes(q.type) && Array.isArray(q.columnA) && q.columnA.length;
  const isStatements = q.type === "statement" && Array.isArray(q.columnA) && q.columnA.length;

  const renderColumn = (title, titleColor, items, badgeBg, badgeColor, x, colW, y0) => {
    const inner = [];
    let yy = y0 + 46;
    inner.push(T(x + 24, yy, 24, titleColor, title, { weight: "800", ls: "1.5" }));
    yy += 20;
    items.forEach((it) => {
      const by = yy + 8;
      inner.push(RR(x + 24, by, 36, 36, 9, badgeBg));
      inner.push(T(x + 42, by + 25, 20, badgeColor, esc(it.badge), { weight: "700", anchor: "middle" }));
      const h = emitContent(inner, it.text, x + 74, by - 2, colW - 90, { size: 28, color: "#1e293b" });
      yy += Math.max(46, h + 12);
    });
    return { inner, height: yy - y0 + 18 };
  };

  if (isColumns) {
    const gap = 28;
    const colW = (W - 2 * PAD - gap) / 2;
    const colA = (q.columnA || []).map((t, i) => ({ badge: String(i + 1), text: String(t) }));
    const colB = (q.columnB || []).map((t, i) => ({ badge: ROMAN[i] || String(i + 1), text: String(t) }));
    const a = renderColumn("COLUMN A", brand, colA, "#eef2ff", brand, PAD, colW, y);
    const b = renderColumn("COLUMN B", accent, colB, "#fff7ed", accent, PAD + colW + gap, colW, y);
    const h = Math.max(a.height, b.height);
    els.push(RR(PAD, y, colW, h, 16, "#ffffff", "#e2e8f0", 2));
    els.push(RR(PAD + colW + gap, y, colW, h, 16, "#ffffff", "#e2e8f0", 2));
    els.push(...a.inner, ...b.inner);
    y += h + 30;
  } else if (isStatements) {
    const items = (q.columnA || []).map((t, i) => ({ badge: String(i + 1), text: String(t) }));
    const c = renderColumn("STATEMENTS", brand, items, "#eef2ff", brand, PAD, W - 2 * PAD, y);
    els.push(RR(PAD, y, W - 2 * PAD, c.height, 16, "#ffffff", "#e2e8f0", 2));
    els.push(...c.inner);
    y += c.height + 30;
  } else if (q.type === "assertion" && (q.assertion || q.reason)) {
    [["Assertion (A)", q.assertion], ["Reason (R)", q.reason]].forEach(([lab, txt]) => {
      if (!txt) return;
      els.push(T(PAD, y + 28, 26, brand, lab, { weight: "700" })); y += 38;
      y += emitContent(els, txt, PAD, y, W - 2 * PAD, { size: 30, color: "#1e293b" }) + 10;
    });
  }

  const prompt = { matching: "Choose the correct matching sequence:", pair: "How many pairs are correctly matched?", pairselect: "Which pairs are correctly matched?", statement: "Which statement(s) is/are correct?" }[q.type] || "Choose the correct option:";
  if (opts.includeOptions !== false && Array.isArray(q.options) && q.options.length) {
    els.push(T(PAD, y + 22, 26, "#64748b", esc(prompt))); y += 44;
    q.options.forEach((o, i) => {
      const correct = opts.includeAnswer && i === q.correct;
      const availW = W - 2 * PAD - 76 - 24;
      const contentH = measureContent(o, availW, 30);
      const boxH = Math.max(66, contentH + 26);
      els.push(RR(PAD, y, W - 2 * PAD, boxH, 16, correct ? "#ecfdf5" : "#ffffff", correct ? "#059669" : "#e2e8f0", 2));
      els.push(RR(PAD + 18, y + boxH / 2 - 19, 38, 38, 19, correct ? "#059669" : "#f1f5f9"));
      els.push(T(PAD + 37, y + boxH / 2 + 8, 22, correct ? "#ffffff" : "#475569", `(${String.fromCharCode(97 + i)})`, { weight: "700", anchor: "middle" }));
      emitContent(els, o, PAD + 76, y + (boxH - contentH) / 2, availW, { size: 30, color: correct ? "#065f46" : "#1e293b", weight: correct ? "700" : "500" });
      y += boxH + 14;
    });
  }
  if (opts.includeAnswer && Number.isInteger(q.correct)) { els.push(T(PAD, y + 30, 30, "#059669", `✓ Answer: ${LETTERS[q.correct] || q.correct + 1}`, { weight: "800" })); y += 46; }
  else if (opts.includeOptions !== false) { els.push(T(PAD, y + 30, 30, brand, "👉 Comment your answer!", { weight: "700" })); y += 46; }

  if (opts.hashtags) { els.push(T(PAD, y + 30, 26, brand, esc(uni(opts.hashtags)))); y += 40; }

  const H = Math.max(1080, Math.min(1350, y + 40));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f8fafc"/>
    <rect x="0" y="0" width="${W}" height="118" fill="${brand}"/>
    ${T(PAD, 74, 44, "#ffffff", siteName, { weight: "800" })}
    ${els.join("\n    ")}
    <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${brand}"/>
  </svg>`;
}

// Render a question to a hosted PNG URL (via Cloudinary). Returns the URL or
// null on any failure (caller falls back to a text post).
export async function renderQuestionImage(q, opts = {}) {
  if (!isCloudinaryConfigured()) return null;
  try {
    const s = await Settings.findOne({ key: "site" }).lean();
    const svg = buildQuestionSvg(q, {
      ...opts,
      siteName: opts.siteName || s?.siteName || "My Study Guide",
      brandColor: opts.brandColor || s?.brandColor || s?.primaryColor || "#4f46e5",
    });
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    const { url } = await uploadImage(dataUri, { format: "png", folder: "mystudyguide/social" });
    return url || null;
  } catch {
    return null;
  }
}
