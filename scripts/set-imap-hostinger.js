/**
 * One-off migration: set Hostinger IMAP fields on the existing SmtpConfig
 * document so outgoing mail gets archived in the IMAP "Sent" folder.
 *
 * Run from `equiti-capitals-back`:
 *   node scripts/set-imap-hostinger.js
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

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected to Mongo.");

  const existing = await SmtpConfig.findOne();
  if (!existing) {
    console.error(
      "No SmtpConfig document found. Save SMTP settings from the admin UI first.",
    );
    process.exit(1);
  }

  existing.imapHost = "imap.hostinger.com";
  existing.imapPort = 993;
  existing.imapSecure = true;
  // Reuse SMTP credentials when these are blank.
  if (!existing.imapUsername) existing.imapUsername = "";
  if (!existing.imapPassword) existing.imapPassword = "";
  // Empty -> auto-detect via \Sent special-use flag.
  if (!existing.sentMailbox) existing.sentMailbox = "";

  await existing.save();
  console.log("Updated SmtpConfig with Hostinger IMAP settings:");
  console.log({
    imapHost: existing.imapHost,
    imapPort: existing.imapPort,
    imapSecure: existing.imapSecure,
    sentMailbox: existing.sentMailbox || "(auto-detect)",
  });

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
