import { uploadImage, isCloudinaryConfigured } from "./cloudinary.js";
import Settings from "../models/Settings.js";

// Renders a question into a clean 1080×1080 "card" image for Facebook/Instagram.
// Built as an SVG (no native deps) and rasterised to PNG by Cloudinary (already
// configured for this app). If anything fails, callers fall back to a text post.

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
const esc = (s) => String(s || "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
const plain = (s) => String(s || "").replace(/\$/g, "").replace(/\s+/g, " ").trim();

// Greedy word-wrap to a max character count per line (approx for the font size).
function wrap(text, maxChars) {
  const words = plain(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) cur = (cur + " " + w).trim();
    else { if (cur) lines.push(cur); cur = w.length > maxChars ? w.slice(0, maxChars - 1) + "…" : w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

const T = (x, y, s, fill, txt, { weight = "400", anchor = "start", ls = "0" } = {}) =>
  `<text x="${x}" y="${y}" font-size="${s}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" font-family="Arial, Helvetica, sans-serif">${txt}</text>`;
const RR = (x, y, w, h, r, fill, stroke = "none", sw = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke !== "none" ? ` stroke="${stroke}" stroke-width="${sw}"` : ""}/>`;

// Renders the question to look like the student quiz card: difficulty pill,
// stem, styled Column A / Column B boxes with numbered & roman badges, then the
// options in rounded boxes. Height grows with content (clamped for Instagram).
function buildQuestionSvg(q, opts = {}) {
  const W = 1080, PAD = 56;
  const brand = opts.brandColor || "#4f46e5";
  const accent = "#ea580c"; // Column B accent (orange, like the app)
  const siteName = esc(opts.siteName || "My Study Guide");
  const els = [];
  let y = 150; // start below the header bar

  // Difficulty pill + tag.
  const diff = q.difficulty || "Medium";
  const dc = diff === "Hard" ? ["#fee2e2", "#dc2626"] : diff === "Easy" ? ["#dcfce7", "#16a34a"] : ["#fef9c3", "#ca8a04"];
  els.push(RR(PAD, y, 118, 46, 12, dc[0]));
  els.push(T(PAD + 59, y + 31, 26, dc[1], esc(diff), { weight: "700", anchor: "middle" }));
  els.push(T(W - PAD, y + 31, 26, "#94a3b8", "Question of the day", { anchor: "end" }));
  y += 46 + 34;

  // Stem.
  wrap(q.text || "Question", 46).forEach((ln, i) => { y += i === 0 ? 44 : 50; els.push(T(PAD, y, 40, "#0f172a", esc(ln), { weight: "800" })); });
  y += 34;

  const isColumns = ["matching", "pair", "pairselect"].includes(q.type) && Array.isArray(q.columnA) && q.columnA.length;
  const isStatements = q.type === "statement" && Array.isArray(q.columnA) && q.columnA.length;

  // Column renderer → returns rendered elements + the box height.
  const renderColumn = (title, titleColor, items, badgeBg, badgeColor, x, colW, y0) => {
    const inner = [];
    let yy = y0 + 46;
    inner.push(T(x + 24, yy, 24, titleColor, title, { weight: "800", ls: "1.5" }));
    yy += 20;
    items.forEach((it) => {
      const by = yy + 8;
      inner.push(RR(x + 24, by, 36, 36, 9, badgeBg));
      inner.push(T(x + 42, by + 25, 20, badgeColor, esc(it.badge), { weight: "700", anchor: "middle" }));
      it.lines.forEach((ln, k) => inner.push(T(x + 74, by + 26 + k * 34, 28, "#1e293b", esc(ln))));
      yy += Math.max(46, it.lines.length * 34 + 14);
    });
    return { inner, height: yy - y0 + 18 };
  };

  if (isColumns) {
    const gap = 28;
    const colW = (W - 2 * PAD - gap) / 2;
    const itemChars = Math.max(14, Math.floor((colW - 90) / 15));
    const colA = (q.columnA || []).map((t, i) => ({ badge: String(i + 1), lines: wrap(plain(t), itemChars) }));
    const colB = (q.columnB || []).map((t, i) => ({ badge: ROMAN[i] || String(i + 1), lines: wrap(plain(t), itemChars) }));
    const a = renderColumn("COLUMN A", brand, colA, "#eef2ff", brand, PAD, colW, y);
    const b = renderColumn("COLUMN B", accent, colB, "#fff7ed", accent, PAD + colW + gap, colW, y);
    const h = Math.max(a.height, b.height);
    els.push(RR(PAD, y, colW, h, 16, "#ffffff", "#e2e8f0", 2));
    els.push(RR(PAD + colW + gap, y, colW, h, 16, "#ffffff", "#e2e8f0", 2));
    els.push(...a.inner, ...b.inner);
    y += h + 30;
  } else if (isStatements) {
    const items = (q.columnA || []).map((t, i) => ({ badge: String(i + 1), lines: wrap(plain(t), 60) }));
    const c = renderColumn("STATEMENTS", brand, items, "#eef2ff", brand, PAD, W - 2 * PAD, y);
    els.push(RR(PAD, y, W - 2 * PAD, c.height, 16, "#ffffff", "#e2e8f0", 2));
    els.push(...c.inner);
    y += c.height + 30;
  } else if (q.type === "assertion" && (q.assertion || q.reason)) {
    [["Assertion (A)", q.assertion], ["Reason (R)", q.reason]].forEach(([lab, txt]) => {
      if (!txt) return;
      els.push(T(PAD, y + 30, 26, brand, lab, { weight: "700" })); y += 40;
      wrap(plain(txt), 58).forEach((ln) => { els.push(T(PAD, y + 26, 30, "#1e293b", esc(ln))); y += 38; });
      y += 8;
    });
    y += 8;
  }

  // Prompt label above the options.
  const prompt = { matching: "Choose the correct matching sequence:", pair: "How many pairs are correctly matched?", pairselect: "Which pairs are correctly matched?", statement: "Which statement(s) is/are correct?" }[q.type] || "Choose the correct option:";
  if (opts.includeOptions !== false && Array.isArray(q.options) && q.options.length) {
    els.push(T(PAD, y + 22, 26, "#64748b", esc(prompt))); y += 44;
    q.options.forEach((o, i) => {
      const lines = wrap(plain(o), 50);
      const boxH = Math.max(66, lines.length * 40 + 26);
      const correct = opts.includeAnswer && i === q.correct;
      els.push(RR(PAD, y, W - 2 * PAD, boxH, 16, correct ? "#ecfdf5" : "#ffffff", correct ? "#059669" : "#e2e8f0", 2));
      els.push(RR(PAD + 18, y + boxH / 2 - 19, 38, 38, 19, correct ? "#059669" : "#f1f5f9"));
      els.push(T(PAD + 37, y + boxH / 2 + 8, 22, correct ? "#ffffff" : "#475569", `(${String.fromCharCode(97 + i)})`, { weight: "700", anchor: "middle" }));
      lines.forEach((ln, k) => els.push(T(PAD + 76, y + boxH / 2 + 8 - (lines.length - 1) * 20 + k * 40, 30, correct ? "#065f46" : "#1e293b", esc(ln), { weight: correct ? "700" : "500" })));
      y += boxH + 14;
    });
  }
  if (opts.includeAnswer && Number.isInteger(q.correct)) { els.push(T(PAD, y + 30, 30, "#059669", `✓ Answer: ${LETTERS[q.correct] || q.correct + 1}`, { weight: "800" })); y += 46; }
  else if (opts.includeOptions !== false) { els.push(T(PAD, y + 30, 30, brand, "👉 Comment your answer!", { weight: "700" })); y += 46; }

  if (opts.hashtags) { els.push(T(PAD, y + 30, 26, brand, esc(plain(opts.hashtags)))); y += 40; }

  // Final canvas height (Instagram-friendly: 1080–1350). Content beyond clips.
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
    // Force PNG output so Facebook/Instagram get a real raster image.
    const { url } = await uploadImage(dataUri, { format: "png", folder: "mystudyguide/social" });
    return url || null;
  } catch {
    return null;
  }
}
