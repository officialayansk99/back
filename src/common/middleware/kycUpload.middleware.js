import multer from "multer";
import { AppError } from "../errors/AppError.js";
import { kycMaxFileBytes } from "../../config/env.js";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: kycMaxFileBytes },
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

const uploadIdProof = memoryUpload.single("file");
const uploadAddressProof = memoryUpload.single("file");

export { uploadIdProof, uploadAddressProof };
