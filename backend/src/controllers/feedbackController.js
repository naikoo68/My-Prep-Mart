import Feedback from "../models/Feedback.js";

// POST /api/feedback — submit feedback (works for logged-in or guest users)
export async function createFeedback(req, res) {
  const { context = "question", message, rating, questionText = "", source = "" } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ message: "Feedback message is required" });
  }
  const fb = await Feedback.create({
    user: req.user?._id,
    name: req.user?.name || "Guest",
    email: req.user?.email || "",
    context,
    message: message.trim(),
    rating: rating || undefined,
    questionText,
    source,
  });
  res.status(201).json({ ok: true, id: fb._id });
}

// GET /api/feedback  (admin) — list all feedback
export async function listFeedback(req, res) {
  const items = await Feedback.find().sort("-createdAt").limit(500).lean();
  const unread = await Feedback.countDocuments({ read: false });
  res.json({ items, unread });
}

// PATCH /api/feedback/:id/read  (admin)
export async function toggleFeedbackRead(req, res) {
  const fb = await Feedback.findById(req.params.id);
  if (!fb) return res.status(404).json({ message: "Not found" });
  fb.read = req.body.read ?? !fb.read;
  await fb.save();
  res.json({ id: fb._id, read: fb.read });
}

// DELETE /api/feedback/:id  (admin)
export async function deleteFeedback(req, res) {
  await Feedback.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
}
