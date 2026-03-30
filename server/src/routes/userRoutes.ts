import { Router } from "express";
import { getUser, getUserEmails } from "../controllers/userControllers";
const router = Router();

router.get("/", getUser);
router.get("/emails", getUserEmails);

export default router;
