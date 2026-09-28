import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["deposit", "withdraw"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "rejected"],
      default: "pending",
    },
    method: {
      type: String,
      default: "bank_transfer", // e.g. "bank_transfer", "qr_code"
    },
    proofUrl: {
      type: String,
      default: null,
    },
    /**
     * GridFS fileId of the deposit payment proof uploaded by the client.
     * Replaces the old free-text proofUrl which was unsigned/unauthenticated.
     */
    proofFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    /**
     * MT5 login the deposit is intended to fund. We persist the login number
     * (not the Mt5Account _id) because admins identify accounts by login in
     * MT5 itself, and the login is stable across CRM record changes.
     */
    mt5Login: {
      type: Number,
      default: null,
      index: true,
    },
    note: {
      type: String,
      default: "",
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for client-initiated
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export { Transaction };
