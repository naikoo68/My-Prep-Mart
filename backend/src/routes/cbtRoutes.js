import { Router } from "express";
import {
  getCbtPortal,
  getCbtExam,
  registerCbt,
  verifyCbt,
  startCbt,
  registerCbtView,
  submitCbt,
  getCbtResult,
  getCbtPortalUrl,
  listCbtExams,
  listCbtCandidates,
  addCbtExam,
  updateCbtExam,
  releaseCbtResults,
  removeCbtExam,
  cbtLeaderboard,
} from "../controllers/cbtController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();
const admin = [protect, authorize("admin")];

// Public (NO auth) — the single exam portal, plus taking an exam and viewing a
// (deferred) result. Students sign in with just their name + email on the
// client. Declared before admin routes.
router.get("/portal", getCbtPortal); // the one shareable exam page
router.get("/exam/:token", getCbtExam); // exam META (for the sign-in screen)
router.post("/exam/:token/register", registerCbt); // step 1: send OTP to email
router.post("/exam/:token/verify", verifyCbt); // step 2: verify OTP → sessionToken
router.post("/exam/:token/start", startCbt); // hand out questions (verified)
router.post("/exam/:token/view", registerCbtView); // count an open (impression)
router.post("/exam/:token/submit", submitCbt);
router.get("/result/:resultToken", getCbtResult); // pending until results released

// Admin — manage the portal, live toggle, end time, results release, rankings.
router.get("/admin/portal-url", ...admin, getCbtPortalUrl);
router.get("/admin/exams", ...admin, listCbtExams);
router.get("/admin/candidates", ...admin, listCbtCandidates); // My Tests to add
router.get("/admin/:id/leaderboard", ...admin, cbtLeaderboard);
router.patch("/admin/:id/add", ...admin, addCbtExam);
router.patch("/admin/:id/update", ...admin, updateCbtExam); // { live?, endAt? }
router.patch("/admin/:id/release", ...admin, releaseCbtResults);
router.patch("/admin/:id/remove", ...admin, removeCbtExam);

export default router;
