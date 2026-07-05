import { Router } from "express";
import {
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  listQuizzes,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  listQuizQuestions,
  listQuestions,
  listAllQuestions,
  createQuestion,
  bulkCreateQuestions,
  updateQuestion,
  deleteQuestion,
} from "../controllers/contentController.js";
import { protect, authorize, optionalAuth } from "../middleware/auth.js";

const router = Router();
const admin = [protect, authorize("admin")];

// Subjects
router.get("/subjects", listSubjects);
router.post("/subjects", ...admin, createSubject);
router.put("/subjects/:id", ...admin, updateSubject);
router.delete("/subjects/:id", ...admin, deleteSubject);

// Topics (within a subject)
router.get("/subjects/:subjectId/topics", listTopics);
router.post("/topics", ...admin, createTopic);
router.put("/topics/:id", ...admin, updateTopic);
router.delete("/topics/:id", ...admin, deleteTopic);

// Sessions (within a topic)
router.get("/topics/:topicId/sessions", listSessions);
router.post("/sessions", ...admin, createSession);
router.put("/sessions/:id", ...admin, updateSession);
router.delete("/sessions/:id", ...admin, deleteSession);

// Quizzes (within a session)
router.get("/sessions/:sessionId/quizzes", listQuizzes);
router.post("/quizzes", ...admin, createQuiz);
router.put("/quizzes/:id", ...admin, updateQuiz);
router.delete("/quizzes/:id", ...admin, deleteQuiz);
router.get("/quizzes/:quizId/questions", optionalAuth, listQuizQuestions);

// Questions
router.get("/questions", ...admin, listAllQuestions);
router.get("/sessions/:sessionId/questions", listQuestions);
router.post("/questions", ...admin, createQuestion);
router.post("/questions/bulk", ...admin, bulkCreateQuestions);
router.put("/questions/:id", ...admin, updateQuestion);
router.delete("/questions/:id", ...admin, deleteQuestion);

export default router;
