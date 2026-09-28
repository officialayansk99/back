import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const pageSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => Number(v || 1))
  .pipe(z.number().int().min(1));

const limitSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => Number(v || 20))
  .pipe(z.number().int().min(1).max(100));

const emptyObjectPassthroughSchema = z.object({}).passthrough();

function emailSchema(message = "Invalid email") {
  return z.string().trim().toLowerCase().email(message);
}

export {
  objectIdSchema,
  pageSchema,
  limitSchema,
  emptyObjectPassthroughSchema,
  emailSchema,
};
