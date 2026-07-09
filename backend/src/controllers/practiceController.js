import PracticeStream from "../models/PracticeStream.js";
import PracticeSubject from "../models/PracticeSubject.js";
import TestSeries from "../models/TestSeries.js";
import Question from "../models/Question.js";
import { isTestVisibleToUser } from "../utils/accessControl.js";

// "Practice Quizzes" section. Items (My Quiz / My Test Series) are stored as
// TestSeries documents with practice=true, so they reuse the existing question
// management, per-student visibility and attempt/grading engine. They are
// hidden by default (visibleToAll:false) and never trigger notifications.

const slugify = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---------------- Streams (admin) ---------------- */
export async function listStreams(req, res) {
  const streams = await PracticeStream.find({ isActive: true }).sort("order name").lean();
  const subs = await PracticeSubject.aggregate([{ $group: { _id: "$stream", count: { $sum: 1 } } }]);
  const map = Object.fromEntries(subs.map((s) => [String(s._id), s.count]));
  res.json(streams.map((s) => ({ ...s, subjects: map[String(s._id)] || 0 })));
}
export async function createStream(req, res) {
  const s = await PracticeStream.create({ ...req.body, slug: slugify(req.body.name) });
  res.status(201).json(s);
}
export async function updateStream(req, res) {
  const d = { ...req.body };
  if (d.name) d.slug = slugify(d.name);
  const s = await PracticeStream.findByIdAndUpdate(req.params.id, d, { new: true });
  res.json(s);
}
export async function deleteStream(req, res) {
  const id = req.params.id;
  const items = await TestSeries.find({ practice: true, practiceStream: id }).select("questions");
  const qIds = items.flatMap((i) => i.questions || []);
  await Promise.all([
    Question.deleteMany({ _id: { $in: qIds } }),
    TestSeries.deleteMany({ practice: true, practiceStream: id }),
    PracticeSubject.deleteMany({ stream: id }),
    PracticeStream.findByIdAndDelete(id),
  ]);
  res.json({ message: "Practice stream and all its content deleted" });
}

/* ---------------- Subjects (admin) ---------------- */
export async function listSubjects(req, res) {
  const subjects = await PracticeSubject.find({ stream: req.params.streamId, isActive: true }).sort("order name").lean();
  const items = await TestSeries.aggregate([
    { $match: { practice: true, practiceSubject: { $ne: null } } },
    { $group: { _id: "$practiceSubject", count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(items.map((i) => [String(i._id), i.count]));
  res.json(subjects.map((s) => ({ ...s, items: map[String(s._id)] || 0 })));
}
export async function createSubject(req, res) {
  const s = await PracticeSubject.create({ ...req.body, slug: slugify(req.body.name) });
  res.status(201).json(s);
}
export async function updateSubject(req, res) {
  const d = { ...req.body };
  if (d.name) d.slug = slugify(d.name);
  const s = await PracticeSubject.findByIdAndUpdate(req.params.id, d, { new: true });
  res.json(s);
}
export async function deleteSubject(req, res) {
  const id = req.params.id;
  const items = await TestSeries.find({ practice: true, practiceSubject: id }).select("questions");
  const qIds = items.flatMap((i) => i.questions || []);
  await Promise.all([
    Question.deleteMany({ _id: { $in: qIds } }),
    TestSeries.deleteMany({ practice: true, practiceSubject: id }),
    PracticeSubject.findByIdAndDelete(id),
  ]);
  res.json({ message: "Practice subject and all its items deleted" });
}

/* ---------------- Items (admin) — items are practice TestSeries ---------------- */
export async function listItems(req, res) {
  const filter = { practice: true, practiceSubject: req.params.subjectId };
  if (req.query.kind) filter.practiceKind = req.query.kind;
  const items = await TestSeries.find(filter).sort("-createdAt").lean();
  res.json(items.map((t) => ({ ...t, questionCount: t.questions?.length || 0, questions: undefined })));
}
export async function createItem(req, res) {
  const { name, practiceStream, practiceSubject, practiceKind = "quiz", duration = 15, marks = 0, difficulty = "Medium" } = req.body;
  const item = await TestSeries.create({
    name,
    practice: true,
    practiceKind,
    practiceStream,
    practiceSubject,
    category: "Full-Length", // required by schema; unused for practice
    duration,
    marks,
    difficulty,
    status: "published",
    visibleToAll: false, // hidden by default — admin grants access per student
  });
  res.status(201).json(item);
}

/* ---------------- Student browse (visibility-filtered) ---------------- */
export async function browseStreams(req, res) {
  const items = await TestSeries.find({ practice: true, practiceKind: req.params.kind, status: "published" })
    .select("practiceStream visibleToAll access")
    .lean();
  const ok = new Set(items.filter((t) => isTestVisibleToUser(t, req.user?._id)).map((t) => String(t.practiceStream)));
  const streams = await PracticeStream.find({ isActive: true }).sort("order name").lean();
  res.json(streams.filter((s) => ok.has(String(s._id))));
}
export async function browseSubjects(req, res) {
  const { kind, streamId } = req.params;
  const items = await TestSeries.find({ practice: true, practiceKind: kind, status: "published", practiceStream: streamId })
    .select("practiceSubject visibleToAll access")
    .lean();
  const ok = new Set(items.filter((t) => isTestVisibleToUser(t, req.user?._id)).map((t) => String(t.practiceSubject)));
  const subjects = await PracticeSubject.find({ stream: streamId, isActive: true }).sort("order name").lean();
  res.json(subjects.filter((s) => ok.has(String(s._id))));
}
export async function browseItems(req, res) {
  const { kind, subjectId } = req.params;
  const items = await TestSeries.find({ practice: true, practiceKind: kind, status: "published", practiceSubject: subjectId })
    .sort("-createdAt")
    .lean();
  res.json(
    items
      .filter((t) => isTestVisibleToUser(t, req.user?._id))
      .map((t) => ({ _id: t._id, name: t.name, duration: t.duration, marks: t.marks, difficulty: t.difficulty, questionCount: t.questions?.length || 0 }))
  );
}
