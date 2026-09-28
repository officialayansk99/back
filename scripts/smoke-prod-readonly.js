#!/usr/bin/env node
/**
 * Read-only smoke test against the production-shaped database referenced
 * by your local .env. Use this to verify that the app boots, connects to
 * Mongo, and that the new schemas (passwordChangedAt, mt5Login on
 * Transaction, etc.) coexist with existing documents.
 *
 * The script only READS. It never modifies, deletes, or writes data.
 *
 * Run via: node scripts/smoke-prod-readonly.js
 */
import "dotenv/config";
import mongoose from "mongoose";

import { mongoUri } from "../src/config/env.js";
import { User } from "../src/modules/users/model/user.model.js";
import { Transaction } from "../src/modules/transactions/model/transaction.model.js";
import { Mt5Account } from "../src/modules/mt5Accounts/model/mt5Account.model.js";

function ok(label) {
  process.stdout.write(`  ✓ ${label}\n`);
}
function info(label) {
  process.stdout.write(`  ℹ ${label}\n`);
}
function warn(label) {
  process.stdout.write(`  ⚠ ${label}\n`);
}

async function main() {
  process.stdout.write(`\n▶ Smoke test against ${mongoUri.split("@").pop()}\n`);

  await mongoose.connect(mongoUri);
  ok("connected to MongoDB");

  const totalUsers = await User.countDocuments({});
  info(`User documents: ${totalUsers}`);

  const sampleUser = await User.findOne({}).lean();
  if (sampleUser) {
    ok("read sample user");
    if (sampleUser.passwordChangedAt) {
      ok("sample user has passwordChangedAt populated");
    } else {
      warn(
        "sample user is missing passwordChangedAt — that is expected for legacy data and the schema default will populate it on next save",
      );
    }
  }

  const totalTxns = await Transaction.countDocuments({});
  info(`Transaction documents: ${totalTxns}`);
  const sampleTxn = await Transaction.findOne({}).lean();
  if (sampleTxn) {
    ok("read sample transaction");
    if (sampleTxn.mt5Login != null) {
      ok("sample transaction has mt5Login populated");
    } else {
      info(
        "sample transaction has no mt5Login — legacy records won't, new deposits will",
      );
    }
  }

  const totalAccounts = await Mt5Account.countDocuments({});
  info(`MT5 account documents: ${totalAccounts}`);

  await mongoose.disconnect();
  process.stdout.write("\n✅ Smoke test passed. No data modified.\n\n");
}

main().catch((err) => {
  process.stderr.write(`\n❌ Smoke test failed: ${err.message}\n`);
  process.exitCode = 1;
  return mongoose.disconnect().catch(() => {});
});
