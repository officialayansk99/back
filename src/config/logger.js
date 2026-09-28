import pino from "pino";
import { nodeEnv } from "./env.js";
import { requestContext } from "../middlewares/requestContextProvider.js";

const logger = pino({
  level: nodeEnv === "production" ? "info" : "debug",
  transport:
    nodeEnv !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  mixin() {
    const store = requestContext.getStore();
    const reqId = store?.get("reqId");
    return reqId ? { reqId } : {};
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["password", "token", "apiKey", "secret", "authorization"],
    remove: true,
  },
});

export { logger };
