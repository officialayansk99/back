import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";

const BUCKET = "depositQr";

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database not connected");
  }
  return new GridFSBucket(db, { bucketName: BUCKET });
}

async function uploadFromBuffer(buffer, { filename, contentType }) {
  const bucket = getBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: contentType || "application/octet-stream",
      metadata: { kind: "depositQr" },
    });
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });
}

async function deleteFile(fileId) {
  if (!fileId) return;
  const bucket = getBucket();
  try {
    await bucket.delete(new ObjectId(String(fileId)));
  } catch {
    /* stale id */
  }
}

async function pipeFileToResponse(fileId, res) {
  const bucket = getBucket();
  const _id = new ObjectId(String(fileId));
  const metaList = await bucket.find({ _id }).toArray();
  if (!metaList.length) {
    return false;
  }
  const meta = metaList[0];
  res.setHeader("Content-Type", meta.contentType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(meta.filename || "qr.png")}`,
  );
  res.setHeader("Cache-Control", "private, no-store");

  const stream = bucket.openDownloadStream(_id);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.status(500).end();
    }
  });
  stream.pipe(res);
  return true;
}

export { deleteFile, pipeFileToResponse, uploadFromBuffer };
