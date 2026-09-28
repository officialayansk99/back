import { z } from "zod";
import {
  objectIdSchema,
  pageSchema,
  limitSchema,
  emptyObjectPassthroughSchema,
} from "../../utils/validationPrimitives.js";

const adminListClientsSchema = z.object({
  body: emptyObjectPassthroughSchema,
  params: emptyObjectPassthroughSchema,
  query: z.object({
    page: pageSchema,
    limit: limitSchema,
    search: z.string().optional(),
    kycStatus: z.string().optional(),
  }),
});

const adminUpdateUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      role: z.enum(["client", "superadmin", "representative"]).optional(),
      status: z
        .enum(["pending", "approved", "rejected", "processing", "disabled"])
        .optional(),
      kycStatus: z.enum(["pending", "approved", "rejected"]).optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zipCode: z.string().optional(),
      bankDetails: z
        .object({
          accountName: z.string().optional(),
          bankName: z.string().optional(),
          accountNumber: z.string().optional(),
          ifsc: z.string().optional(),
          branchName: z.string().optional(),
        })
        .optional(),
      socialMedia: z
        .object({
          facebook: z.string().url().optional().or(z.literal("")),
          twitter: z.string().url().optional().or(z.literal("")),
          instagram: z.string().url().optional().or(z.literal("")),
          youtube: z.string().url().optional().or(z.literal("")),
        })
        .optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
      message: "At least one field is required",
    }),
  params: z.object({
    userId: objectIdSchema,
  }),
  query: emptyObjectPassthroughSchema,
});

const adminDeleteUserSchema = z.object({
  body: emptyObjectPassthroughSchema,
  params: z.object({
    userId: objectIdSchema,
  }),
  query: emptyObjectPassthroughSchema,
});

const adminCreatePlanSchema = z.object({
  body: z.object({
    planName: z.string().trim().min(1),
    groupName: z.string().min(1),
    leverage: z.string().min(1),
    minDeposit: z.number().min(0),
    bonusType: z.string().optional(),
    ibCommission: z.string().optional(),
    mode: z.string().optional(),
    commissionPerLot: z.number().optional(),
    comment: z.string().optional(),
    active: z.boolean().optional(),
    leverageFix: z.boolean().optional(),
    selfCommission: z.boolean().optional(),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const adminCreateOrUpdateSmtpSchema = z.object({
  body: z.object({
    server: z.string().trim().min(1),
    port: z.number().positive(),
    username: z.string().trim().min(1),
    password: z.string().min(1),
    ssl: z.boolean().optional(),
    timeoutMs: z.number().optional(),
    imapHost: z.string().trim().optional().or(z.literal("")),
    imapPort: z.number().positive().optional(),
    imapSecure: z.boolean().optional(),
    imapUsername: z.string().trim().optional().or(z.literal("")),
    imapPassword: z.string().optional().or(z.literal("")),
    sentMailbox: z.string().trim().optional().or(z.literal("")),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const adminCreateEmailerSchema = z.object({
  body: z.object({
    emailerType: z.string().trim().min(1),
    mailSubject: z.string().min(1),
    mailTemplateParameter: z.string().optional(),
    ccMail: z.string().optional(),
    bccMail: z.string().optional(),
    mailBody: z.string().min(1),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const adminCreateRepresentativeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(6),
    status: z.boolean().optional(),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const adminUpdateTransactionStatusSchema = z.object({
  body: z.object({
    status: z.enum(["completed", "rejected"]),
  }),
  params: z.object({
    transactionId: objectIdSchema,
  }),
  query: emptyObjectPassthroughSchema,
});

const adminListGenericSchema = z.object({
  body: emptyObjectPassthroughSchema,
  params: emptyObjectPassthroughSchema,
  query: z.object({
    page: pageSchema.optional(),
    limit: limitSchema.optional(),
    search: z.string().optional(),
  }),
});

const adminChangeUserPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(6),
  }),
  params: z.object({
    userId: objectIdSchema,
  }),
  query: emptyObjectPassthroughSchema,
});

const adminCreateManualMt5Schema = z.object({
  body: z
    .object({
      userId: objectIdSchema,
      login: z.coerce.number().int().positive(),
      type: z.enum(["demo", "live"]),
      server: z.string().trim().min(1).max(120),
      leverage: z.coerce.number().int().min(1).max(5000),
      group: z.string().trim().min(1).max(64),
      masterPassword: z.string().min(6).max(128).optional(),
      investorPassword: z.string().max(128).optional(),
      sendCredentialsEmail: z.boolean().optional().default(true),
    })
    .refine(
      (b) =>
        b.sendCredentialsEmail !== true || Boolean(b.masterPassword?.length),
      {
        message:
          "Master password is required when sending credentials by email",
        path: ["masterPassword"],
      },
    ),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const adminPatchMt5BodySchema = z
  .object({
    server: z.string().trim().min(1).max(120).optional(),
    leverage: z.coerce.number().int().min(1).max(5000).optional(),
    group: z.string().trim().min(1).max(64).optional(),
    type: z.enum(["demo", "live"]).optional(),
    balance: z.coerce.number().min(0).optional(),
    equity: z.coerce.number().min(0).optional(),
    creditBalance: z.coerce.number().optional(),
  })
  .refine(
    (b) =>
      b.server != null ||
      b.leverage != null ||
      b.group != null ||
      b.type != null ||
      b.balance != null ||
      b.equity != null ||
      b.creditBalance != null,
    { message: "At least one field is required" },
  );

const adminPatchMt5Schema = z.object({
  body: adminPatchMt5BodySchema,
  params: z.object({
    mt5AccountId: objectIdSchema,
  }),
  query: emptyObjectPassthroughSchema,
});

const adminDeleteMt5Schema = z.object({
  body: emptyObjectPassthroughSchema,
  params: z.object({
    mt5AccountId: objectIdSchema,
  }),
  query: emptyObjectPassthroughSchema,
});

const adminDepositSettingsBodySchema = z
  .object({
    beneficiaryName: z.string().trim().max(200).optional(),
    bankName: z.string().trim().max(200).optional(),
    accountNumber: z.string().trim().max(80).optional(),
    ifscCode: z.string().trim().max(30).optional(),
    qrCodeUrl: z.string().trim().max(2000).optional(),
    qrHelpText: z.string().trim().max(500).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

const adminPatchDepositSettingsSchema = z.object({
  body: adminDepositSettingsBodySchema,
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

export {
  adminListClientsSchema,
  adminUpdateUserSchema,
  adminDeleteUserSchema,
  adminCreatePlanSchema,
  adminCreateOrUpdateSmtpSchema,
  adminCreateEmailerSchema,
  adminCreateRepresentativeSchema,
  adminUpdateTransactionStatusSchema,
  adminListGenericSchema,
  adminChangeUserPasswordSchema,
  adminCreateManualMt5Schema,
  adminPatchMt5Schema,
  adminDeleteMt5Schema,
  adminPatchDepositSettingsSchema,
};
