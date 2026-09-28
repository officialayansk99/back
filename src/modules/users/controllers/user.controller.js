import { UserRepository } from "../repositories/user.repository.js";
import { User } from "../model/user.model.js";
import { AppError } from "../../../common/errors/AppError.js";
import { apiResponse } from "../../../common/utils/apiResponse.js";
import { AuditLog } from "../../admin/models/auditLog.model.js";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import * as kycGridfsService from "../services/kycGridfs.service.js";
import * as avatarGridfsService from "../services/avatarGridfs.service.js";
import {
  resolveClientAddressProofPath,
  resolveClientAvatarPath,
  resolveClientIdProofPath,
} from "../utils/kycPublicPaths.js";

const userRepository = new UserRepository();

async function optimizeKycImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: 1400,
      withoutEnlargement: true,
    })
    .webp({ quality: 70 })
    .toBuffer();
}

/**
 * Avatars get a tighter resize (square crop, smaller dimension) since they
 * render in <img> at < 256px on every page that shows the user. Output is
 * WebP for size and consistency with KYC.
 */
async function optimizeAvatarImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: 512,
      height: 512,
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    .webp({ quality: 80 })
    .toBuffer();
}

function sanitizeUserForClient(userDoc) {
  const userObj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete userObj.password;
  const idProofUrl = resolveClientIdProofPath(userObj);
  const addressProofUrl = resolveClientAddressProofPath(userObj);
  const avatarUrl = resolveClientAvatarPath(userObj);
  delete userObj.idProofFileId;
  delete userObj.addressProofFileId;
  delete userObj.avatarFileId;
  userObj.idProofUrl = idProofUrl;
  userObj.addressProofUrl = addressProofUrl;
  userObj.avatarUrl = avatarUrl;
  return userObj;
}

const userController = {
  getMe: async (req, res) => {
    const user = await userRepository.findById(req.user.id);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const userObj = sanitizeUserForClient(user);

    return res.status(200).json(apiResponse({ data: userObj }));
  },

  updateProfile: async (req, res) => {
    const { name, phone, country } = req.validated.body;
    const updatePayload = {};
    if (name) updatePayload.name = name;
    if (phone) updatePayload.phone = phone;
    if (country) updatePayload.country = country;

    const updated = await userRepository.updateById(req.user.id, {
      $set: updatePayload,
    });

    await AuditLog.create({
      userType: "client",
      log: `Client updated profile information`,
      metadata: { userId: req.user.id, updates: updatePayload },
    });

    return res.status(200).json(
      apiResponse({
        message: "Profile updated successfully",
        data: sanitizeUserForClient(updated),
      }),
    );
  },

  updateBankDetails: async (req, res) => {
    const { bankDetails } = req.validated.body;
    const updated = await userRepository.updateById(req.user.id, {
      $set: { bankDetails },
    });

    await AuditLog.create({
      userType: "client",
      log: `Client updated bank details`,
      metadata: { userId: req.user.id },
    });

    return res.status(200).json(
      apiResponse({
        message: "Bank details updated successfully",
        data: sanitizeUserForClient(updated),
      }),
    );
  },

  changePassword: async (req, res) => {
    const { currentPassword, newPassword } = req.validated.body;
    const user = await userRepository.findById(req.user.id);

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid)
      throw new AppError("Current password incorrect", 400, "INVALID_PASSWORD");

    const hash = await bcrypt.hash(newPassword, 12);
    await userRepository.updateById(req.user.id, {
      $set: { password: hash, passwordChangedAt: new Date() },
    });

    await AuditLog.create({
      userType: "client",
      log: `Client changed their password`,
      metadata: { userId: req.user.id },
    });

    return res
      .status(200)
      .json(apiResponse({ message: "Password changed successfully" }));
  },

  uploadKyc: async (req, res) => {
    const { idProofUrl, addressProofUrl } = req.body;
    const user = await userRepository.findById(req.user.id);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const kycPayload = { kycStatus: "pending" };
    const fileIdsToDelete = [];

    const nextIdProofUrl =
      typeof idProofUrl === "string" ? idProofUrl.trim() : "";
    if (nextIdProofUrl) {
      kycPayload.idProofUrl = nextIdProofUrl;
      kycPayload.idProofFileId = null;
      if (user.idProofFileId) fileIdsToDelete.push(user.idProofFileId);
    }

    const nextAddressProofUrl =
      typeof addressProofUrl === "string" ? addressProofUrl.trim() : "";
    if (nextAddressProofUrl) {
      kycPayload.addressProofUrl = nextAddressProofUrl;
      kycPayload.addressProofFileId = null;
      if (user.addressProofFileId) {
        fileIdsToDelete.push(user.addressProofFileId);
      }
    }

    await userRepository.updateById(req.user.id, { $set: kycPayload });

    if (fileIdsToDelete.length) {
      await kycGridfsService.deleteFileIds(fileIdsToDelete);
    }

    await AuditLog.create({
      userType: "client",
      log: `Client submitted KYC documents`,
      metadata: { userId: req.user.id },
    });

    return res.status(200).json(
      apiResponse({
        message: "KYC documents submitted for review",
        data: { kycStatus: "pending" },
      }),
    );
  },

  uploadKycIdProof: async (req, res) => {
    if (!req.file) throw new AppError("No file uploaded", 400, "NO_FILE");

    const optimizedBuffer = await optimizeKycImage(req.file.buffer);
    const filename = `${req.user.id}-idProof-${Date.now()}.webp`;

    const fileId = await kycGridfsService.uploadFromBuffer(optimizedBuffer, {
      filename,
      contentType: "image/webp",
      userId: req.user.id,
      docKind: "idProof",
    });

    /**
     * Atomic swap. We capture whatever value the document had immediately
     * before our update so we know precisely which GridFS file we just
     * displaced — even when a concurrent upload races against us. Without
     * this, two parallel uploads would read the same `previousFileId`,
     * both call our update, and only one displaced file would get cleaned
     * up — orphaning the other indefinitely in GridFS.
     */
    const before = await User.findOneAndUpdate(
      { _id: req.user.id },
      {
        $set: {
          idProofFileId: fileId,
          idProofUrl: null,
          kycStatus: "pending",
        },
      },
      { projection: { idProofFileId: 1 }, new: false },
    );
    const previousFileId = before?.idProofFileId;

    if (previousFileId && String(previousFileId) !== String(fileId)) {
      await kycGridfsService.deleteFile(previousFileId);
    }

    await AuditLog.create({
      userType: "client",
      log: `Client uploaded identity KYC document`,
      metadata: { userId: req.user.id },
    });

    const idProofUrl = resolveClientIdProofPath({
      idProofFileId: fileId,
      idProofUrl: null,
    });

    return res.status(200).json(
      apiResponse({
        message: "Identity document uploaded for review",
        data: { idProofUrl, kycStatus: "pending" },
      }),
    );
  },

  uploadKycAddressProof: async (req, res) => {
    if (!req.file) throw new AppError("No file uploaded", 400, "NO_FILE");

    const optimizedBuffer = await optimizeKycImage(req.file.buffer);
    const filename = `${req.user.id}-addressProof-${Date.now()}.webp`;

    const fileId = await kycGridfsService.uploadFromBuffer(optimizedBuffer, {
      filename,
      contentType: "image/webp",
      userId: req.user.id,
      docKind: "addressProof",
    });

    // Atomic swap; see the comment in uploadKycIdProof for why.
    const before = await User.findOneAndUpdate(
      { _id: req.user.id },
      {
        $set: {
          addressProofFileId: fileId,
          addressProofUrl: null,
          kycStatus: "pending",
        },
      },
      { projection: { addressProofFileId: 1 }, new: false },
    );
    const previousFileId = before?.addressProofFileId;

    if (previousFileId && String(previousFileId) !== String(fileId)) {
      await kycGridfsService.deleteFile(previousFileId);
    }

    await AuditLog.create({
      userType: "client",
      log: `Client uploaded address KYC document`,
      metadata: { userId: req.user.id },
    });

    const addressProofUrl = resolveClientAddressProofPath({
      addressProofFileId: fileId,
      addressProofUrl: null,
    });

    return res.status(200).json(
      apiResponse({
        message: "Address proof uploaded for review",
        data: { addressProofUrl, kycStatus: "pending" },
      }),
    );
  },

  uploadAvatar: async (req, res) => {
    if (!req.file) throw new AppError("No file uploaded", 400, "NO_FILE");

    const optimized = await optimizeAvatarImage(req.file.buffer);
    const filename = `${req.user.id}-avatar-${Date.now()}.webp`;

    const fileId = await avatarGridfsService.uploadFromBuffer(optimized, {
      filename,
      contentType: "image/webp",
      userId: req.user.id,
    });

    /**
     * Atomic swap. Captures the displaced fileId from the same operation
     * so two parallel uploads can't orphan a GridFS file (same fix pattern
     * applied to KYC). We also clear the legacy free-text avatarUrl so the
     * DTO surfaces the streamed file.
     */
    const before = await User.findOneAndUpdate(
      { _id: req.user.id },
      { $set: { avatarFileId: fileId, avatarUrl: null } },
      { projection: { avatarFileId: 1 }, new: false },
    );
    const previousFileId = before?.avatarFileId;

    if (previousFileId && String(previousFileId) !== String(fileId)) {
      await avatarGridfsService.deleteFile(previousFileId);
    }

    await AuditLog.create({
      userType: "client",
      log: `Client uploaded a new profile avatar`,
      metadata: { userId: req.user.id },
    });

    const updated = await userRepository.findById(req.user.id);
    return res.status(200).json(
      apiResponse({
        message: "Avatar updated",
        data: sanitizeUserForClient(updated),
      }),
    );
  },

  streamMyAvatar: async (req, res) => {
    const user = await userRepository.findById(req.user.id);
    if (!user?.avatarFileId) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
    const ok = await avatarGridfsService.pipeFileToResponse(
      user.avatarFileId,
      res,
    );
    if (!ok) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
  },

  streamKycIdProofForMe: async (req, res) => {
    const user = await userRepository.findById(req.user.id);
    if (!user?.idProofFileId) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
    const ok = await kycGridfsService.pipeFileToResponse(
      user.idProofFileId,
      res,
    );
    if (!ok) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
  },

  streamKycAddressProofForMe: async (req, res) => {
    const user = await userRepository.findById(req.user.id);
    if (!user?.addressProofFileId) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
    const ok = await kycGridfsService.pipeFileToResponse(
      user.addressProofFileId,
      res,
    );
    if (!ok) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
  },
};

export { userController };
