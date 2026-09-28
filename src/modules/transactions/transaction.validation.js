import { z } from "zod";
import {
  emptyObjectPassthroughSchema,
  objectIdSchema,
  pageSchema,
  limitSchema,
} from "../../utils/validationPrimitives.js";

const transactionCreateManualSchema = z.object({
  body: z.object({
    userId: objectIdSchema,
    type: z.enum(["deposit", "withdraw"]),
    amount: z.number().min(0.01),
    note: z.string().max(250).optional().default(""),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

/**
 * Deposit requests come in as multipart/form-data because the client uploads
 * a payment proof file. Numeric fields therefore arrive as strings; we coerce
 * here so the service receives clean values.
 */
const numericString = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v));

const transactionDepositRequestSchema = z.object({
  body: z.object({
    amount: numericString.pipe(
      z
        .number()
        .min(100, "Minimum deposit is $100")
        .max(1_000_000, "Amount too large"),
    ),
    method: z
      .enum(["bank_transfer", "qr_code"])
      .optional()
      .default("bank_transfer"),
    mt5Login: numericString.pipe(z.number().int().positive()),
    note: z.string().max(250).optional().default(""),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const transactionWithdrawRequestSchema = z.object({
  body: z.object({
    amount: z
      .number()
      .min(10, "Minimum withdrawal is $10")
      .max(1_000_000, "Amount too large"),
    note: z.string().max(250).optional().default(""),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const transactionListMineSchema = z.object({
  body: emptyObjectPassthroughSchema,
  params: emptyObjectPassthroughSchema,
  query: z.object({
    page: pageSchema,
    limit: limitSchema,
    type: z.enum(["all", "deposit", "withdraw"]).optional().default("all"),
    search: z.string().max(120).optional().default(""),
  }),
});

export {
  transactionCreateManualSchema,
  transactionDepositRequestSchema,
  transactionWithdrawRequestSchema,
  transactionListMineSchema,
};
