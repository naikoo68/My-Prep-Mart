import Question from "../models/Question.js";
import Session from "../models/Session.js";
import Attempt from "../models/Attempt.js";

// POST /api/quiz/:sessionId/submit  (auth optional — records attempt if logged in)
// Body: { answers: { questionId: optionIndex }, timeTaken }
export async function submitQuiz(req, res) {
  const { answers = {}, timeTaken = 0 } = req.body;
  const questions = await Question.find({ session: req.params.sessionId });
  if (!questions.length) {
    return res.status(404).json({ message: "No questions for this session" });
  }

  const gradeMatching = (q, ans) =>
    ans && typeof ans === "object" && Array.isArray(q.pairs) && q.pairs.length > 0 &&
    q.pairs.every((p, k) => ans[k] === p.right);

  let correct = 0;
  const weak = new Set();
  const responses = questions.map((q) => {
    const ans = answers[q._id];
    const provided = ans !== undefined && ans !== null;
    const isCorrect = q.type === "matching" ? gradeMatching(q, ans) : ans === q.correct;
    if (isCorrect) correct += 1;
    else if (provided) weak.add(q.topic || "General");
    // Store option index for MCQ; matching answers aren't a single index.
    const chosen = q.type === "matching" ? null : provided ? ans : null;
    return { question: q._id, chosen, isCorrect };
  });

  const attempted = Object.keys(answers).length;
  const incorrect = attempted - correct;
  const total = questions.length;
  const score = correct * 4 - incorrect; // +4 / -1
  const percentage = Math.round((correct / total) * 100);

  const payload = {
    total,
    attempted,
    correct,
    incorrect,
    score,
    maxScore: total * 4,
    percentage,
    timeTaken,
    weakTopics: [...weak],
  };

  // Persist only for authenticated users.
  if (req.user) {
    const session = await Session.findById(req.params.sessionId);
    await Attempt.create({
      user: req.user._id,
      type: "quiz",
      session: req.params.sessionId,
      responses,
      ...payload,
    });
    payload.saved = true;
  }

  res.status(201).json(payload);
}
