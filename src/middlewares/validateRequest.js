import { AppError } from "../common/errors/AppError.js";

const validateRequest = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body || {},
    params: req.params || {},
    query: req.query || {},
  });

  if (!result.success) {
    return next(
      new AppError(
        "Validation error",
        400,
        "VALIDATION_ERROR",
        result.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      ),
    );
  }

  req.validated = result.data;

  return next();
};

export { validateRequest };
