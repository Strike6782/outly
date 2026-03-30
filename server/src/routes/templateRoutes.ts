import { Router } from "express";
import {
  createTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,
} from "../controllers/templateControllers";

const router = Router();

router.post("/", createTemplate);
router.get("/", getTemplates);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);

export default router;
