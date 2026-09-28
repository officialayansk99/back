import { DepositSettings } from "../models/depositSettings.model.js";
import * as depositQrGridfs from "./depositQrGridfs.service.js";

const DEFAULTS = {
  beneficiaryName: "SNAP CINE DIGITAL",
  bankName: "ICICI BANK LTD",
  accountNumber: "000705051065",
  ifscCode: "ICIC0000007",
  qrCodeUrl: "",
  qrHelpText: "Scan the QR code above to pay via UPI, PhonePe, or Google Pay.",
};

async function ensureDocument() {
  let doc = await DepositSettings.findOne();
  if (!doc) {
    doc = await DepositSettings.create(DEFAULTS);
  }
  return doc;
}

/** Relative to /api/v1 for authenticated GET (blob). */
const QR_IMAGE_API_PATH = "transactions/deposit-qr/file";

function toPublicShape(doc) {
  const o = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  const hasQrFile = Boolean(o.qrCodeFileId);
  return {
    beneficiaryName: String(o.beneficiaryName ?? ""),
    bankName: String(o.bankName ?? ""),
    accountNumber: String(o.accountNumber ?? ""),
    ifscCode: String(o.ifscCode ?? ""),
    qrCodeUrl: String(o.qrCodeUrl ?? ""),
    qrHelpText: String(o.qrHelpText ?? ""),
    qrCodeImagePath: hasQrFile ? QR_IMAGE_API_PATH : null,
    updatedAt: o.updatedAt ?? null,
  };
}

async function getDepositSettingsForApi() {
  const doc = await ensureDocument();
  return toPublicShape(doc);
}

async function getQrCodeFileId() {
  const doc = await ensureDocument();
  return doc.qrCodeFileId || null;
}

async function replaceQrCodeFile(buffer, { filename, contentType }) {
  await ensureDocument();
  const existing = await DepositSettings.findOne();
  if (existing?.qrCodeFileId) {
    await depositQrGridfs.deleteFile(existing.qrCodeFileId);
  }
  const fileId = await depositQrGridfs.uploadFromBuffer(buffer, {
    filename: filename || `deposit-qr-${Date.now()}.png`,
    contentType,
  });
  await DepositSettings.findOneAndUpdate(
    {},
    { $set: { qrCodeFileId: fileId, qrCodeUrl: "" } },
  );
  return getDepositSettingsForApi();
}

async function clearQrCodeFile() {
  await ensureDocument();
  const doc = await DepositSettings.findOne();
  if (doc?.qrCodeFileId) {
    await depositQrGridfs.deleteFile(doc.qrCodeFileId);
  }
  await DepositSettings.findOneAndUpdate({}, { $set: { qrCodeFileId: null } });
  return getDepositSettingsForApi();
}

async function patchDepositSettings(payload) {
  await ensureDocument();

  if (Object.prototype.hasOwnProperty.call(payload, "qrCodeUrl")) {
    const url = String(payload.qrCodeUrl ?? "").trim();
    if (url) {
      const doc = await DepositSettings.findOne();
      if (doc?.qrCodeFileId) {
        await depositQrGridfs.deleteFile(doc.qrCodeFileId);
      }
    }
  }

  const $set = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  );

  if (
    Object.prototype.hasOwnProperty.call(payload, "qrCodeUrl") &&
    String(payload.qrCodeUrl ?? "").trim()
  ) {
    $set.qrCodeFileId = null;
  }

  if (Object.keys($set).length === 0) {
    return getDepositSettingsForApi();
  }

  await DepositSettings.findOneAndUpdate({}, { $set }, { new: true });
  return getDepositSettingsForApi();
}

export {
  DEFAULTS,
  clearQrCodeFile,
  getDepositSettingsForApi,
  getQrCodeFileId,
  patchDepositSettings,
  replaceQrCodeFile,
};
