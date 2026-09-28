import { z } from "zod";
import { emptyObjectPassthroughSchema } from "../../utils/validationPrimitives.js";

const mt5CreateMineSchema = z.object({
  body: z.object({
    type: z.enum(["demo", "live"]),
    leverage: z.number().int().min(1).max(5000),
    group: z.string().trim().min(2).max(64),
    initialDeposit: z.number().min(0).default(0),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const mt5ResetPasswordSchema = z.object({
  body: z.object({
    login: z.number(),
    newPassword: z.string().min(8).max(128),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

export { mt5CreateMineSchema, mt5ResetPasswordSchema };
