const http = require("http");
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const { PORT, API_BASE, UPLOAD_TMP_DIR, UPLOAD_FINAL_DIR } = require("./config/env");
const { connectMongo } = require("./config/db");
const { connectRedis } = require("./config/redis");
const routes = require("./routes");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const { initSockets } = require("./sockets");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function bootstrap() {
  await connectMongo();
  await connectRedis();

  ensureDir(UPLOAD_TMP_DIR);
  ensureDir(UPLOAD_FINAL_DIR);

  const app = express();

  // Security & basic performance
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Logs
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  // Static for local uploads (dev)
  app.use("/uploads/tmp", express.static(path.resolve(UPLOAD_TMP_DIR)));
  app.use("/uploads/final", express.static(path.resolve(UPLOAD_FINAL_DIR)));

  // Health check
  app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

  // API routes
  app.use(API_BASE, routes);

  app.use(notFound);
  app.use(errorHandler);

  const server = http.createServer(app);

  // Socket.IO (chat)
  initSockets(server);

  server.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT} base=${API_BASE} pid=${process.pid}`);
  });
}

bootstrap().catch((e) => {
  console.error("[bootstrap] fatal", e);
  process.exit(1);
});
