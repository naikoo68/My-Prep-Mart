import { useEffect, useState } from "react";
import { X, Move, Loader2 } from "lucide-react";
import { practiceService } from "../../services";

// Move a practice item (My Quiz / My Test) to a different destination:
// Stream → Subject → (Topic, for My Quiz). Scoped to the caller's own content.
export default function MoveItemModal({ open, item, onClose, onDone }) {
  const kind = item?.practiceKind || item?.kind || "quiz";
  const isQuiz = kind === "quiz";
  const [streams, setStreams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [sel, setSel] = useState({ stream: "", subject: "", topic: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setSel({ stream: "", subject: "", topic: "" });
    setSubjects([]);
    setTopics([]);
    setMsg("");
    practiceService.adminStreams(kind).then(setStreams).catch(() => setStreams([]));
  }, [open, kind]);

  if (!open) return null;

  const pickStream = (v) => {
    setSel({ stream: v, subject: "", topic: "" });
    setSubjects([]);
    setTopics([]);
    if (v) practiceService.adminSubjects(v).then(setSubjects).catch(() => setSubjects([]));
  };
  const pickSubject = (v) => {
    setSel((s) => ({ ...s, subject: v, topic: "" }));
    setTopics([]);
    if (v && isQuiz) practiceService.adminTopics(v).then(setTopics).catch(() => setTopics([]));
  };

  const submit = async () => {
    if (!sel.stream || !sel.subject || (isQuiz && !sel.topic)) {
      setMsg("Choose the full destination.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await practiceService.moveItem(item._id, {
        practiceStream: sel.stream,
        practiceSubject: sel.subject,
        practiceTopic: isQuiz ? sel.topic : undefined,
      });
      onDone?.();
      onClose();
    } catch (e) {
      setMsg(e.message || "Couldn't move the item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-10 w-full max-w-md animate-scale-in card p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Move className="h-5 w-5 text-brand-600" /> Move {isQuiz ? "quiz" : "test"}
          </h3>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 truncate text-sm text-slate-500 dark:text-slate-400">{item?.name}</p>

        <div className="space-y-3">
          <select value={sel.stream} onChange={(e) => pickStream(e.target.value)} className="input">
            <option value="">Destination stream…</option>
            {streams.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <select value={sel.subject} onChange={(e) => pickSubject(e.target.value)} className="input" disabled={!sel.stream}>
            <option value="">Destination subject…</option>
            {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          {isQuiz && (
            <select value={sel.topic} onChange={(e) => setSel((s) => ({ ...s, topic: e.target.value }))} className="input" disabled={!sel.subject}>
              <option value="">Destination topic…</option>
              {topics.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          )}
        </div>

        {msg && <p className="mt-3 text-sm font-medium text-rose-600">{msg}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          <button type="button" onClick={submit} disabled={busy} className="btn-primary">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Moving…</> : "Move here"}
          </button>
        </div>
      </div>
    </div>
  );
}
