import mongoose from "mongoose";

const smtpConfigSchema = new mongoose.Schema(
  {
    server: {
      type: String,
      required: true,
      trim: true,
    },
    port: {
      type: Number,
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    ssl: {
      type: Boolean,
      default: true,
    },
    timeoutMs: {
      type: Number,
      default: 5000,
    },
    // Optional IMAP settings. If configured, every successfully sent message
    // is APPENDed to the IMAP Sent folder so it shows up in Hostinger /
    // webmail under "Sent" alongside human-sent mail.
    imapHost: {
      type: String,
      trim: true,
    },
    imapPort: {
      type: Number,
    },
    imapSecure: {
      type: Boolean,
      default: true,
    },
    // Defaults to SMTP username if blank.
    imapUsername: {
      type: String,
      trim: true,
    },
    // Defaults to SMTP password if blank.
    imapPassword: {
      type: String,
    },
    // Mailbox path. Hostinger usually uses "Sent" or "INBOX.Sent" — leave
    // empty to auto-detect the special-use \Sent folder.
    sentMailbox: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const SmtpConfig = mongoose.model("SmtpConfig", smtpConfigSchema);

export { SmtpConfig };
