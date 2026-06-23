import { Router } from "express";
import { submitQuiz } from "../controllers/quizController.js";
import { optionalAuth } from "../middleware/auth.js";

const router = Router();

// Optional auth: anyone can practice; the attempt is saved if logged in.
router.post("/:sessionId/submit", optionalAuth, submitQuiz);

export default router;
