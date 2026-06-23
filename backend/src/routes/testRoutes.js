import { Router } from "express";
import {
  listTests,
  listAllTests,
  getTest,
  createTest,
  updateTest,
  togglePublish,
  deleteTest,
  submitTest,
} from "../controllers/testController.js";
import { protect, authorize, optionalAuth } from "../middleware/auth.js";

const router = Router();
const admin = [protect, authorize("admin")];

router.get("/", optionalAuth, listTests);
router.get("/admin/all", ...admin, listAllTests);
router.get("/:id", protect, getTest);
router.post("/:id/submit", protect, submitTest);

router.post("/", ...admin, createTest);
router.put("/:id", ...admin, updateTest);
router.patch("/:id/publish", ...admin, togglePublish);
router.delete("/:id", ...admin, deleteTest);

export default router;
