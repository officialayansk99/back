import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";

const BUCKET = "kyc";

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database not connected");
  }
  return new GridFSBucket(db, { bucketName: BUCKET });
}

async function uploadFromBuffer(
  buffer,
  { filename, contentType, userId, docKind },
) {
  const bucket = getBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: contentType || "application/octet-stream",
      metadata: { userId: String(userId), docKind: String(docKind) },
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
  } catch (err) {
    if (err?.code !== "ENOENT" && err?.message !== "File not found") {
      throw err;
    }
  }
}

async function deleteFileIds(ids) {
  const list = [ids].flat().filter(Boolean);
  await Promise.all(list.map((id) => deleteFile(id)));
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
    `inline; filename*=UTF-8''${encodeURIComponent(meta.filename || "document")}`,
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

export { deleteFile, deleteFileIds, pipeFileToResponse, uploadFromBuffer };
