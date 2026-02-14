/**
 * cron.js
 * Minimal scheduler that enqueues cleanup periodically.
 * In production, run this as a separate process (pm2 start jobs/schedulers/cron.js)
 */
const { cleanupQueue } = require("../queue");

(async () => {
  console.log("[cron] scheduler started");

  // enqueue cleanup every 6 hours
  setInterval(async () => {
    try {
      await cleanupQueue.add("cleanup", {}, { removeOnComplete: true, removeOnFail: true });
      console.log("[cron] cleanup enqueued");
    } catch (e) {
      console.error("[cron] failed to enqueue cleanup", e.message);
    }
  }, 6 * 60 * 60 * 1000);
})();

