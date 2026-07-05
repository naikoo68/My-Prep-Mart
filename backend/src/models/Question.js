import mongoose from "mongoose";

// A question is either:
//  - "mcq":      4 options + a correct index
//  - "matching": pairs of left/right items the student must match
// Text/options/pairs may contain LaTeX between $...$ for equation rendering.
const questionSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session" },
    testSeries: { type: mongoose.Schema.Types.ObjectId, ref: "TestSeries" },
    type: { type: String, enum: ["mcq", "matching"], default: "mcq" },
    text: { type: String, required: true },
    image: { type: String },

    // MCQ fields
    options: {
      type: [String],
      validate: {
        validator: function (v) {
          // Only enforce the 4-option rule for MCQs.
          return this.type === "matching" || (Array.isArray(v) && v.length === 4);
        },
        message: "A multiple-choice question must have exactly 4 options",
      },
    },
    correct: { type: Number, min: 0, max: 3 },

    // Matching fields
    pairs: {
      type: [{ left: String, right: String, _id: false }],
      default: undefined,
    },

    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    topic: { type: String },
    explanation: { type: String },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
  },
  { timestamps: true }
);

export default mongoose.model("Question", questionSchema);
