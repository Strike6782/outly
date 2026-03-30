import { Router } from "express";
import { uploadAttachments, deleteAttachment } from "../controllers/attachmentControllers";

const router = Router();

// POST /attachments/upload — multipart file upload to Cloudinary
router.post("/upload", uploadAttachments);

// DELETE /attachments/delete — remove file from Cloudinary
router.delete("/delete", deleteAttachment);

export default router;
