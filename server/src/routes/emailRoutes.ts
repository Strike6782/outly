// src/routes/email.routes.ts
import { Router } from "express";
import {
  getEmailsBySender,
  scheduledEmails,
  sentEmails,
  toggleStar,
  toggleReplied,
  searchEmails,
} from "../controllers/emailControllers";

const router = Router();

router.get("/search", searchEmails);
router.get("/schedule", scheduledEmails);
router.get("/sent", sentEmails);
router.get("/sender/:senderId", getEmailsBySender);
router.patch("/:emailId/star", toggleStar);
router.patch("/:emailId/replied", toggleReplied);

export default router;
