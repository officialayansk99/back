import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { clientOrigins } from "./config/env.js";
import { logger } from "./config/logger.js";
import { router as apiRouter } from "./routes/index.js";
import { notFound } from "./common/middleware/notFound.middleware.js";
import { errorHandler } from "./common/errors/errorHandler.js";
import { requestContextProvider } from "./middlewares/requestContextProvider.js";

const app = express();

app.set("trust proxy", 1);

/** Uptime pings (cron-job.org, Render keep-warm): keep body under 4 KB (cron-job.org limit). Plain OK is enough. */
app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("OK");
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    /**
     * Allow-list driven by CLIENT_ORIGIN. Server-to-server callers (curl,
     * monitoring) send no Origin header at all and get unconditional pass.
     * Browser callers must match one of the configured origins.
     */
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (clientOrigins.includes(origin)) return callback(null, true);
      logger.warn({ origin }, "CORS request blocked: origin not allow-listed");
      return callback(new Error("Origin not allowed"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(requestContextProvider);
app.use(
  pinoHttp({
    logger,
    autoLogging: true,
    genReqId: (req) => req.id,
    customLogLevel: (res, _err) => {
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        responseTime: res.responseTime,
      }),
      err: (err) => ({
        message: err.message,
        stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
      }),
    },
  }),
);
app.use(compression());
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use("/api/v1", apiRouter);
app.use(notFound);
app.use(errorHandler);

export { app };
