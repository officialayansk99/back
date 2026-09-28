import multer from "multer";
import { AppError } from "../errors/AppError.js";

/** 2 MiB cap is plenty for an avatar; encourages clients to compress. */
const MAX_BYTES = 2 * 1024 * 1024;

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(
        new AppError(
          "Only JPG, PNG, or WebP images are allowed",
          400,
          "INVALID_FILE_TYPE",
        ),
      );
    }
    cb(null, true);
  },
});

const uploadAvatar = memoryUpload.single("file");

export { uploadAvatar, MAX_BYTES as AVATAR_MAX_BYTES };
