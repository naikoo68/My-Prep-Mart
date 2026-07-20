import mongoose from "mongoose";

// A candidate's registration for a CBT exam. Before taking an exam a student
// registers with name + email and verifies a one-time code (OTP) sent to that
// email. Once verified we issue a sessionToken the client presents when it
// starts and submits the exam, so only a verified email can take it.
//
// One registration per (exam, email). Short-lived: the whole doc auto-expires
// (TTL) so the collection stays small — this only gates entry, not results
// (results/attempts live in CbtAttempt permanently).
const cbtRegistrationSchema = new mongoose.Schema(
  {
    testSeries: { type: mongoose.Schema.Types.ObjectId, ref: "TestSeries", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, trim: true },
    code: { type: String }, // 6-digit OTP
    codeExpiresAt: { type: Date }, // OTP validity (~10 min)
    verified: { type: Boolean, default: false },
    sessionToken: { type: String, index: true }, // issued on verify; presented on start/submit
    // The whole registration auto-deletes after this time (TTL). Set well past
    // any exam length so a verified session survives a long exam.
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

cbtRegistrationSchema.index({ testSeries: 1, email: 1 }, { unique: true });
cbtRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL cleanup

export default mongoose.model("CbtRegistration", cbtRegistrationSchema);
