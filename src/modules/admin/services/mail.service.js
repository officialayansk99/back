import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ImapFlow } from "imapflow";
import { SmtpConfig } from "../models/smtp.model.js";
import { EmailerConfig } from "../models/emailer.model.js";
import { logger } from "../../../common/utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The brand logo travels with the message as an inline (`cid:`) attachment
 * instead of being hotlinked from the website. A hotlinked logo breaks whenever
 * the site is undeployed, down, or missing a valid TLS certificate; an inline
 * one cannot. Templates opt in by referencing `cid:brand-logo` — we only attach
 * the file when a rendered body actually asks for it, so nothing else grows an
 * unexpected attachment.
 */
const LOGO_CID = "brand-logo";
const LOGO_PATH = path.resolve(
  __dirname,
  "../../../../assets/equiti-capitals-logo.png",
);

/**
 * All outbound mail content must come from Admin → Emailers (EmailerConfig collection).
 * Bodies are HTML; use inline styles in templates for colors and branding.
 *
 * All placeholder values are HTML-escaped before substitution to prevent
 * stored-XSS via user-controlled fields (e.g. names, addresses). Placeholder
 * keys ending in `_URL` are treated as links — only `https?:` and `mailto:`
 * URLs are passed through, anything else collapses to an empty string.
 *
 * Types used by the app:
 * - CLIENT_PORTAL_WELCOME — first client dashboard visit, once (NAME, EMAIL)
 * - FORGOT_PASSWORD — password reset link (NAME, RESET_URL, EXPIRES_IN_MINUTES)
 * - KYC_PENDING | KYC_APPROVED | KYC_REJECTED — admin profile update (NAME, STATUS)
 * - MT5_ACCOUNT_PENDING — manual MT5 request to client (NAME, EMAIL, TYPE, LEVERAGE, GROUP, SUPPORT_EMAIL)
 * - MT5_ACCOUNT_REQUEST_STAFF — same request, sent to support mailbox (same placeholders)
 * - MT5_CREDENTIALS_DELIVERED — admin linked MT5 (NAME, EMAIL, LOGIN, PASSWORD, INVESTOR_PASSWORD, SERVER)
 * - WITHDRAW_UPDATE | DEPOSIT_UPDATE — transaction approve/reject (NAME, EMAIL, AMOUNT, TYPE, STATUS).
 */
/**
 * Minimal HTML escape for placeholder values that get interpolated into
 * `mailBody` (which is HTML). Some placeholders (e.g. RESET_URL, an absolute
 * https link) intentionally need the URL to remain intact, so we expose an
 * opt-out via the `safeKeys` set the caller can pass in.
 */
function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Subject lines are rendered as plain text by mail clients but some still
 * interpret CRLF as header injection. Strip newlines defensively.
 */
function sanitizeSubject(value) {
  return String(value)
    .replace(/[\r\n]+/g, " ")
    .trim();
}

/**
 * Render a nodemailer mailOptions object to a raw RFC822 buffer without
 * actually sending it. We use this to feed an identical message into the
 * IMAP APPEND call so the Sent folder shows the same MIME the recipient got.
 */
async function buildRawMessage(mailOptions) {
  const streamTransport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const info = await streamTransport.sendMail(mailOptions);
  return info.message; // Buffer
}

/**
 * Try to find the IMAP Sent mailbox. Caller can override via
 * `config.sentMailbox`; otherwise we walk the mailbox list looking for one
 * with the `\Sent` special-use flag, then fall back to common names.
 */
async function resolveSentMailbox(client, override) {
  if (override && override.trim()) return override.trim();

  try {
    const list = await client.list();
    const bySpecialUse = list.find((m) =>
      Array.isArray(m.specialUse)
        ? m.specialUse.includes("\\Sent")
        : m.specialUse === "\\Sent",
    );
    if (bySpecialUse?.path) return bySpecialUse.path;

    const candidates = ["Sent", "INBOX.Sent", "Sent Items", "Sent Mail"];
    for (const name of candidates) {
      if (list.some((m) => m.path === name)) return name;
    }
  } catch (err) {
    logger.warn(
      { message: err.message },
      "Could not list IMAP mailboxes; falling back to 'Sent'",
    );
  }
  return "Sent";
}

class MailService {
  async getSmtpConfig() {
    const config = await SmtpConfig.findOne();
    if (!config) {
      throw new Error("SMTP Configuration not found in database");
    }
    return config;
  }

  /**
   * Returns the inline logo attachment when a rendered body references it, or
   * undefined so nodemailer omits the MIME part entirely.
   *
   * A missing file is not fatal: the header falls back to the live-text
   * wordmark that sits under the image in every template, so the mail still
   * goes out branded rather than failing to send.
   */
  inlineLogoAttachment(body) {
    if (!body || !body.includes(`cid:${LOGO_CID}`)) return undefined;
    if (!fs.existsSync(LOGO_PATH)) {
      logger.warn(
        { path: LOGO_PATH },
        "Inline logo missing; sending without it (text wordmark still renders)",
      );
      return undefined;
    }
    return [
      {
        filename: "equiti-capitals-logo.png",
        path: LOGO_PATH,
        cid: LOGO_CID,
        contentDisposition: "inline",
      },
    ];
  }

  buildTransporter(config) {
    return nodemailer.createTransport({
      host: config.server,
      port: config.port,
      secure: config.ssl, // true for 465, false for other ports
      auth: {
        user: config.username,
        pass: config.password,
      },
      connectionTimeout: config.timeoutMs || 5000,
    });
  }

  /**
   * Append a successfully-sent message to the configured IMAP Sent folder so
   * it surfaces in webmail (Hostinger, Roundcube, Outlook, etc.) like any
   * human-sent email. Errors here are non-fatal — the recipient already got
   * the mail; we only log if the archive copy fails.
   */
  async appendToSent(config, mailOptions) {
    if (!config.imapHost) return; // IMAP not configured — opt-in feature.

    let client;
    try {
      const raw = await buildRawMessage(mailOptions);

      client = new ImapFlow({
        host: config.imapHost,
        port: config.imapPort || (config.imapSecure === false ? 143 : 993),
        secure: config.imapSecure !== false,
        auth: {
          user: config.imapUsername || config.username,
          pass: config.imapPassword || config.password,
        },
        logger: false,
      });

      await client.connect();
      const mailbox = await resolveSentMailbox(client, config.sentMailbox);
      await client.append(mailbox, raw, ["\\Seen"]);
      logger.info(`Archived sent message to IMAP mailbox "${mailbox}"`);
    } catch (err) {
      logger.error(
        { message: err.message },
        "Failed to append sent message to IMAP Sent folder",
      );
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch {
          // ignore logout errors — connection may already be torn down
        }
      }
    }
  }

  /**
   * Sends an email based on a predefined template type.
   *
   * Placeholder values are HTML-escaped before substitution so a user-
   * controlled string (e.g. their name or address) cannot inject markup or
   * scripts into the final email. URL-shaped placeholders (anything ending
   * in `_URL`) are passed through after a strict scheme check, since they
   * must remain clickable.
   *
   * @param {string} emailerType - e.g., 'WELCOME_EMAIL', 'DEPOSIT_CONFIRM'
   * @param {string} toEmail - Recipient email
   * @param {Object} placeholders - Key-value pairs for template replacement
   */
  async sendTemplatedEmail(emailerType, toEmail, placeholders = {}) {
    try {
      const template = await EmailerConfig.findOne({ emailerType });
      if (!template) {
        logger.warn(
          `Email template for type ${emailerType} not found. Skipping email.`,
        );
        return false;
      }

      const config = await this.getSmtpConfig();
      const transporter = this.buildTransporter(config);

      // Replace placeholders in subject and body. Body is HTML so we escape
      // every value; URL-shaped placeholders (key ending in _URL) pass
      // through after a scheme check, so the link remains clickable.
      let body = template.mailBody;
      let subject = template.mailSubject;

      Object.keys(placeholders).forEach((key) => {
        const raw = placeholders[key];
        const isUrlKey = /_URL$/i.test(key);
        let bodyValue;
        if (isUrlKey) {
          const str = String(raw || "");
          const safeUrl =
            /^https?:\/\//i.test(str) || /^mailto:/i.test(str) ? str : "";
          // Even URLs need quote escaping in case the template uses it as
          // an attribute value.
          bodyValue = safeUrl.replace(/"/g, "&quot;");
        } else {
          bodyValue = htmlEscape(raw ?? "");
        }
        const subjectValue = sanitizeSubject(raw ?? "");

        const regex = new RegExp(`{${key}}`, "g");
        body = body.replace(regex, bodyValue);
        subject = subject.replace(regex, subjectValue);
      });

      subject = sanitizeSubject(subject);

      // Relays like Brevo require the From to be a VERIFIED sender, which is not
      // the SMTP auth login (e.g. `b8...@smtp-brevo.com`). MAIL_FROM sets the
      // sender independently of the username; accepts a bare address or a
      // "Name <email>" string. Falls back to the username for providers (e.g.
      // Hostinger) where the login IS the sending address.
      const fromAddress = process.env.MAIL_FROM || config.username;

      const mailOptions = {
        from: fromAddress,
        to: toEmail,
        subject: subject,
        html: body,
        cc: template.ccMail || undefined,
        bcc: template.bccMail || undefined,
        attachments: this.inlineLogoAttachment(body),
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(
        `Email sent: ${emailerType} to ${toEmail}. MessageId: ${info.messageId}`,
      );

      // Mirror to IMAP Sent folder so it shows up in Hostinger webmail.
      // Reuse the exact mailOptions; if a Message-ID was assigned by SMTP,
      // attach it so the archived copy matches what the recipient received.
      await this.appendToSent(config, {
        ...mailOptions,
        messageId: info.messageId,
        date: new Date(),
      });

      return true;
    } catch (error) {
      logger.error(
        { message: error.message },
        `Failed to send email ${emailerType} to ${toEmail}`,
      );
      return false;
    }
  }
}

export const mailService = new MailService();
