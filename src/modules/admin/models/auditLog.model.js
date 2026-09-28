import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    userEmail: {
      type: String,
    },
    userType: {
      type: String, // e.g. "admin", "client"
    },
    log: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
    },
    metadata: {
      type: Object,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export { AuditLog };
