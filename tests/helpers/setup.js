/**
 * Integration test harness.
 *
 * Boots an isolated in-memory MongoDB, sets the env vars the app expects,
 * imports the real Express app, and exposes a supertest agent. The harness
 * is deliberately self-contained so the production .env file is never read
 * (we set every required variable here) and your Atlas database is never
 * touched by tests.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

let memoryServer;
let appModule;
let supertest;

export async function bootTestApp() {
  // Required env vars must be set BEFORE we import any app code, because
  // src/config/env.js reads process.env at module-load time.
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = "memory://"; // overwritten with the real URI below
  process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.IMPERSONATION_TOKEN_EXPIRES_IN = "10m";
  process.env.IMPERSONATION_CODE_TTL_SECONDS = "60";
  process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES = "30";
  process.env.PASSWORD_RESET_RATE_WINDOW_MINUTES = "60";
  process.env.PASSWORD_RESET_RATE_MAX = "3";
  process.env.CLIENT_ORIGIN = "http://localhost:8080";
  process.env.MT5_AUTOMATION_ENABLED = "false";

  memoryServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = memoryServer.getUri();

  // Connect mongoose ourselves so the model registrations on import
  // attach to the in-memory instance.
  mongoose.set("strictQuery", true);
  await mongoose.connect(process.env.MONGO_URI);

  // Lazy-import after env is in place.
  ({ default: supertest } = await import("supertest"));
  appModule = await import("../../src/app.js");

  return supertest(appModule.app);
}

export async function shutdownTestApp() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

/** Wipes every collection so tests start from a clean slate. */
export async function resetDb() {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((coll) => coll.deleteMany({})),
  );
}

/** Inserts a freshly-hashed user. */
export async function createUser({
  name,
  email,
  password,
  role = "client",
  kycStatus = "pending",
  bankDetails,
}) {
  const { User } = await import("../../src/modules/users/model/user.model.js");
  const hash = await bcrypt.hash(password, 4);
  const doc = await User.create({
    name,
    email: email.toLowerCase(),
    password: hash,
    role,
    kycStatus,
    isEmailVerified: true,
    passwordChangedAt: new Date(),
    ...(bankDetails ? { bankDetails } : {}),
  });
  return doc;
}

/**
 * Seeds a usable SMTP record and a FORGOT_PASSWORD emailer template so the
 * forgot-password flow doesn't short-circuit during tests. We never actually
 * connect to a real SMTP server — the emailer code returns false on send
 * failure and the controller still returns the generic success message.
 */
export async function seedSmtpAndEmailer() {
  const { SmtpConfig } =
    await import("../../src/modules/admin/models/smtp.model.js");
  const { EmailerConfig } =
    await import("../../src/modules/admin/models/emailer.model.js");
  await SmtpConfig.create({
    server: "smtp.example.invalid",
    port: 587,
    ssl: false,
    username: "noreply@example.invalid",
    password: "dummy",
    timeoutMs: 1000,
  });
  await EmailerConfig.create({
    emailerType: "FORGOT_PASSWORD",
    mailSubject: "Reset your password — {NAME}",
    mailBody:
      '<p>Hello {NAME}</p><p><a href="{RESET_URL}">Reset</a></p><p>{EXPIRES_IN_MINUTES} min</p>',
  });
}
