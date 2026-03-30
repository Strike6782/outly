import { Router } from "express";
import { handleOpen, handleClick } from "../controllers/trackingControllers";

// Public routes — no auth middleware. Email clients and browsers
// load these URLs without user session context.
const router = Router();

router.get("/open/:emailJobId", handleOpen);
router.get("/click/:emailJobId", handleClick);

export default router;
