import express from "express";
import { transactionController } from "../controllers/transaction.controller.js";
import { authGuard } from "../../../common/middleware/auth.middleware.js";
import { roleGuard } from "../../../common/middleware/role.middleware.js";
import { validateRequest } from "../../../middlewares/validateRequest.js";
import { uploadDepositProof } from "../../../common/middleware/depositProofUpload.middleware.js";
import {
  transactionCreateManualSchema,
  transactionDepositRequestSchema,
  transactionWithdrawRequestSchema,
  transactionListMineSchema,
} from "../transaction.validation.js";
import { asyncHandler } from "../../../common/utils/asyncHandler.js";

const transactionRoutes = express.Router();

transactionRoutes.use(authGuard);

transactionRoutes.get(
  "/fx/usd-inr",
  roleGuard("client"),
  asyncHandler(transactionController.getUsdInrRate),
);

transactionRoutes.get(
  "/deposit-instructions",
  roleGuard("client"),
  asyncHandler(transactionController.getDepositInstructions),
);

transactionRoutes.get(
  "/deposit-qr/file",
  roleGuard("client", "superadmin"),
  asyncHandler(transactionController.streamDepositQrFile),
);

transactionRoutes.get(
  "/mine",
  roleGuard("client"),
  validateRequest(transactionListMineSchema),
  asyncHandler(transactionController.listMine),
);

transactionRoutes.get(
  "/mine/available-balance",
  roleGuard("client"),
  asyncHandler(transactionController.getMyAvailableBalance),
);

transactionRoutes.get(
  "/mine/:transactionId/proof/file",
  roleGuard("client"),
  asyncHandler(transactionController.streamMyProof),
);

transactionRoutes.get(
  "/:transactionId/proof/file",
  roleGuard("superadmin"),
  asyncHandler(transactionController.streamProofForAdmin),
);

transactionRoutes.post(
  "/deposit",
  roleGuard("client"),
  uploadDepositProof,
  validateRequest(transactionDepositRequestSchema),
  asyncHandler(transactionController.requestDeposit),
);

transactionRoutes.post(
  "/withdraw",
  roleGuard("client"),
  validateRequest(transactionWithdrawRequestSchema),
  asyncHandler(transactionController.requestWithdrawal),
);

transactionRoutes.post(
  "/manual",
  roleGuard("superadmin"),
  validateRequest(transactionCreateManualSchema),
  asyncHandler(transactionController.createManual),
);

export { transactionRoutes };
