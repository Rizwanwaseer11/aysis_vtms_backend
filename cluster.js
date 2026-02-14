/**
 * cluster.js
 * Runs multiple Node workers to utilize all CPU cores.
 * In production you will typically run this via PM2:
 *   pm2 start cluster.js -i max
 * But this file also supports native node cluster.
 */
const cluster = require("cluster");
const os = require("os");

const WORKERS = Number(process.env.WORKERS || os.cpus().length);

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} is running. Spawning ${WORKERS} workers...`);

  for (let i = 0; i < WORKERS; i++) cluster.fork();

  cluster.on("exit", (worker, code, signal) => {
    console.error(`[cluster] Worker ${worker.process.pid} died (code=${code}, signal=${signal}). Restarting...`);
    cluster.fork();
  });
} else {
  require("./server");
}

