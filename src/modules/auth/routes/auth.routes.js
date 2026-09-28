import express from "express";
import { authController } from "../controllers/auth.controller.js";
import { validateRequest } from "../../../middlewares/validateRequest.js";
import { asyncHandler } from "../../../common/utils/asyncHandler.js";
import {
  authRegisterSchema,
  authLoginSchema,
  authForgotPasswordSchema,
  authPortalWelcomeSchema,
  authImpersonationExchangeSchema,
  authResetPasswordSchema,
} from "../auth.validation.js";
import { authGuard } from "../../../common/middleware/auth.middleware.js";

const authRoutes = express.Router();

authRoutes.post(
  "/register",
  validateRequest(authRegisterSchema),
  asyncHandler(authController.register),
);
authRoutes.post(
  "/login",
  validateRequest(authLoginSchema),
  asyncHandler(authController.login),
);
authRoutes.post(
  "/forgot-password",
  validateRequest(authForgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);
authRoutes.post(
  "/reset-password",
  validateRequest(authResetPasswordSchema),
  asyncHandler(authController.resetPassword),
);
authRoutes.post(
  "/portal-welcome",
  authGuard,
  validateRequest(authPortalWelcomeSchema),
  asyncHandler(authController.portalWelcome),
);
authRoutes.post(
  "/impersonate/exchange",
  validateRequest(authImpersonationExchangeSchema),
  asyncHandler(authController.exchangeImpersonationCode),
);

export { authRoutes };
