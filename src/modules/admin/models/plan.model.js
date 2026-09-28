import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    groupName: {
      type: String,
      required: true,
    },
    leverage: {
      type: String,
      required: true,
    },
    minDeposit: {
      type: Number,
      required: true,
      min: 0,
    },
    bonusType: {
      type: String,
    },
    ibCommission: {
      type: String,
    },
    mode: {
      type: String,
    },
    commissionPerLot: {
      type: Number,
      default: 0,
    },
    comment: {
      type: String,
    },
    active: {
      type: Boolean,
      default: true,
    },
    leverageFix: {
      type: Boolean,
      default: false,
    },
    selfCommission: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Plan = mongoose.model("Plan", planSchema);

export { Plan };
