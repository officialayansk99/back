import { z } from "zod";
import {
  emptyObjectPassthroughSchema,
  emailSchema,
} from "../../utils/validationPrimitives.js";

const authRegisterSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    email: emailSchema(),
    phone: z
      .string()
      .trim()
      .min(7)
      .max(20)
      .regex(/^[+]?[\d\s()-]+$/, "Enter a valid phone number"),
    password: z.string().min(8).max(128),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const authLoginSchema = z.object({
  body: z.object({
    email: emailSchema(),
    password: z.string().min(1, "Password is required"),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const authForgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema(),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const authPortalWelcomeSchema = z.object({
  body: emptyObjectPassthroughSchema,
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const authImpersonationExchangeSchema = z.object({
  body: z.object({
    code: z.string().min(20).max(256),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

const authResetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20).max(256),
    newPassword: z.string().min(8).max(128),
  }),
  params: emptyObjectPassthroughSchema,
  query: emptyObjectPassthroughSchema,
});

export {
  authRegisterSchema,
  authLoginSchema,
  authForgotPasswordSchema,
  authPortalWelcomeSchema,
  authImpersonationExchangeSchema,
  authResetPasswordSchema,
};
