import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  jwtSecret,
  jwtExpiresIn,
  impersonationTokenExpiresIn,
  impersonationCodeTtlSeconds,
  passwordResetTokenTtlMinutes,
  passwordResetRateWindowMinutes,
  passwordResetRateMax,
  clientBaseUrl,
} from "../../../config/env.js";
import { UserRepository } from "../../users/repositories/user.repository.js";
import { AppError } from "../../../common/errors/AppError.js";

import { mailService } from "../../admin/services/mail.service.js";
import { AuditLog } from "../../admin/models/auditLog.model.js";
import { ImpersonationCode } from "../models/impersonationCode.model.js";
import { PasswordResetToken } from "../models/passwordResetToken.model.js";

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  signToken(user, extraClaims = {}, options = {}) {
    return jwt.sign(
      {
        sub: user._id,
        role: user.role,
        email: user.email,
        // Token version derived from the user's last password change. The
        // auth middleware compares this to the live value so tokens stop
        // working the moment the password rotates. Legacy users (no
        // passwordChangedAt persisted) get pwdv: 0 here and pwdv: 0 from
        // the live derivation — they match, so tokens stay valid.
        pwdv: user.passwordChangedAt
          ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
          : 0,
        ...extraClaims,
      },
      jwtSecret,
      { expiresIn: options.expiresIn || jwtExpiresIn },
    );
  }

  async register(payload) {
    const existing = await this.userRepository.findByEmail(payload.email);

    if (existing) {
      if (existing.isEmailVerified) {
        throw new AppError("Email already in use", 409, "EMAIL_CONFLICT");
      }

      existing.name = payload.name;
      existing.phone = payload.phone;
      existing.password = await bcrypt.hash(payload.password, 12);
      existing.passwordChangedAt = new Date();
      existing.isEmailVerified = true;
      existing.otp = null;
      existing.otpExpiresAt = null;
      await existing.save();

      await AuditLog.create({
        userType: "system",
        log: `Incomplete registration completed: ${existing.email}`,
        metadata: { userId: existing._id },
      });

      return {
        message: "Account ready. Please sign in.",
        email: existing.email,
      };
    }

    const hash = await bcrypt.hash(payload.password, 12);
    const user = await this.userRepository.create({
      name: payload.name,
      email: payload.email.toLowerCase(),
      phone: payload.phone,
      password: hash,
      passwordChangedAt: new Date(),
      role: "client",
      kycStatus: "pending",
      isEmailVerified: true,
      otp: null,
      otpExpiresAt: null,
    });

    await AuditLog.create({
      userType: "system",
      log: `New user registered: ${user.email}`,
      metadata: { userId: user._id },
    });

    return {
      message: "Account created. Please sign in.",
      email: user.email,
    };
  }

  async login(payload) {
    const user = await this.userRepository.findByEmail(payload.email);
    if (!user) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const matched = await bcrypt.compare(payload.password, user.password);
    if (!matched) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const token = this.signToken(user);

    await AuditLog.create({
      userType: user.role,
      log: `${user.role} logged in: ${user.email}`,
      metadata: { userId: user._id },
    });

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
      },
    };
  }

  /**
   * Step 1 of password reset: emails a one-time link to the user. We never
   * mutate the user's password here — that only happens after the user
   * clicks the link and submits a new password (see resetPassword).
   *
   * Behaviour notes:
   * - Always returns the same generic success message regardless of whether
   *   the email exists, to avoid user enumeration.
   * - Per-account rate limit prevents an attacker from spamming a user with
   *   reset emails.
   * - Plaintext token only travels in the email; we store its SHA-256 hash.
   */
  async forgotPassword(payload, requestMeta = {}) {
    const successMsg =
      "If an account exists for this email, we've sent a password reset link.";

    const user = await this.userRepository.findByEmail(payload.email);
    if (!user) {
      return { message: successMsg };
    }

    // Rate-limit: count recent requests for this user. We deliberately scope
    // by account, not IP, so an attacker rotating IPs still gets blocked.
    const windowMs = passwordResetRateWindowMinutes * 60 * 1000;
    const recentCount = await PasswordResetToken.countDocuments({
      userId: user._id,
      createdAt: { $gte: new Date(Date.now() - windowMs) },
    });
    if (recentCount >= passwordResetRateMax) {
      // Still return the generic success message so the response is
      // indistinguishable from a normal request.
      return { message: successMsg };
    }

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(
      Date.now() + passwordResetTokenTtlMinutes * 60 * 1000,
    );

    await PasswordResetToken.create({
      tokenHash,
      userId: user._id,
      requestedFromIp: requestMeta.ip,
      expiresAt,
    });

    const resetUrl = `${clientBaseUrl.replace(/\/+$/, "")}/reset-password?token=${rawToken}`;
    await mailService.sendTemplatedEmail("FORGOT_PASSWORD", user.email, {
      NAME: user.name,
      RESET_URL: resetUrl,
      EXPIRES_IN_MINUTES: String(passwordResetTokenTtlMinutes),
    });

    await AuditLog.create({
      userId: user._id,
      userEmail: user.email,
      userType: user.role,
      log: `Password reset requested for ${user.email}`,
      ipAddress: requestMeta.ip,
      metadata: {},
    });

    return { message: successMsg };
  }

  /**
   * Step 2 of password reset: validates the one-time token and sets the new
   * password. Single-use (`findOneAndDelete`); also bumps `passwordChangedAt`
   * which invalidates every existing JWT for this account via the `pwdv`
   * claim check in authGuard.
   */
  async resetPassword(payload, requestMeta = {}) {
    const tokenHash = hashResetToken(payload.token);
    const record = await PasswordResetToken.findOneAndDelete({ tokenHash });

    if (!record) {
      throw new AppError(
        "Reset link is invalid or has already been used",
        400,
        "RESET_TOKEN_INVALID",
      );
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new AppError("Reset link has expired", 400, "RESET_TOKEN_EXPIRED");
    }

    const user = await this.userRepository.findById(record.userId);
    if (!user) {
      throw new AppError("Account no longer exists", 404, "USER_NOT_FOUND");
    }

    user.password = await bcrypt.hash(payload.newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    // Invalidate any other reset tokens that may have been issued for this
    // user (e.g. a duplicate request before the link was clicked).
    await PasswordResetToken.deleteMany({ userId: user._id });

    await AuditLog.create({
      userId: user._id,
      userEmail: user.email,
      userType: user.role,
      log: `Password reset completed for ${user.email}`,
      ipAddress: requestMeta.ip,
      metadata: {},
    });

    return { message: "Password updated. You can now sign in." };
  }

  /**
   * Sends CLIENT_PORTAL_WELCOME once per client after they reach the dashboard.
   */
  async sendPortalWelcomeIfNeeded(userContext) {
    const user = await this.userRepository.findById(userContext.id);
    if (!user || user.role !== "client") {
      return { sent: false };
    }
    if (user.portalWelcomeEmailSentAt) {
      return { sent: false };
    }

    const ok = await mailService.sendTemplatedEmail(
      "CLIENT_PORTAL_WELCOME",
      user.email,
      {
        NAME: String(user.name || ""),
        EMAIL: String(user.email || ""),
      },
    );

    user.portalWelcomeEmailSentAt = new Date();
    await user.save();

    return { sent: ok };
  }

  /**
   * Step 1 of admin impersonation: issue a single-use handoff code that the
   * new browser tab will exchange for a real JWT. We never put the JWT itself
   * in the URL.
   */
  async issueImpersonationCode(targetUserId, adminContext, requestMeta = {}) {
    const target = await this.userRepository.findById(targetUserId);
    if (!target) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    if (String(target._id) === String(adminContext.id)) {
      throw new AppError(
        "Cannot impersonate yourself",
        400,
        "IMPERSONATION_SELF_FORBIDDEN",
      );
    }
    if (target.role === "superadmin") {
      throw new AppError(
        "Cannot impersonate another administrator",
        403,
        "IMPERSONATION_FORBIDDEN",
      );
    }

    const code = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + impersonationCodeTtlSeconds * 1000);

    await ImpersonationCode.create({
      code,
      targetUserId: target._id,
      adminId: adminContext.id,
      adminEmail: adminContext.email,
      issuedFromIp: requestMeta.ip,
      expiresAt,
    });

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: impersonationCodeTtlSeconds,
    };
  }

  /**
   * Step 2 of admin impersonation: atomically consume the handoff code and
   * return a JWT scoped to the target user, carrying an `act` claim that
   * records which administrator is behind the session.
   */
  async exchangeImpersonationCode(code, requestMeta = {}) {
    if (!code || typeof code !== "string") {
      throw new AppError(
        "Invalid impersonation code",
        400,
        "IMPERSONATION_CODE_INVALID",
      );
    }

    // Atomic single-use consume; even simultaneous requests can only succeed once.
    const record = await ImpersonationCode.findOneAndDelete({ code });
    if (!record) {
      throw new AppError(
        "Impersonation code is invalid or has already been used",
        400,
        "IMPERSONATION_CODE_INVALID",
      );
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new AppError(
        "Impersonation code has expired",
        400,
        "IMPERSONATION_CODE_EXPIRED",
      );
    }

    const user = await this.userRepository.findById(record.targetUserId);
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const token = this.signToken(
      user,
      {
        act: {
          sub: String(record.adminId),
          email: record.adminEmail,
          role: "superadmin",
        },
      },
      { expiresIn: impersonationTokenExpiresIn },
    );

    await AuditLog.create({
      userId: record.adminId,
      userEmail: record.adminEmail,
      userType: "admin",
      log: `Admin impersonated user: ${user.email}`,
      ipAddress: requestMeta.ip,
      metadata: {
        targetUserId: user._id,
        targetUserEmail: user.email,
      },
    });

    return {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
      },
      impersonatedBy: {
        id: String(record.adminId),
        email: record.adminEmail,
      },
    };
  }
}

export { AuthService };
