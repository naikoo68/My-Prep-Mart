import mongoose from "mongoose";

// Singleton site-wide settings the admin can customise.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "site", unique: true },
    siteName: { type: String, default: "My Study Guide" },
    tagline: { type: String, default: "Prepare Smart, Achieve More." },
    logoUrl: { type: String, default: "" }, // optional image logo (Cloudinary URL)
    primaryColor: { type: String, default: "#2563eb" },
    accentColor: { type: String, default: "#f97316" },
    fontFamily: { type: String, default: "Inter" },
  },
  { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);
