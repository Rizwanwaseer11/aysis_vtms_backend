const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");
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

function resolveWritableDir(preferredPath, fallbackParts) {
  try {
    ensureDir(preferredPath);
    return preferredPath;
  } catch (e) {
    const fallback = path.join(os.tmpdir(), ...fallbackParts);
    try {
      ensureDir(fallback);
      return fallback;
    } catch (err) {
      console.error("[bootstrap] upload dir unavailable", { preferredPath, fallback, err });
      return preferredPath;
    }
  }
}

async function bootstrap() {
  await connectMongo();
  await connectRedis();

  const TMP_DIR = resolveWritableDir(UPLOAD_TMP_DIR, ["uploads", "tmp"]);
  const FINAL_DIR = resolveWritableDir(UPLOAD_FINAL_DIR, ["uploads", "final"]);

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
  app.use("/uploads/tmp", express.static(path.resolve(TMP_DIR)));
  app.use("/uploads/final", express.static(path.resolve(FINAL_DIR)));

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
