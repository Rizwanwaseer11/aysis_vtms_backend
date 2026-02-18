const path = require("path");
const fs = require("fs");
const os = require("os");
const multer = require("multer");
const crypto = require("crypto");
const { ok, fail } = require("../utils/response");
const { UPLOAD_TMP_DIR, PUBLIC_BASE_URL } = require("../config/env");
const MediaFile = require("../models/MediaFile");
const { watermarkQueue } = require("../jobs/queue");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function resolveTmpDir() {
  try {
    return ensureDir(UPLOAD_TMP_DIR);
  } catch (e) {
    // Fallback for read-only platforms (e.g., Vercel)
    const fallback = path.join(os.tmpdir(), "uploads", "tmp");
    try {
      return ensureDir(fallback);
    } catch (err) {
      // Last resort: let multer fail later with a clearer error
      return UPLOAD_TMP_DIR;
    }
  }
}

// Multer storage (tmp)
const TMP_DIR = resolveTmpDir();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg") || ".jpg";
    const rand = crypto.randomBytes(8).toString("hex"); // 16 chars
    cb(null, `${Date.now()}_${rand}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB safety; your frontend should compress
});

/**
 * POST /media/upload
 * Multipart: file
 * Body: { linkedTo, kind, activityType, activityId, attendanceId, meta }
 */
async function uploadMedia(req, res, next) {
  try {
    if (!req.file) return fail(res, "file is required");
    const body = req.body || {};

    const linkedTo = body.linkedTo;
    const kind = body.kind;
    if (!linkedTo || !kind) return fail(res, "linkedTo and kind are required");

    // Create temp URL (will be replaced after watermark)
    const tempUrl = `${PUBLIC_BASE_URL}/uploads/tmp/${req.file.filename}`;

    // meta can include: supervisorName, binNumber, coords, zone/uc/ward etc.
    let meta = {};
    try { meta = body.meta ? JSON.parse(body.meta) : {}; } catch { meta = {}; }

    const doc = await MediaFile.create({
      linkedTo,
      activityType: body.activityType || "",
      activityId: body.activityId || null,
      attendanceId: body.attendanceId || null,
      uploaderKind: req.auth.kind,
      uploaderId: req.auth.id,
      kind,
      url: tempUrl,
      thumbUrl: "",
      watermarkStatus: "PENDING",
      meta
    });

    // Build watermark line text (simple). You can expand to multi-line.
    const watermarkText = [
      meta.supervisorName ? `Sup: ${meta.supervisorName}` : "",
      meta.binNumber ? `Bin: ${meta.binNumber}` : "",
      meta.mtNumber ? `MT: ${meta.mtNumber}` : "",
      meta.coords ? `GPS: ${meta.coords}` : "",
      meta.zone ? `Zone: ${meta.zone}` : "",
      meta.uc ? `UC: ${meta.uc}` : "",
      meta.ward ? `Ward: ${meta.ward}` : ""
    ].filter(Boolean).join(" | ");

    // Queue watermark job (if redis not configured, just mark DONE and keep temp URL in dev)
    if (watermarkQueue) {
      try {
        await watermarkQueue.add(
          "watermark",
          { mediaId: doc._id.toString(), inputPath: req.file.path, watermarkText },
          { removeOnComplete: true, removeOnFail: true }
        );
      } catch (e) {
        // If queue fails, keep as pending but still return.
      }
    }

    return ok(res, "Uploaded", { mediaId: doc._id, url: doc.url, status: doc.watermarkStatus }, null, 201);
  } catch (e) { next(e); }
}

module.exports = { upload, uploadMedia };
