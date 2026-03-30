import { Request, Response } from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary";
import { prisma } from "../config/prisma";
import { Readable } from "stream";

// ---------------------------------------------------------------------------
// Constants — file validation limits
// ---------------------------------------------------------------------------
// WHY 10 MB per file: Keeps individual uploads manageable and prevents
// a single large file from consuming all bandwidth.
// WHY 25 MB total: Gmail's attachment limit is 25 MB — exceeding this
// means the email will bounce, wasting the entire campaign job.
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024;       // 10 MB per file
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;       // 25 MB total per upload

// Multer configured with memory storage — files stay in RAM as Buffers
// so we can stream them directly to Cloudinary without writing to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Max 10 files per upload request
  },
}).array("files");

/**
 * Upload a file buffer to Cloudinary using upload_stream.
 * WHY upload_stream: multer gives us Buffers in memory. upload_stream
 * lets us pipe the buffer directly to Cloudinary without saving to disk first.
 */
function uploadToCloudinary(
  buffer: Buffer,
  originalName: string,
): Promise<{ secure_url: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "email-attachments",
        public_id: `${Date.now()}-${originalName}`,
        access_mode: "public",
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("No result from Cloudinary"));
        resolve({ secure_url: result.secure_url });
      },
    );

    // Pipe the buffer into the upload stream
    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
  });
}

/**
 * POST /attachments/upload
 *
 * Accepts multipart/form-data with one or more files in the "files" field.
 * Validates MIME types, per-file size, and total size before uploading to Cloudinary.
 * Returns an array of {url, filename, size, mimeType} objects.
 */
export const uploadAttachments = (req: Request, res: Response): void => {
  upload(req, res, async (multerError) => {
    try {
      // Handle multer parsing errors (e.g., file too large)
      if (multerError) {
        if (multerError.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({
            message: `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB size limit`,
          });
          return;
        }
        res.status(400).json({ message: "Invalid file upload" });
        return;
      }

      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ message: "No files provided" });
        return;
      }

      // Validate MIME types
      for (const file of files) {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
          res.status(400).json({
            message: `File type "${file.mimetype}" is not allowed. Allowed: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, PNG, JPG, GIF`,
          });
          return;
        }
      }

      // Validate total size across all files
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_TOTAL_SIZE) {
        res.status(400).json({
          message: `Total upload size exceeds the ${MAX_TOTAL_SIZE / (1024 * 1024)} MB limit`,
        });
        return;
      }

      // Upload each file to Cloudinary
      const results = [];
      for (const file of files) {
        const { secure_url } = await uploadToCloudinary(file.buffer, file.originalname);
        results.push({
          url: secure_url,
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        });
      }

      res.status(200).json(results);
    } catch (error) {
      // Cloudinary upload failure or unexpected error
      res.status(500).json({ message: "Failed to upload attachments" });
    }
  });
};

/**
 * DELETE /attachments/delete
 *
 * Deletes a file from Cloudinary by its URL.
 * Extracts the public_id from the Cloudinary URL and calls destroy.
 */
export const deleteAttachment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      res.status(400).json({ message: "URL is required" });
      return;
    }

    // Verify the attachment belongs to a campaign owned by the authenticated user
    const attachment = await prisma.attachment.findFirst({
      where: { url },
      include: { campaign: { select: { userId: true } } },
    });

    if (attachment && attachment.campaign.userId !== req.user!.id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/{cloud}/raw/upload/v{version}/{folder}/{public_id}
    const parts = url.split("/upload/");
    if (parts.length < 2) {
      res.status(400).json({ message: "Invalid Cloudinary URL" });
      return;
    }

    // Remove version prefix (v1234567890/) and get the rest as public_id
    const afterUpload = parts[1];
    const publicId = afterUpload.replace(/^v\d+\//, "");

    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });

    res.status(200).json({ message: "Attachment deleted" });
  } catch (error) {
    console.error("Failed to delete attachment from Cloudinary:", error);
    res.status(500).json({ message: "Failed to delete attachment" });
  }
};
