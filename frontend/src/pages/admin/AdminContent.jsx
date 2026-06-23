import { useEffect, useState } from "react";
import { Plus, Trash2, Image as ImageIcon, X, Search } from "lucide-react";
import { contentService } from "../../services";
import Badge from "../../components/ui/Badge";
import { Loading, ErrorState, EmptyState } from "../../components/ui/AsyncState";

const tabs = ["Subjects", "Questions"];

const blankQuestion = {
  subject: "",
  text: "",
  options: ["", "", "", ""],
  correct: 0,
  difficulty: "Easy",
  explanation: "",
  status: "published",
};

export default function AdminContent() {
  const [tab, setTab] = useState("Questions");
  const [subjects, setSubjects] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // 'question' | 'subject'
  const [form, setForm] = useState(blankQuestion);
  const [subjectName, setSubjectName] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([contentService.subjects(), contentService.allQuestions()])
      .then(([subs, qs]) => {
        setSubjects(subs);
        setQuestions(qs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openAddQuestion = () => {
    setForm({ ...blankQuestion, subject: subjects[0]?._id || "" });
    setModal("question");
  };

  const saveQuestion = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await contentService.createQuestion(form);
      const subj = subjects.find((s) => s._id === form.subject);
      setQuestions((qs) => [{ ...created, subject: subj?.name || "—", session: "—" }, ...qs]);
      setModal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (id) => {
    try {
      await contentService.deleteQuestion(id);
      setQuestions((qs) => qs.filter((q) => q._id !== id));
    } catch (e) {
      setError(e.message);
    }
  };

  const createSubject = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await contentService.createSubject({ name: subjectName });
      setSubjects((s) => [...s, { ...created, chapters: 0 }]);
      setModal(null);
      setSubjectName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSubject = async (id) => {
    try {
      await contentService.deleteSubject(id);
      setSubjects((s) => s.filter((x) => x._id !== id));
    } catch (e) {
      setError(e.message);
    }
  };

  const filteredQ = questions.filter(
    (q) =>
      q.text.toLowerCase().includes(search.toLowerCase()) ||
      (q.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Content Management</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage subjects and questions.</p>
        </div>
        <div className="flex gap-2">
          {tab === "Questions" ? (
            <button onClick={openAddQuestion} className="btn-primary" disabled={!subjects.length}>
              <Plus className="h-4 w-4" /> Add Question
            </button>
          ) : (
            <button onClick={() => setModal("subject")} className="btn-primary">
              <Plus className="h-4 w-4" /> Add Subject
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading label="Loading content..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : tab === "Subjects" ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3 font-semibold">Subject</th>
                <th className="px-5 py-3 font-semibold">Sessions</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {subjects.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3">{s.chapters ?? 0} sessions</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => deleteSubject(s._id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions..." className="input pl-9" />
          </div>
          {filteredQ.length === 0 ? (
            <EmptyState message="No questions found." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Question</th>
                    <th className="px-5 py-3 font-semibold">Subject</th>
                    <th className="px-5 py-3 font-semibold">Difficulty</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredQ.map((q) => (
                    <tr key={q._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="max-w-xs px-5 py-3">
                        <p className="truncate font-medium">{q.text}</p>
                        <p className="text-xs text-slate-400">{q.session}</p>
                      </td>
                      <td className="px-5 py-3">{q.subject}</td>
                      <td className="px-5 py-3"><Badge variant={q.difficulty}>{q.difficulty}</Badge></td>
                      <td className="px-5 py-3">
                        <Badge variant={q.status === "published" ? "brand" : "neutral"}>{q.status}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => deleteQuestion(q._id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Question modal */}
      {modal === "question" && (
        <Modal title="Add Question" onClose={() => setModal(null)}>
          <form onSubmit={saveQuestion} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Subject</label>
              <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input" required>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Question Text</label>
              <textarea required rows={2} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className="input resize-none" placeholder="Enter the question..." />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Image URL (optional)</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 dark:border-slate-700">
                <ImageIcon className="h-4 w-4 text-slate-400" />
                <input
                  value={form.image || ""}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  className="w-full bg-transparent py-2.5 text-sm focus:outline-none"
                  placeholder="https://res.cloudinary.com/..."
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Options (select the correct one)</label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" checked={form.correct === i} onChange={() => setForm({ ...form, correct: i })} className="h-4 w-4 text-brand-600" />
                    <input
                      required
                      value={opt}
                      onChange={(e) => {
                        const opts = [...form.options];
                        opts[i] = e.target.value;
                        setForm({ ...form, options: opts });
                      }}
                      className="input"
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Difficulty</label>
                <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="input">
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Explanation / Solution</label>
              <textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} className="input resize-none" placeholder="Explain the correct answer..." />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-outline">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Question"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Subject modal */}
      {modal === "subject" && (
        <Modal title="Add Subject" onClose={() => setModal(null)}>
          <form onSubmit={createSubject} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Subject Name</label>
              <input required value={subjectName} onChange={(e) => setSubjectName(e.target.value)} className="input" placeholder="e.g. Statistics" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-outline">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : "Create"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-lg animate-scale-in card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
