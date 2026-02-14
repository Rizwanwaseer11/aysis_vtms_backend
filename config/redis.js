/**
 * redis.js
 * Redis is used for:
 * - caching lists + KPIs (short TTL)
 * - BullMQ queues (watermark + cleanup)
 */
const { createClient } = require("redis");
const { REDIS_URL } = require("./env");

let client = null;

async function connectRedis() {
  const redisEnabled = ["true", "1", "yes", "on"].includes(
    String(process.env.REDIS_ENABLED || "").toLowerCase()
  );

  if (!redisEnabled) {
    console.warn("[redis] disabled (REDIS_ENABLED not true). Cache will fallback to in-memory.");
    return null;
  }

  if (!REDIS_URL) {
    console.warn("[redis] REDIS_URL not set. Cache will fallback to in-memory.");
    return null;
  }

  client = createClient({ url: REDIS_URL });
  client.on("error", (err) => console.error("[redis] error", err));

  await client.connect();
  console.log("[redis] connected");
  return client;
}

function getRedis() {
  return client;
}

module.exports = { connectRedis, getRedis };
