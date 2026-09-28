import mongoose from "mongoose";

const mt5AccountRefSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mt5Account",
      required: true,
    },
    login: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["demo", "live"],
      required: true,
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["client", "superadmin", "representative"],
      default: "client",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "processing", "disabled"],
      default: "pending",
      index: true,
    },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    phone: String,
    address: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
    socialMedia: {
      facebook: String,
      twitter: String,
      instagram: String,
      youtube: String,
    },
    bankDetails: {
      accountName: String,
      bankName: String,
      accountNumber: String,
      ifsc: String,
      branchName: String,
    },
    mt5Accounts: {
      type: [mt5AccountRefSchema],
      default: [],
    },
    referralBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    avatarUrl: String,
    /** When the user uploads an avatar, the GridFS file id. The DTO derives
     *  the streaming URL from this rather than from the legacy avatarUrl. */
    avatarFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    /** Optional external URL only (KYC files are stored in GridFS). */
    idProofUrl: String,
    addressProofUrl: String,
    idProofFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    addressProofFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    /** First successful client dashboard visit triggers welcome email once */
    portalWelcomeEmailSentAt: {
      type: Date,
      default: null,
    },
    /**
     * Bumped whenever the password is set/changed (login flow, self-service
     * change, admin reset, password reset link). JWTs include this as the
     * `pwdv` claim so existing tokens stop working as soon as the password
     * rotates — protects against stolen tokens surviving a password change.
     *
     * IMPORTANT: default is `null`, never `() => new Date()`. A function
     * default would re-run on every Mongoose hydration of a legacy doc
     * that has no value persisted, producing a "rolling now" timestamp
     * that invalidates tokens the instant they're issued. Legacy users
     * just have `pwdv: 0` until they next change their password, which is
     * the safe and intended behavior.
     */
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const User = mongoose.model("User", userSchema);

export { User };
