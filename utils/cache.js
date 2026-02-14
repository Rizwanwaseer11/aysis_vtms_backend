/**
 * cache.js
 * If Redis is available, use it. Otherwise fallback to NodeCache (in-memory).
 * This gives stable behaviour in dev and production.
 */
const NodeCache = require("node-cache");
const { getRedis } = require("../config/redis");

const memory = new NodeCache({ stdTTL: 30, checkperiod: 60 });

function key(parts) {
  return parts.filter(Boolean).join(":");
}

async function get(cacheKey) {
  const redis = getRedis();
  if (redis) {
    const v = await redis.get(cacheKey);
    return v ? JSON.parse(v) : null;
  }
  return memory.get(cacheKey) || null;
}

async function set(cacheKey, value, ttlSeconds = 20) {
  const redis = getRedis();
  if (redis) {
    await redis.set(cacheKey, JSON.stringify(value), { EX: ttlSeconds });
    return;
  }
  memory.set(cacheKey, value, ttlSeconds);
}

async function del(prefix) {
  const redis = getRedis();
  if (redis) {
    // basic prefix delete (safe small scale). For large scale use SCAN.
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(keys);
    return;
  }
  memory.keys().forEach((k) => {
    if (k.startsWith(prefix)) memory.del(k);
  });
}

module.exports = { key, get, set, del };
