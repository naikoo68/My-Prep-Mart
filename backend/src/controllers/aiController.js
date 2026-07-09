// AI Question Generator — talks to any OpenAI-compatible provider
// (TokenLab, OpenAI, Groq, DeepSeek, …). Configure via server env vars:
//   AI_API_KEY   — your provider key (required to enable the feature)
//   AI_BASE_URL  — base URL, default https://api.tokenlab.sh/v1
//   AI_MODEL     — one OR MANY model ids, comma-separated.
//                  e.g. "gpt-4o-mini, llama-3.3-70b, deepseek-chat"
//                  The first one is the default; the admin can pick any of
//                  them per-generation from a dropdown in the UI.
// The key lives ONLY on the server; the browser never sees it.

const BASE_URL = () => (process.env.AI_BASE_URL || "https://api.tokenlab.sh/v1").replace(/\/$/, "");

// Parse AI_MODEL into a clean list of model ids. Falls back to gpt-4o-mini.
function MODELS() {
  const raw = process.env.AI_MODEL || "gpt-4o-mini";
  const list = raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length ? list : ["gpt-4o-mini"];
}
const DEFAULT_MODEL = () => MODELS()[0];

// If the client asked for a specific model, only honour it when it is one of
// the configured models (prevents arbitrary model injection from the browser).
function resolveModel(requested) {
  const models = MODELS();
  return models.includes(requested) ? requested : models[0];
}

const TYPES = ["mcq", "matching", "statement", "pair", "pairselect", "assertion", "table"];
const DIFFS = ["Easy", "Medium", "Hard"];

// GET /api/ai/status — lets the admin UI show/hide the "Generate with AI"
// button and populate the model dropdown.
export function aiStatus(req, res) {
  res.json({
    enabled: !!process.env.AI_API_KEY,
    model: DEFAULT_MODEL(), // default / first configured model
    models: MODELS(), // full list for the dropdown
    baseUrl: BASE_URL(),
  });
}

const SYSTEM_PROMPT = `You are an exam-preparation question writer. You output ONLY valid JSON, no markdown, no commentary.
Return an object of the exact shape: {"questions": [ ... ]}.
Each question object uses these fields:
- "type": one of "mcq", "matching", "statement", "pair", "pairselect", "assertion", "table".
- "text": the question stem (may include LaTeX between $...$).
- "options": array of EXACTLY 4 answer strings.
- "correct": 0-based index (0-3) of the correct option in "options".
- "difficulty": one of "Easy", "Medium", "Hard".
- "explanation": a detailed explanation of why the correct option is right.
- "optionExplanations": array of EXACTLY 4 short strings, one per option, explaining why each is right/wrong. Leave the correct option's entry an empty string "".
Type-specific extra fields:
- "matching"/"pair"/"pairselect": also include "columnA" (array) and "columnB" (array) to match. Each option in "options" is a mapping like "1-III, 2-I, 3-IV, 4-II".
- "assertion": include "assertion" (Assertion A text) and "reason" (Reason R text). The 4 options should be the standard A&R choices.
- "table": include "tableRows" (2D array; first inner array is the header row).
Never include image URLs. Keep questions factually correct and self-contained.`;

function buildUserPrompt({ topic, count, difficulty, types, notes, plan }) {
  const lines = [`Topic / syllabus: ${topic}.`];

  if (Array.isArray(plan) && plan.length) {
    // Explicit per-bucket distribution (type × difficulty). List each bucket so
    // the model produces exactly the requested mix.
    const total = plan.reduce((s, b) => s + b.count, 0);
    lines.push(`Generate EXACTLY ${total} exam-prep questions, distributed precisely as follows:`);
    plan.forEach((b) => {
      lines.push(`- ${b.count} "${b.difficulty}" question(s) of type "${b.type}".`);
    });
    lines.push(`Each question's "type" and "difficulty" fields MUST match the bucket it belongs to.`);
  } else {
    const allowed = (types && types.length ? types : ["mcq"]).join(", ");
    lines.push(`Generate ${count} exam-prep questions.`);
    lines.push(`Allowed question types: ${allowed}. Prefer "mcq" unless another type fits better.`);
    lines.push(
      difficulty && DIFFS.includes(difficulty)
        ? `All questions must be "${difficulty}" difficulty.`
        : `Mix the difficulty across Easy, Medium and Hard.`
    );
  }

  if (notes) lines.push(`Extra instructions: ${notes}`);
  lines.push(`Return ONLY the JSON object {"questions":[...]}.`);
  return lines.join("\n");
}

// Pull the assistant's text out of an OpenAI-compatible response. Handles the
// normal string form AND Claude-style "content blocks" (an array of
// { type:"text", text:"..." }) that some proxies pass through unnormalized.
function extractContent(data) {
  const msg = data?.choices?.[0]?.message;
  const c = msg?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("");
  }
  // Some reasoning models expose the answer under a different key.
  if (typeof msg?.reasoning_content === "string") return msg.reasoning_content;
  return "";
}

// Last-resort recovery: if the JSON is truncated (e.g. the model ran out of
// tokens mid-array), scan for every complete, brace-balanced {...} object and
// parse them individually. This keeps whatever questions did finish.
function salvageObjects(text) {
  const out = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          const o = JSON.parse(text.slice(start, i + 1));
          if (o && typeof o === "object" && (o.text || o.options)) out.push(o);
        } catch {
          /* skip malformed fragment */
        }
        start = -1;
      }
    }
  }
  return out;
}

// Robustly pull a questions array out of the model's text output.
function parseQuestions(content) {
  let t = String(content || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  let obj;
  try {
    obj = JSON.parse(t);
  } catch {
    // Fall back to slicing the outermost object/array.
    const oStart = t.indexOf("{");
    const oEnd = t.lastIndexOf("}");
    const aStart = t.indexOf("[");
    const aEnd = t.lastIndexOf("]");
    const tryParse = (s, e) => {
      if (s === -1 || e === -1 || e <= s) return null;
      try {
        return JSON.parse(t.slice(s, e + 1));
      } catch {
        return null;
      }
    };
    obj = tryParse(oStart, oEnd) || tryParse(aStart, aEnd);
  }
  if (!obj) return salvageObjects(t); // last resort: recover from truncated JSON
  if (Array.isArray(obj)) return obj;
  if (Array.isArray(obj.questions)) return obj.questions;
  return [];
}

// Coerce anything the model returned into a valid Question document shape.
function normalize(list) {
  const clampIdx = (n) => Math.min(3, Math.max(0, parseInt(n, 10) || 0));
  const asStr = (x) => (x == null ? "" : String(x));
  const arrStr = (a) => (Array.isArray(a) ? a.map(asStr) : []);

  return (Array.isArray(list) ? list : [])
    .map((q) => {
      const type = TYPES.includes(q?.type) ? q.type : "mcq";

      let options = arrStr(q?.options);
      while (options.length < 4) options.push("");
      options = options.slice(0, 4);

      const correct = clampIdx(q?.correct);

      let oe = arrStr(q?.optionExplanations);
      while (oe.length < 4) oe.push("");
      oe = oe.slice(0, 4);
      oe[correct] = ""; // correct option needs no "why it's wrong" note

      const out = {
        type,
        text: asStr(q?.text).trim(),
        options,
        correct,
        difficulty: DIFFS.includes(q?.difficulty) ? q.difficulty : "Medium",
        explanation: asStr(q?.explanation).trim(),
        optionExplanations: oe,
        status: "published",
      };

      if (type === "matching" || type === "pair" || type === "pairselect") {
        out.columnA = arrStr(q?.columnA);
        out.columnB = arrStr(q?.columnB);
      }
      if (type === "assertion") {
        out.assertion = asStr(q?.assertion).trim();
        out.reason = asStr(q?.reason).trim();
        if (!out.text) out.text = "Consider the following Assertion (A) and Reason (R):";
      }
      if (type === "table") {
        out.tableRows = Array.isArray(q?.tableRows)
          ? q.tableRows.map((row) => arrStr(row))
          : [];
      }
      return out;
    })
    .filter((q) => q.text); // drop empty questions
}

const MAX_TOTAL = 100; // most questions per generate request
const CHUNK_SIZE = 15; // questions generated per provider call (keeps each reply small enough to not truncate)

// One provider call with transient-error retries. Returns { ok, status, content, detail }.
async function callProvider({ key, model, userPrompt, maxTokens }) {
  const payload = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: maxTokens,
  };
  // Gemini burns budget on hidden "thinking" which truncates JSON — turn it off
  // (sent only for Gemini; OpenAI/Claude reject this field).
  if (/gemini/i.test(model)) payload.reasoning_effort = "none";

  const TRANSIENT = [429, 500, 502, 503, 504];
  const WAITS = [1500, 3000, 6000, 9000];
  let resp;
  for (let attempt = 0; ; attempt++) {
    resp = await fetch(`${BASE_URL()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    });
    if (resp.ok || !TRANSIENT.includes(resp.status) || attempt >= WAITS.length) break;
    await new Promise((r) => setTimeout(r, WAITS[attempt]));
  }
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, detail };
  }
  const data = await resp.json();
  return { ok: true, content: extractContent(data) };
}

// Split a bucket plan into sub-plans that each total <= size.
function chunkPlan(plan, size) {
  const chunks = [];
  let cur = [];
  let curTotal = 0;
  for (const b of plan) {
    let remaining = b.count;
    while (remaining > 0) {
      const take = Math.min(remaining, size - curTotal);
      if (take > 0) {
        cur.push({ type: b.type, difficulty: b.difficulty, count: take });
        curTotal += take;
        remaining -= take;
      }
      if (curTotal >= size) { chunks.push(cur); cur = []; curTotal = 0; }
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// POST /api/ai/generate  (admin)
// Body: { topic, notes, model, plan:[{type,difficulty,count}] }  (or legacy { count, difficulty, types })
// Large batches are generated in several smaller provider calls and combined,
// so up to 100 questions can be produced reliably without token-limit truncation.
// Returns { questions:[...] } — NOT saved; the admin previews then inserts.
export async function generateQuestions(req, res) {
  const key = (process.env.AI_API_KEY || "").trim();
  if (!key) {
    return res.status(400).json({
      message:
        "AI is not configured. Add AI_API_KEY (and optionally AI_BASE_URL, AI_MODEL) to the server environment.",
    });
  }

  const topic = String(req.body?.topic || "").trim();
  if (!topic) return res.status(400).json({ message: "A topic is required." });

  const notes = String(req.body?.notes || "").trim();
  const model = resolveModel(String(req.body?.model || "").trim());

  // Explicit per-bucket plan [{ type, difficulty, count }] — sanitized and
  // capped at MAX_TOTAL without dropping buckets. Falls back to the legacy
  // count/difficulty/types path when no plan is provided.
  let plan = null;
  if (Array.isArray(req.body?.plan)) {
    plan = req.body.plan
      .filter((b) => b && TYPES.includes(b.type) && DIFFS.includes(b.difficulty))
      .map((b) => ({ type: b.type, difficulty: b.difficulty, count: Math.max(0, parseInt(b.count, 10) || 0) }))
      .filter((b) => b.count > 0);
    let running = 0;
    plan = plan
      .map((b) => {
        const c = Math.min(b.count, Math.max(0, MAX_TOTAL - running));
        running += c;
        return { ...b, count: c };
      })
      .filter((b) => b.count > 0);
    if (!plan.length) plan = null;
  }

  const count = Math.min(MAX_TOTAL, Math.max(1, parseInt(req.body?.count, 10) || 5));
  const difficulty = req.body?.difficulty;
  const types = Array.isArray(req.body?.types)
    ? req.body.types.filter((t) => TYPES.includes(t))
    : [];

  // Build the list of provider calls (chunks), each producing <= CHUNK_SIZE.
  const jobs = [];
  if (plan) {
    for (const sub of chunkPlan(plan, CHUNK_SIZE)) {
      const n = sub.reduce((s, b) => s + b.count, 0);
      jobs.push({ n, prompt: buildUserPrompt({ topic, notes, plan: sub }) });
    }
  } else {
    let remaining = count;
    while (remaining > 0) {
      const n = Math.min(CHUNK_SIZE, remaining);
      jobs.push({ n, prompt: buildUserPrompt({ topic, notes, count: n, difficulty, types }) });
      remaining -= n;
    }
  }

  try {
    const questions = [];
    let lastError = null;
    for (const job of jobs) {
      const maxTokens = Math.min(16000, 1500 + job.n * 700);
      const r = await callProvider({ key, model, userPrompt: job.prompt, maxTokens });
      if (!r.ok) {
        lastError = r;
        continue; // best-effort: keep whatever other chunks succeed
      }
      questions.push(...normalize(parseQuestions(r.content)));
    }

    if (!questions.length) {
      if (lastError) {
        const hint =
          lastError.status === 503 || lastError.status === 429
            ? " The AI model is busy right now — try again shortly, or pick a different model."
            : "";
        return res
          .status(502)
          .json({ message: `AI provider error (${lastError.status}).${hint} ${(lastError.detail || "").slice(0, 200)}` });
      }
      return res.status(422).json({
        message:
          "The AI replied but no questions could be read from its output. Try a lower count, a simpler topic, or a different model (e.g. gpt-4o-mini).",
      });
    }
    res.json({ questions, model, requested: jobs.reduce((s, j) => s + j.n, 0) });
  } catch (err) {
    res.status(502).json({ message: err?.message || "AI request failed." });
  }
}
