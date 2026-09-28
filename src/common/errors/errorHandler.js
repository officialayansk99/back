import multer from "multer";
import { AppError } from "./AppError.js";
import { logger } from "../../config/logger.js";

const errorHandler = (err, req, res, _next) => {
  let normalizedError = err;

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      normalizedError = new AppError(
        "File must be 4MB or smaller",
        400,
        "FILE_TOO_LARGE",
      );
    } else {
      normalizedError = new AppError(err.message, 400, "UPLOAD_ERROR");
    }
  }

  if (!(normalizedError instanceof AppError)) {
    normalizedError = new AppError(
      normalizedError.message || "Unexpected error",
      normalizedError.statusCode || 500,
      normalizedError.code || "INTERNAL_SERVER_ERROR",
    );
  }

  // Log every unhandled error. We omit stack traces in production responses
  // and from the structured log payload, but the message and code are always
  // captured so prod incidents are debuggable.
  const isClientError =
    normalizedError.statusCode >= 400 && normalizedError.statusCode < 500;
  const logFn = isClientError ? logger.warn : logger.error;
  logFn.call(
    logger,
    {
      err: {
        message: err.message,
        code: normalizedError.code,
        statusCode: normalizedError.statusCode,
        stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
      },
      req: { method: req.method, url: req.originalUrl },
    },
    "Request failed",
  );

  return res.status(normalizedError.statusCode).json({
    success: false,
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      details: normalizedError.details,
    },
  });
};

export { errorHandler };
