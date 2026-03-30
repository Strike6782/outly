import { Router } from "express";
import {
  getSequence,
  pauseRecipient,
  resumeRecipient,
  stopRecipient,
  pauseSequence,
  resumeSequence,
  stopSequence,
} from "../controllers/sequenceControllers";

// Mounted at /campaigns/:id/sequence — :id is merged from the parent router
const router = Router({ mergeParams: true });

// Campaign sequence data
router.get("/", getSequence);

// Campaign-level controls
router.patch("/pause", pauseSequence);
router.patch("/resume", resumeSequence);
router.patch("/stop", stopSequence);

// Per-recipient controls
router.patch("/recipients/:recipientId/pause", pauseRecipient);
router.patch("/recipients/:recipientId/resume", resumeRecipient);
router.patch("/recipients/:recipientId/stop", stopRecipient);

export default router;
