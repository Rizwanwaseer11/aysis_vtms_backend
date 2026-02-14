const { Queue } = require("bullmq");
const { REDIS_URL } = require("../config/env");

function isRedisEnabled() {
  return ["true", "1", "yes", "on"].includes(String(process.env.REDIS_ENABLED || "").toLowerCase());
}

function connection() {
  if (!isRedisEnabled() || !REDIS_URL) return null;
  // BullMQ uses ioredis under the hood. In bullmq v5, you pass connection opts
  // With REDIS_URL, bullmq accepts { connection: { url: REDIS_URL } }
  return { url: REDIS_URL };
}

const conn = connection();
const watermarkQueue = conn ? new Queue("watermark", { connection: conn }) : null;
const cleanupQueue = conn ? new Queue("cleanup", { connection: conn }) : null;

if (!conn) {
  console.warn("[queue] Redis disabled; BullMQ queues not started.");
}

module.exports = { watermarkQueue, cleanupQueue };
