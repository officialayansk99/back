import mongoose from "mongoose";

const emailerConfigSchema = new mongoose.Schema(
  {
    emailerType: {
      type: String,
      required: true,
      trim: true,
    },
    mailSubject: {
      type: String,
      required: true,
    },
    mailTemplateParameter: {
      type: String,
    },
    ccMail: {
      type: String,
    },
    bccMail: {
      type: String,
    },
    mailBody: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const EmailerConfig = mongoose.model("EmailerConfig", emailerConfigSchema);

export { EmailerConfig };
