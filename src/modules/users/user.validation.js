import { z } from "zod";
import { emptyObjectPassthroughSchema } from "../../utils/validationPrimitives.js";

/**
 * Strict bank-details validator.
 *
 * Without `.strict()` the previous controller accepted any shape inside
 * `bankDetails` (only the fields known to Mongoose were persisted, but
 * arbitrary keys with arbitrary string sizes were still copied through and
 * ate up server memory). Bounded lengths also keep the bank-details modal
 * sane on the admin side.
 */
const bankDetailsBodySchema = z
  .object({
    type: z.enum(["BANK", "CRYPTO", "OTHER"]).optional().default("BANK"),
    bankName: z.string().trim().max(120).optional().default(""),
    accountName: z.string().trim().max(120).optional().default(""),
    accountNumber: z.string().trim().max(60).optional().default(""),
    ifsc: z.string().trim().max(40).optional().default(""),
    branchName: z.string().trim().max(120).optional().default(""),
    description: z.string().trim().max(250).optional().default(""),
  })
  .strict();

const userUpdateBankDetailsSchema = z.object({
  body: z
    .object({
      bankDetails: bankDetailsBodySchema,
    })
    .strict(),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const userUpdateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      phone: z.string().trim().max(40).optional(),
      country: z.string().trim().max(120).optional(),
    })
    .strict(),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const userChangePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(8).max(128),
    })
    .strict(),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

export {
  userUpdateBankDetailsSchema,
  userUpdateProfileSchema,
  userChangePasswordSchema,
};
