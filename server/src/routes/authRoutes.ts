import { Router } from "express";
import { googleLogin, logout, refreshAccessToken } from "../controllers/authControllers";
const router = Router();

router.post("/google", googleLogin);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);

export default router;