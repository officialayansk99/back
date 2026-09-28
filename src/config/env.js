import dotenv from "dotenv";

dotenv.config();

/** When false, MT5 API calls are skipped; clients request accounts via email instead. */
export const mt5AutomationEnabled =
  process.env.MT5_AUTOMATION_ENABLED !== "false";

/** Shown in API errors and the client portal when automation is off. */
export const mt5SupportEmail = process.env.MT5_SUPPORT_EMAIL || "";

const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
if (mt5AutomationEnabled) {
  requiredEnv.push("MT5_SERVICE_BASE_URL");
}

requiredEnv.forEach((name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
});

export const nodeEnv = process.env.NODE_ENV || "development";
export const port = Number(process.env.PORT || 5000);
export const mongoUri = process.env.MONGO_URI;
export const jwtSecret = process.env.JWT_SECRET;
export const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1d";
/** Lifetime of an impersonation JWT once it has been exchanged. */
export const impersonationTokenExpiresIn =
  process.env.IMPERSONATION_TOKEN_EXPIRES_IN || "1h";
/** Lifetime of the one-time handoff code (seconds) before it self-destructs. */
export const impersonationCodeTtlSeconds = Number(
  process.env.IMPERSONATION_CODE_TTL_SECONDS || 120,
);

/**
 * Frontend origin(s) allowed by CORS. Accepts a single origin or a comma-
 * separated list (e.g. "https://app.example.com,https://staff.example.com").
 *
 * In production we refuse to start if the env var is missing, because the
 * previous default (`http://localhost:5173`) would silently reject every
 * request from a real deployment and clients would just see infinite
 * spinners. In development we default to the Vite port the front-end
 * actually runs on (`8080` per `.env.example`).
 */
if (nodeEnv === "production" && !process.env.CLIENT_ORIGIN) {
  throw new Error(
    "CLIENT_ORIGIN is required in production. Set it to the frontend origin(s), e.g. https://portal.example.com",
  );
}

const rawClientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:8080";
export const clientOrigin = rawClientOrigin;
export const clientOrigins = rawClientOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
/**
 * Canonical origin for building user-facing links (e.g. password-reset URLs).
 * `CLIENT_ORIGIN` may be a comma-separated CORS allow-list, so we take the
 * first entry — using the raw list string would produce a malformed URL like
 * `https://a.com,https://b.com/reset-password?token=...`.
 */
export const clientBaseUrl = clientOrigins[0] || rawClientOrigin;

/** Lifetime of a password reset link (minutes) before it self-destructs. */
export const passwordResetTokenTtlMinutes = Number(
  process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30,
);
/** Per-account/IP rate-limit window (minutes) for forgot-password requests. */
export const passwordResetRateWindowMinutes = Number(
  process.env.PASSWORD_RESET_RATE_WINDOW_MINUTES || 60,
);
/** Max forgot-password requests for the same identity in the window. */
export const passwordResetRateMax = Number(
  process.env.PASSWORD_RESET_RATE_MAX || 3,
);

/** Dummy base URL when automation is off so axios is never used with undefined. */
export const mt5ServiceBaseUrl = mt5AutomationEnabled
  ? process.env.MT5_SERVICE_BASE_URL
  : process.env.MT5_SERVICE_BASE_URL || "http://127.0.0.1:0";

export const mt5ServiceApiKey = process.env.MT5_SERVICE_API_KEY || "";
export const mt5Login = process.env.MT5_LOGIN || "";
export const mt5Password = process.env.MT5_PASSWORD || "";
export const mt5Server = process.env.MT5_SERVER || "";

/** Max KYC upload size (GridFS). Default 3 MiB to stay friendly to Atlas free tier. */
export const kycMaxFileBytes = Number(
  process.env.KYC_MAX_FILE_BYTES || 3 * 1024 * 1024,
);
