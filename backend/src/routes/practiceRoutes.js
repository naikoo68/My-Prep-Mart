import { Router } from "express";
import {
  listStreams, createStream, updateStream, deleteStream,
  listSubjects, createSubject, updateSubject, deleteSubject,
  listItems, createItem,
  browseStreams, browseSubjects, browseItems,
} from "../controllers/practiceController.js";
import { protect, authorize, optionalAuth } from "../middleware/auth.js";

const router = Router();
const admin = [protect, authorize("admin")];

// Student browse (visibility-filtered). Attempting an item reuses /tests/:id.
router.get("/browse/:kind/streams", optionalAuth, browseStreams);
router.get("/browse/:kind/streams/:streamId/subjects", optionalAuth, browseSubjects);
router.get("/browse/:kind/subjects/:subjectId/items", optionalAuth, browseItems);

// Admin — streams
router.get("/streams", ...admin, listStreams);
router.post("/streams", ...admin, createStream);
router.put("/streams/:id", ...admin, updateStream);
router.delete("/streams/:id", ...admin, deleteStream);
router.get("/streams/:streamId/subjects", ...admin, listSubjects);

// Admin — subjects
router.post("/subjects", ...admin, createSubject);
router.put("/subjects/:id", ...admin, updateSubject);
router.delete("/subjects/:id", ...admin, deleteSubject);
router.get("/subjects/:subjectId/items", ...admin, listItems);

// Admin — items (practice test-series). Questions/visibility/attempt reuse /tests.
router.post("/items", ...admin, createItem);

export default router;
