const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, "..");

function resolvePath(input) {
  if (!input) return input;
  return path.isAbsolute(input) ? input : path.resolve(ROOT_DIR, input);
}

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 4000),
  API_BASE: process.env.API_BASE || "/api/v1",

  MONGO_URI: must("MONGO_URI"),

  JWT_SECRET: must("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  REDIS_URL: process.env.REDIS_URL || "",

  UPLOAD_TMP_DIR: resolvePath(process.env.UPLOAD_TMP_DIR || "./uploads/tmp"),
  UPLOAD_FINAL_DIR: resolvePath(process.env.UPLOAD_FINAL_DIR || "./uploads/final"),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "",

  MEDIA_RETENTION_DAYS: Number(process.env.MEDIA_RETENTION_DAYS || 90),

  CACHE_TTL_LIST_SECONDS: Number(process.env.CACHE_TTL_LIST_SECONDS || 20),
  CACHE_TTL_KPI_SECONDS: Number(process.env.CACHE_TTL_KPI_SECONDS || 30),
};
