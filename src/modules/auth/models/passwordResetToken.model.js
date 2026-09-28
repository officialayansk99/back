import mongoose from "mongoose";

/**
 * One-time, hashed password reset tokens.
 *
 * The plaintext token is sent in the email link; only its SHA-256 hash is
 * stored, so a database leak does not equate to a leak of valid reset links.
 * Each document is single-use (`findOneAndDelete` on consumption) and TTL'd
 * via Mongo's expiry monitor in case the user never clicks the link.
 */
const passwordResetTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedFromIp: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const PasswordResetToken = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema,
);

export { PasswordResetToken };
