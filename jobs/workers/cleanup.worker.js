/**
 * cleanup.worker.js
 * Deletes media files older than MEDIA_RETENTION_DAYS.
 * This is safe for long-term storage management.
 */
const fs = require("fs");
const path = require("path");
const { Worker } = require("bullmq");
const { REDIS_URL, MEDIA_RETENTION_DAYS, UPLOAD_FINAL_DIR } = require("../../config/env");
const MediaFile = require("../../models/MediaFile");
const { connectMongo } = require("../../config/db");

function conn() {
  if (!REDIS_URL) throw new Error("REDIS_URL required for worker");
  return { url: REDIS_URL };
}

function tryDeleteFileByUrl(url) {
  if (!url) return;
  // Assumes local URLs. For Hostinger storage, replace with delete API.
  const name = url.split("/").pop();
  const filePath = path.join(UPLOAD_FINAL_DIR, name);
  fs.unlink(filePath, () => {});
}

(async () => {
  await connectMongo();

  const worker = new Worker(
    "cleanup",
    async () => {
      const cutoff = new Date(Date.now() - MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const old = await MediaFile.find({ createdAt: { $lt: cutoff }, deletedAt: null }).limit(500).lean();

      for (const m of old) {
        tryDeleteFileByUrl(m.url);
        tryDeleteFileByUrl(m.thumbUrl);
        await MediaFile.updateOne({ _id: m._id }, { $set: { deletedAt: new Date() } });
      }

      return { deleted: old.length };
    },
    { connection: conn(), concurrency: 1 }
  );

  worker.on("failed", (job, err) => console.error("[cleanup worker] job failed", err));
  console.log("[cleanup worker] started");
})();
