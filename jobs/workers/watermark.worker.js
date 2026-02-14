/**
 * watermark.worker.js
 * Worker process that:
 * - reads temp/local file
 * - applies watermark text
 * - creates thumbnail
 * - writes final paths
 *
 * NOTE: In production you can replace local storage with Hostinger storage upload code.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { Worker } = require("bullmq");
const { REDIS_URL, UPLOAD_FINAL_DIR, PUBLIC_BASE_URL } = require("../../config/env");
const MediaFile = require("../../models/MediaFile");
const { connectMongo } = require("../../config/db");

function conn() {
  if (!REDIS_URL) throw new Error("REDIS_URL required for worker");
  return { url: REDIS_URL };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function makeSvgWatermark(text) {
  // Simple SVG overlay. For Urdu/complex scripts, consider using an image-based watermark.
  const safe = String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return Buffer.from(`
    <svg width="1200" height="200">
      <rect x="0" y="0" width="1200" height="200" fill="rgba(0,0,0,0.35)"/>
      <text x="30" y="120" font-size="48" fill="white" font-family="Arial, sans-serif">${safe}</text>
    </svg>
  `);
}

(async () => {
  await connectMongo();

  const worker = new Worker(
    "watermark",
    async (job) => {
      const { mediaId, inputPath, watermarkText } = job.data;

      const media = await MediaFile.findById(mediaId);
      if (!media) return;

      try {
        ensureDir(UPLOAD_FINAL_DIR);
        const fileName = path.basename(inputPath);
        const outPath = path.join(UPLOAD_FINAL_DIR, fileName);
        const thumbPath = path.join(UPLOAD_FINAL_DIR, `thumb_${fileName}`);

        const svg = makeSvgWatermark(watermarkText);

        await sharp(inputPath)
          .composite([{ input: svg, gravity: "southwest" }])
          .jpeg({ quality: 75 })
          .toFile(outPath);

        await sharp(outPath)
          .resize({ width: 320 })
          .jpeg({ quality: 70 })
          .toFile(thumbPath);

        const url = `${PUBLIC_BASE_URL}/uploads/final/${fileName}`;
        const thumbUrl = `${PUBLIC_BASE_URL}/uploads/final/thumb_${fileName}`;

        media.url = url;
        media.thumbUrl = thumbUrl;
        media.watermarkStatus = "DONE";
        await media.save();

        // cleanup temp file
        fs.unlink(inputPath, () => {});
      } catch (e) {
        media.watermarkStatus = "FAILED";
        await media.save();
      }
    },
    { connection: conn(), concurrency: 2 }
  );

  worker.on("failed", (job, err) => console.error("[watermark worker] job failed", err));
  console.log("[watermark worker] started");
})();
