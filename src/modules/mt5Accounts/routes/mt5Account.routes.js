import express from "express";
import { mt5AccountController } from "../controllers/mt5Account.controller.js";
import { asyncHandler } from "../../../common/utils/asyncHandler.js";
import { authGuard } from "../../../common/middleware/auth.middleware.js";
import { roleGuard } from "../../../common/middleware/role.middleware.js";
import { validateRequest } from "../../../middlewares/validateRequest.js";
import {
  mt5CreateMineSchema,
  mt5ResetPasswordSchema,
} from "../mt5Account.validation.js";

const mt5AccountRoutes = express.Router();

mt5AccountRoutes.use(authGuard);

mt5AccountRoutes.get(
  "/provisioning",
  roleGuard("client"),
  asyncHandler(mt5AccountController.getProvisioningInfo),
);

mt5AccountRoutes.get(
  "/mine",
  roleGuard("client"),
  asyncHandler(mt5AccountController.getMine),
);

mt5AccountRoutes.get(
  "/plans",
  roleGuard("client"),
  asyncHandler(mt5AccountController.listPlans),
);
mt5AccountRoutes.post(
  "/mine",
  roleGuard("client"),
  validateRequest(mt5CreateMineSchema),
  asyncHandler(mt5AccountController.createMine),
);

mt5AccountRoutes.post(
  "/reset-password",
  roleGuard("superadmin"),
  validateRequest(mt5ResetPasswordSchema),
  asyncHandler(mt5AccountController.resetPasswordByAdmin),
);

mt5AccountRoutes.post(
  "/reset-password-client",
  roleGuard("client"),
  validateRequest(mt5ResetPasswordSchema),
  asyncHandler(mt5AccountController.resetPasswordByClient),
);

export { mt5AccountRoutes };
