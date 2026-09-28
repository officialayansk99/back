import mongoose from "mongoose";

/**
 * Single-use, short-lived handoff token used by the admin Impersonation flow.
 *
 * The admin endpoint mints a random `code` and stores it here. The new browser
 * tab POSTs the code to /auth/impersonate/exchange, the document is atomically
 * consumed (findOneAndDelete) and a real JWT is returned in the response body.
 *
 * Why this exists:
 * - JWTs never travel through the URL / browser history / Referer headers.
 * - A code can be exchanged at most once.
 * - Codes self-destruct via Mongo's TTL monitor in case the tab is never opened.
 */
const impersonationCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminEmail: {
      type: String,
      required: true,
    },
    issuedFromIp: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      // TTL monitor purges expired docs in the background (~60s cadence).
      // We still re-check expiresAt at exchange time for correctness.
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const ImpersonationCode = mongoose.model(
  "ImpersonationCode",
  impersonationCodeSchema,
);

export { ImpersonationCode };
