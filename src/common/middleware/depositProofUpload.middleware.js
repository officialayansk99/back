import multer from "multer";
import { AppError } from "../errors/AppError.js";

/** 4 MiB cap. Keep small to play well with mobile uploads. */
const MAX_BYTES = 4 * 1024 * 1024;

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(
        new AppError(
          "Only JPG, PNG, WebP, or PDF files are allowed",
          400,
          "INVALID_FILE_TYPE",
        ),
      );
    }
    cb(null, true);
  },
});

const uploadDepositProof = memoryUpload.single("file");

export { uploadDepositProof, MAX_BYTES as DEPOSIT_PROOF_MAX_BYTES };
