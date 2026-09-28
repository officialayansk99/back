import mongoose from "mongoose";

const mt5AccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    login: {
      type: Number,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["demo", "live"],
      required: true,
    },
    server: {
      type: String,
      required: true,
      trim: true,
    },
    leverage: {
      type: Number,
      required: true,
    },
    group: {
      type: String,
      required: true,
      trim: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    equity: {
      type: Number,
      default: 0,
      min: 0,
    },
    credentials: {
      investorPassword: {
        type: String,
        default: null,
      },
      sentAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Mt5Account = mongoose.model("Mt5Account", mt5AccountSchema);

export { Mt5Account };
