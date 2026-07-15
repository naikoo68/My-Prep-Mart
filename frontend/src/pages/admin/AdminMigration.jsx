import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Loader2, ArrowRight } from "lucide-react";
import { practiceService, contentService, examService, testService } from "../../services";

// ---- Level definitions (cascading dropdowns) ----
// Each level: { key, label, load(parentId) → [{_id, name|title}], labelKey }
const L = {
  // My Quiz (practice) — down to the item
  pqStream: { key: "stream", label: "Stream…", load: () => practiceService.adminStreams("quiz") },
  pqSubject: { key: "subject", label: "Subject…", load: (v) => practiceService.adminSubjects(v) },
  pqTopic: { key: "topic", label: "Topic…", load: (v) => practiceService.adminTopics(v) },
  pqItem: { key: "item", label: "Quiz…", load: (v) => practiceService.adminTopicItems(v) },
  // My Test (practice) — item lives under a subject
  ptStream: { key: "stream", label: "Stream…", load: () => practiceService.adminStreams("test") },
  ptSubject: { key: "subject", label: "Subject…", load: (v) => practiceService.adminSubjects(v) },
  ptItem: { key: "item", label: "Test…", load: (v) => practiceService.adminItems(v, "test") },
  // Content (platform quizzes)
  cStream: { key: "stream", label: "Stream…", load: () => contentService.streams() },
  cSubject: { key: "subject", label: "Subject…", load: (v) => contentService.subjectsByStream(v) },
  cTopic: { key: "topic", label: "Topic…", load: (v) => contentService.topics(v), labelKey: "title" },
  cSession: { key: "session", label: "Session…", load: (v) => contentService.sessions(v), labelKey: "title" },
  cQuiz: { key: "quiz", label: "Quiz…", load: (v) => contentService.quizzes(v), labelKey: "title" },
  // Test Series (platform)
  exam: { key: "exam", label: "Exam…", load: () => examService.exams() },
  post: { key: "post", label: "Post…", load: (v) => examService.posts(v) },
  test: { key: "test", label: "Test…", load: (v) => testService.adminList(v) },
};

// ---- Flow config per (tab.type.variant) ----
// sourceKey/destKeys tell us which selected ids to read; migrate() calls the API.
function getFlow(key) {
  switch (key) {
    // QUIZ · Internal
    case "quiz.internal.myquiz":
      return {
        source: [L.pqStream, L.pqSubject, L.pqTopic, L.pqItem], sourceKey: "item",
        dest: [L.pqStream, L.pqSubject, L.pqTopic], destKeys: ["stream", "subject", "topic"],
        migrate: (s, d) => practiceService.moveItem(s.item, { practiceStream: d.stream, practiceSubject: d.subject, practiceTopic: d.topic }),
      };
    case "quiz.internal.content":
      return {
        source: [L.cStream, L.cSubject, L.cTopic, L.cSession, L.cQuiz], sourceKey: "quiz",
        dest: [L.cStream, L.cSubject, L.cTopic, L.cSession], destKeys: ["session"],
        migrate: (s, d) => contentService.moveQuiz(s.quiz, d.session),
      };
    // QUIZ · External
    case "quiz.external.toContent":
      return {
        source: [L.pqStream, L.pqSubject, L.pqTopic, L.pqItem], sourceKey: "item",
        dest: [L.cStream, L.cSubject, L.cTopic, L.cSession], destKeys: ["session"],
        migrate: (s, d) => testService.toQuiz(s.item, { session: d.session }),
      };
    case "quiz.external.toMyQuiz":
      return {
        source: [L.cStream, L.cSubject, L.cTopic, L.cSession, L.cQuiz], sourceKey: "quiz",
        dest: [L.pqStream, L.pqSubject, L.pqTopic], destKeys: ["stream", "subject", "topic"],
        migrate: (s, d) => testService.quizToMyQuiz(s.quiz, { practiceStream: d.stream, practiceSubject: d.subject, practiceTopic: d.topic }),
      };
    // TEST · Internal
    case "test.internal.mytest":
      return {
        source: [L.ptStream, L.ptSubject, L.ptItem], sourceKey: "item",
        dest: [L.ptStream, L.ptSubject], destKeys: ["stream", "subject"],
        migrate: (s, d) => practiceService.moveItem(s.item, { practiceStream: d.stream, practiceSubject: d.subject }),
      };
    case "test.internal.testseries":
      return {
        source: [L.exam, L.post, L.test], sourceKey: "test",
        dest: [L.exam, L.post], destKeys: ["exam", "post"],
        migrate: (s, d) => testService.moveTestSeries(s.test, { exam: d.exam, post: d.post }),
      };
    // TEST · External
    case "test.external.toSeries":
      return {
        source: [L.ptStream, L.ptSubject, L.ptItem], sourceKey: "item",
        dest: [L.exam, L.post], destKeys: ["exam", "post"],
        migrate: (s, d) => testService.toTestSeries(s.item, { exam: d.exam, post: d.post }),
      };
    case "test.external.toMyTest":
      return {
        source: [L.exam, L.post, L.test], sourceKey: "test",
        dest: [L.ptStream, L.ptSubject], destKeys: ["stream", "subject"],
        migrate: (s, d) => testService.toMyTest(s.test, { practiceStream: d.stream, practiceSubject: d.subject }),
      };
    default:
      return null;
  }
}

const VARIANTS = {
  "quiz.internal": [
    { key: "myquiz", label: "Within My Quiz (topic → topic)" },
    { key: "content", label: "Within Content (topic → topic)" },
  ],
  "quiz.external": [
    { key: "toContent", label: "My Quiz → Content" },
    { key: "toMyQuiz", label: "Content → My Quiz" },
  ],
  "test.internal": [
    { key: "mytest", label: "Within My Test (subject → subject)" },
    { key: "testseries", label: "Within Test Series (post → post)" },
  ],
  "test.external": [
    { key: "toSeries", label: "My Test → Test Series" },
    { key: "toMyTest", label: "Test Series → My Test" },
  ],
};

// Cascading dropdowns. Reports the full selection object up via onChange.
function Cascade({ levels, onChange }) {
  const [opts, setOpts] = useState([[]]);
  const [sel, setSel] = useState({});

  useEffect(() => {
    setSel({});
    setOpts([[]]);
    onChange?.({});
    levels[0].load().then((r) => setOpts([r || []])).catch(() => setOpts([[]]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  const pick = (i, value) => {
    const next = {};
    for (let k = 0; k < i; k++) next[levels[k].key] = sel[levels[k].key];
    next[levels[i].key] = value;
    setSel(next);
    onChange?.(next);
    setOpts((o) => o.slice(0, i + 1));
    const nextLevel = levels[i + 1];
    if (value && nextLevel) {
      nextLevel.load(value).then((r) => setOpts((o) => { const c = o.slice(0, i + 1); c[i + 1] = r || []; return c; })).catch(() => {});
    }
  };

  return (
    <div className="space-y-2">
      {levels.map((lv, i) => (
        <select
          key={lv.key + i}
          value={sel[lv.key] || ""}
          disabled={i > 0 && !sel[levels[i - 1].key]}
          onChange={(e) => pick(i, e.target.value)}
          className="input"
        >
          <option value="">{lv.label}</option>
          {(opts[i] || []).map((o) => (
            <option key={o._id} value={o._id}>{o[lv.labelKey || "name"] || o.name || o.title}</option>
          ))}
        </select>
      ))}
    </div>
  );
}

export default function AdminMigration() {
  const [tab, setTab] = useState("quiz"); // quiz | test
  const [type, setType] = useState("internal"); // internal | external
  const [variant, setVariant] = useState("myquiz");
  const [src, setSrc] = useState({});
  const [dst, setDst] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [nonce, setNonce] = useState(0); // bump to remount cascades (reset)

  const variantKey = `${tab}.${type}`;
  const variants = VARIANTS[variantKey] || [];

  // Default the variant whenever tab/type changes.
  useEffect(() => {
    setVariant((VARIANTS[`${tab}.${type}`] || [{ key: "" }])[0].key);
    setSrc({});
    setDst({});
    setMsg("");
    setOk(false);
  }, [tab, type]);

  const flowKey = `${tab}.${type}.${variant}`;
  const flow = useMemo(() => getFlow(flowKey), [flowKey]);

  const resetKey = `${flowKey}.${nonce}`;

  const migrate = async () => {
    if (!flow) return;
    if (!src[flow.sourceKey]) { setMsg("Choose the source (the item to move)."); setOk(false); return; }
    if (flow.destKeys.some((k) => !dst[k])) { setMsg("Choose the full destination."); setOk(false); return; }
    setBusy(true);
    setMsg("");
    try {
      await flow.migrate(src, dst);
      setOk(true);
      setMsg("✓ Migrated successfully.");
      setSrc({});
      setDst({});
      setNonce((n) => n + 1);
    } catch (e) {
      setOk(false);
      setMsg(e.message || "Migration failed.");
    } finally {
      setBusy(false);
    }
  };

  const Tab = ({ id, label, active, onClick }) => (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <ArrowRightLeft className="h-6 w-6 text-brand-600" /> Migration
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Move a quiz or test to another place. <b>Internal</b> = within the same area; <b>External</b> = between Content and My Practice.
        </p>
      </div>

      {/* Quiz / Test */}
      <div className="flex gap-2">
        <Tab id="quiz" label="Quiz" active={tab === "quiz"} onClick={() => setTab("quiz")} />
        <Tab id="test" label="Test" active={tab === "test"} onClick={() => setTab("test")} />
      </div>

      {/* Internal / External */}
      <div className="flex gap-2">
        <Tab id="internal" label="Internal migration" active={type === "internal"} onClick={() => setType("internal")} />
        <Tab id="external" label="External migration" active={type === "external"} onClick={() => setType("external")} />
      </div>

      {/* Variant (area or direction) */}
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => (
          <button
            key={v.key}
            onClick={() => { setVariant(v.key); setSrc({}); setDst({}); setMsg(""); setOk(false); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              variant === v.key ? "bg-accent-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {flow && (
        <div className="card p-6">
          <div className="grid gap-6 md:grid-cols-[1fr,auto,1fr] md:items-start">
            {/* Source */}
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Move this</p>
              <Cascade key={resetKey + "-src"} levels={flow.source} onChange={setSrc} />
            </div>

            <div className="hidden items-center justify-center pt-16 md:flex">
              <ArrowRight className="h-6 w-6 text-slate-400" />
            </div>

            {/* Destination */}
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">To here</p>
              <Cascade key={resetKey + "-dst"} levels={flow.dest} onChange={setDst} />
            </div>
          </div>

          {msg && <p className={`mt-4 text-sm font-medium ${ok ? "text-emerald-600" : "text-rose-600"}`}>{msg}</p>}

          <div className="mt-5 flex justify-end">
            <button onClick={migrate} disabled={busy} className="btn-primary">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Migrating…</> : <><ArrowRightLeft className="h-4 w-4" /> Migrate</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
