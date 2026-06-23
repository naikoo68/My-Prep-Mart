import { Router } from "express";
import User from "../models/User.js";
import { seedDatabase } from "../utils/seedData.js";

const router = Router();

// GET /api/setup — one-time bootstrap. Seeds the database with the admin,
// student and sample content. Automatically disabled once an admin exists,
// so it's safe to expose for first-time setup on hosts without shell access.
router.get("/", async (req, res) => {
  try {
    const adminExists = await User.exists({ role: "admin" });
    if (adminExists) {
      return res.status(403).json({
        message:
          "Already initialized — an admin account exists, so setup is disabled. If you can't log in, double-check your email/password.",
      });
    }
    const info = await seedDatabase({ reset: true });
    res.json({
      message: "✅ Setup complete! You can now log in.",
      admin: info.admin,
      student: info.student,
    });
  } catch (e) {
    res.status(500).json({ message: "Setup failed", error: e.message });
  }
});

export default router;
