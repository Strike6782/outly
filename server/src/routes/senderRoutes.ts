import { Router } from "express";
import {
  createSender,
  verifySender,
  updateSender,
  deleteSender,
  getSenderEmails,
  getSenders,
  getSenderById,
} from "../controllers/senderControllers";
const router = Router();

router.get("/", getSenders);
router.get("/email", getSenderEmails);
router.get("/:id", getSenderById);
router.post("/", createSender);
router.patch("/:id/verify", verifySender);
router.patch("/:id", updateSender);
router.delete("/:id", deleteSender);

export default router;
