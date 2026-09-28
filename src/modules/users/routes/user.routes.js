import express from "express";
import { userController } from "../controllers/user.controller.js";
import { authGuard } from "../../../common/middleware/auth.middleware.js";
import { asyncHandler } from "../../../common/utils/asyncHandler.js";
import { validateRequest } from "../../../middlewares/validateRequest.js";
import {
  uploadIdProof,
  uploadAddressProof,
} from "../../../common/middleware/kycUpload.middleware.js";
import { uploadAvatar } from "../../../common/middleware/avatarUpload.middleware.js";
import {
  userUpdateBankDetailsSchema,
  userUpdateProfileSchema,
  userChangePasswordSchema,
} from "../user.validation.js";

const userRoutes = express.Router();

userRoutes.use(authGuard);

userRoutes.get("/me", asyncHandler(userController.getMe));
userRoutes.patch(
  "/profile",
  validateRequest(userUpdateProfileSchema),
  asyncHandler(userController.updateProfile),
);
userRoutes.patch(
  "/bank-details",
  validateRequest(userUpdateBankDetailsSchema),
  asyncHandler(userController.updateBankDetails),
);
userRoutes.post(
  "/change-password",
  validateRequest(userChangePasswordSchema),
  asyncHandler(userController.changePassword),
);
userRoutes.post("/kyc", asyncHandler(userController.uploadKyc));
userRoutes.get(
  "/me/kyc/id-proof/file",
  asyncHandler(userController.streamKycIdProofForMe),
);
userRoutes.get(
  "/me/kyc/address-proof/file",
  asyncHandler(userController.streamKycAddressProofForMe),
);
userRoutes.post(
  "/avatar",
  uploadAvatar,
  asyncHandler(userController.uploadAvatar),
);
userRoutes.get("/me/avatar/file", asyncHandler(userController.streamMyAvatar));
userRoutes.post(
  "/kyc/id-proof",
  uploadIdProof,
  asyncHandler(userController.uploadKycIdProof),
);
userRoutes.post(
  "/kyc/address-proof",
  uploadAddressProof,
  asyncHandler(userController.uploadKycAddressProof),
);

export { userRoutes };
