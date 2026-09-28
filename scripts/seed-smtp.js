/**
 * Writes the SMTP + IMAP settings that Admin → SMTP Settings would otherwise
 * save by hand. There is only ever one SmtpConfig document — this upserts it.
 *
 * Credentials are read from .env (gitignored) so the password never lands in
 * a committed file. The SMTP password must be stored reversibly: nodemailer
 * authenticates with the real password, so it cannot be hashed.
 *
 * Required in .env:
 *   SMTP_USERNAME=info@equiticapitals.com
 *   SMTP_PASSWORD=your-mailbox-password
 *
 * Optional (Hostinger defaults shown):
 *   SMTP_SERVER=smtp.hostinger.com
 *   SMTP_PORT=465
 *   SMTP_SSL=true
 *   IMAP_HOST=imap.hostinger.com      — set IMAP_HOST= (empty) to disable Sent archiving
 *   IMAP_PORT=993
 *   IMAP_SECURE=true
 *   IMAP_SENT_MAILBOX=               — blank auto-detects the \Sent folder
 *
 * Run from `equiti-capitals-back`:
 *   npm run seed:smtp
 *
 * Requires MONGO_URI in .env
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { SmtpConfig } from "../src/modules/admin/models/smtp.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("Missing MONGO_URI in .env");
  process.exit(1);
}

const username = process.env.SMTP_USERNAME;
const password = process.env.SMTP_PASSWORD;

if (!username || !password) {
  console.error(
    "Missing SMTP_USERNAME and/or SMTP_PASSWORD in .env.\n" +
      "Add them, then re-run. Example:\n" +
      "  SMTP_USERNAME=info@equiticapitals.com\n" +
      "  SMTP_PASSWORD=your-mailbox-password",
  );
  process.exit(1);
}

const bool = (v, fallback) =>
  v === undefined || v === "" ? fallback : v.toLowerCase() === "true";

// IMAP_HOST explicitly set to empty disables Sent-folder archiving.
const imapHost =
  process.env.IMAP_HOST === undefined
    ? "imap.hostinger.com"
    : process.env.IMAP_HOST;

const config = {
  server: process.env.SMTP_SERVER || "smtp.hostinger.com",
  port: Number(process.env.SMTP_PORT || 465),
  username,
  password,
  ssl: bool(process.env.SMTP_SSL, true),
  timeoutMs: Number(process.env.SMTP_TIMEOUT_MS || 10000),
  imapHost,
  imapPort: Number(process.env.IMAP_PORT || 993),
  imapSecure: bool(process.env.IMAP_SECURE, true),
  // Blank -> mail.service.js falls back to the SMTP credentials.
  imapUsername: process.env.IMAP_USERNAME || "",
  imapPassword: process.env.IMAP_PASSWORD || "",
  // Blank -> auto-detect the \Sent special-use folder.
  sentMailbox: process.env.IMAP_SENT_MAILBOX || "",
};

async function run() {
  await mongoose.connect(mongoUri);
  console.log(`Connected to ${mongoose.connection.name}`);

  const existing = await SmtpConfig.findOne();
  if (existing) {
    Object.assign(existing, config);
    await existing.save();
    console.log("\nUpdated existing SMTP config.");
  } else {
    await SmtpConfig.create(config);
    console.log("\nCreated SMTP config.");
  }

  console.log({
    server: config.server,
    port: config.port,
    username: config.username,
    password: "***",
    ssl: config.ssl,
    imapHost: config.imapHost || "(disabled)",
    imapPort: config.imapPort,
    sentMailbox: config.sentMailbox || "(auto-detect)",
  });
  console.log("");

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // already disconnected
  }
  process.exit(1);
});
