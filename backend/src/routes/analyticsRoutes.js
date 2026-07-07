import { Router } from "express";
import {
  platformAnalytics,
  studentDashboard,
  leaderboard,
  publicStats,
} from "../controllers/analyticsController.js";
import { protect, authorize, optionalAuth } from "../middleware/auth.js";

const router = Router();

router.get("/stats", publicStats); // public live counts
router.get("/admin/analytics", protect, authorize("admin"), platformAnalytics);
router.get("/me/dashboard", protect, studentDashboard);
router.get("/leaderboard", optionalAuth, leaderboard);

export default router;
