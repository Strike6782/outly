import { v2 as cloudinary } from "cloudinary";

// ---------------------------------------------------------------------------
// Cloudinary SDK Configuration
// ---------------------------------------------------------------------------
// WHY env var validation at import time: If credentials are missing, uploads
// will fail with cryptic errors at runtime. Logging warnings at startup gives
// operators immediate visibility into misconfiguration.
//
// WHY not throwing: Unlike ENCRYPTION_KEY (which is critical for all operations),
// Cloudinary is only needed for attachment uploads. The server can still handle
// campaigns without attachments if Cloudinary isn't configured.
// ---------------------------------------------------------------------------

const requiredVars = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.warn(`[cloudinary] Missing env var: ${varName} — attachment uploads will fail`);
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
