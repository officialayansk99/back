import mongoose from "mongoose";

const depositSettingsSchema = new mongoose.Schema(
  {
    beneficiaryName: { type: String, default: "" },
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    /** Public URL to QR image when not using GridFS upload */
    qrCodeUrl: { type: String, default: "" },
    qrHelpText: { type: String, default: "" },
    qrCodeFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const DepositSettings = mongoose.model(
  "DepositSettings",
  depositSettingsSchema,
);

export { DepositSettings };
