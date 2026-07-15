import Question from "../models/Question.js";

// Content fields carried over when duplicating a question into a new container.
const FIELDS = [
  "text", "type", "options", "correct", "difficulty", "explanation",
  "optionExplanations", "columnA", "columnB", "tableRows", "assertion",
  "reason", "image", "topic", "section", "status",
];

// Duplicate every question matching `filter` into a new container described by
// `assign` (e.g. { quiz, subject, session } or { testSeries, owner }). Returns
// the created docs. Uses ordered:false so a bad row never blocks the copy.
export async function duplicateQuestions(filter, assign) {
  const qs = await Question.find(filter).lean();
  if (!qs.length) return [];
  const docs = qs.map((q) => {
    const doc = { ...assign };
    for (const f of FIELDS) if (q[f] !== undefined) doc[f] = q[f];
    return doc;
  });
  try {
    return await Question.insertMany(docs, { ordered: false });
  } catch (e) {
    return Array.isArray(e?.insertedDocs) ? e.insertedDocs : [];
  }
}
