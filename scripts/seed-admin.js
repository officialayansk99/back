/**
 * Creates (or updates) the superadmin account used to sign in to the admin panel.
 *
 * The `superadmin` role is what `roleGuard("superadmin")` checks on every
 * /admin route — "admin" is not a valid role (see user.model.js role enum).
 *
 * Run from `equiti-capitals-back`:
 *   npm run seed:admin                                  — uses the defaults below
 *   npm run seed:admin -- --email=x@y.com --password=Xx  — override either field
 *   npm run seed:admin -- --force-password               — reset the password if the user exists
 *
 * By default an existing user's password is left alone; pass --force-password
 * to rotate it. Rotating bumps passwordChangedAt, which invalidates every
 * currently-issued token for that account (the `pwdv` claim, see auth.middleware.js).
 *
 * Requires MONGO_URI in .env
 */
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { User } from "../src/modules/users/model/user.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("Missing MONGO_URI in .env");
  process.exit(1);
}

function argValue(flag, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return hit ? hit.slice(flag.length + 3) : fallback;
}

const email = argValue("email", "admin@equiticapitals.com").toLowerCase().trim();
const password = argValue("password", "Admin@123");
const name = argValue("name", "Equiti Admin");
const forcePassword = process.argv.includes("--force-password");

// Cost 12 matches auth.service.js, which is what login's bcrypt.compare expects.
const BCRYPT_ROUNDS = 12;

async function run() {
  await mongoose.connect(mongoUri);
  console.log(`Connected to ${mongoose.connection.name}`);

  const existing = await User.findOne({ email });

  if (existing) {
    const changes = [];

    if (existing.role !== "superadmin") {
      existing.role = "superadmin";
      changes.push("role -> superadmin");
    }
    if (existing.status !== "approved") {
      existing.status = "approved";
      changes.push("status -> approved");
    }
    if (existing.kycStatus !== "approved") {
      existing.kycStatus = "approved";
      changes.push("kycStatus -> approved");
    }
    if (!existing.isEmailVerified) {
      existing.isEmailVerified = true;
      changes.push("isEmailVerified -> true");
    }
    if (forcePassword) {
      existing.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
      existing.passwordChangedAt = new Date();
      changes.push("password reset (existing sessions invalidated)");
    }

    if (changes.length === 0) {
      console.log(`\nAdmin already up to date: ${email}\n`);
    } else {
      await existing.save();
      console.log(`\nUpdated existing user: ${email}`);
      changes.forEach((c) => console.log(`  - ${c}`));
      if (!forcePassword) {
        console.log(
          "  - password left unchanged (pass --force-password to reset it)",
        );
      }
      console.log("");
    }
  } else {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await User.create({
      name,
      email,
      password: hash,
      passwordChangedAt: new Date(),
      role: "superadmin",
      status: "approved",
      kycStatus: "approved",
      isEmailVerified: true,
      otp: null,
      otpExpiresAt: null,
    });
    console.log(`\nCreated superadmin: ${email}`);
    console.log(`Password: ${password}`);
    console.log("Change this password after your first sign-in.\n");
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // already disconnected
  }
  process.exit(1);
});
