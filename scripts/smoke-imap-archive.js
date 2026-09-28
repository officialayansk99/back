/**
 * Smoke test: connects to the configured IMAP server using credentials from
 * the SmtpConfig collection, lists mailboxes, picks a Sent folder, and
 * APPENDs a tiny test message so we can verify it shows up in webmail
 * (Hostinger / Roundcube / Outlook) before deploying.
 *
 * Run from `equiti-capitals-back`:
 *   node scripts/smoke-imap-archive.js
 *
 * Requires MONGO_URI in .env. Read-only besides the one APPEND.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
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

async function buildRawMessage(mailOptions) {
  const t = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const info = await t.sendMail(mailOptions);
  return info.message;
}

async function resolveSentMailbox(client, override) {
  if (override?.trim()) return override.trim();
  const list = await client.list();
  const bySpecial = list.find((m) =>
    Array.isArray(m.specialUse)
      ? m.specialUse.includes("\\Sent")
      : m.specialUse === "\\Sent",
  );
  if (bySpecial?.path) return bySpecial.path;
  for (const name of ["Sent", "INBOX.Sent", "Sent Items", "Sent Mail"]) {
    if (list.some((m) => m.path === name)) return name;
  }
  return "Sent";
}

async function run() {
  await mongoose.connect(mongoUri);
  const cfg = await SmtpConfig.findOne();
  if (!cfg) {
    console.error("No SmtpConfig in DB — save SMTP settings from admin UI.");
    process.exit(1);
  }
  if (!cfg.imapHost) {
    console.error(
      "imapHost is empty on SmtpConfig — run scripts/set-imap-hostinger.js first.",
    );
    process.exit(1);
  }

  const fromAddress = cfg.imapUsername || cfg.username;
  console.log("Using IMAP:", {
    host: cfg.imapHost,
    port: cfg.imapPort || 993,
    secure: cfg.imapSecure !== false,
    user: fromAddress,
  });

  const raw = await buildRawMessage({
    from: cfg.username,
    to: cfg.username,
    subject: `[smoke] IMAP archive test ${new Date().toISOString()}`,
    text: "This is a backend smoke test — safe to delete.",
    html: "<p>This is a backend smoke test &mdash; safe to delete.</p>",
    date: new Date(),
  });

  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort || (cfg.imapSecure === false ? 143 : 993),
    secure: cfg.imapSecure !== false,
    auth: {
      user: cfg.imapUsername || cfg.username,
      pass: cfg.imapPassword || cfg.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log("✓ IMAP connected & authenticated.");

    const mailbox = await resolveSentMailbox(client, cfg.sentMailbox);
    console.log(`✓ Sent folder resolved: "${mailbox}"`);

    const result = await client.append(mailbox, raw, ["\\Seen"]);
    console.log("✓ APPEND succeeded:", {
      path: result?.path,
      uid: result?.uid,
      uidValidity: String(result?.uidValidity ?? ""),
    });
    console.log(
      `\nCheck your Hostinger webmail Sent folder for subject starting with "[smoke] IMAP archive test".`,
    );
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
    await mongoose.disconnect();
  }
}

run().catch(async (err) => {
  console.error("\n✗ Smoke test failed:", err.message);
  if (err.responseStatus) console.error("  IMAP status:", err.responseStatus);
  if (err.responseText) console.error("  IMAP server said:", err.responseText);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
