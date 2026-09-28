import multer from "multer";
import { AppError } from "../errors/AppError.js";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

const MAX_BYTES = 2 * 1024 * 1024;

const uploadDepositQrMemory = multer({
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

const uploadDepositQr = uploadDepositQrMemory.single("file");

export { uploadDepositQr };
