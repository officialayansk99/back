import { AppError } from "../../../common/errors/AppError.js";
import { UserRepository } from "../../users/repositories/user.repository.js";
import { User } from "../../users/model/user.model.js";
import { Mt5Account } from "../../mt5Accounts/model/mt5Account.model.js";
import { Transaction } from "../../transactions/model/transaction.model.js";
import { Plan } from "../models/plan.model.js";
import { EmailerConfig } from "../models/emailer.model.js";
import { SmtpConfig } from "../models/smtp.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import bcrypt from "bcryptjs";
import { mailService } from "./mail.service.js";
import { logger } from "../../../common/utils/logger.js";
import * as kycGridfsService from "../../users/services/kycGridfs.service.js";
import * as depositSettingsService from "./depositSettings.service.js";

class AdminService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  async listClients(query) {
    return this.userRepository.findAllClients(query);
  }

  async updateUser(userId, payload) {
    const updated = await this.userRepository.updateById(userId, payload);
    if (!updated) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    // Email trigger for KYC update
    if (payload.kycStatus) {
      mailService.sendTemplatedEmail(
        `KYC_${payload.kycStatus.toUpperCase()}`,
        updated.email,
        {
          NAME: updated.name,
          STATUS: payload.kycStatus,
        },
      );
    }

    // Audit Log
    this.createAuditLog({
      userType: "admin",
      log: `Admin updated user profile for ${updated.email}`,
      metadata: payload,
    });

    return updated;
  }

  async changeUserPassword(userId, newPassword) {
    const hash = await bcrypt.hash(newPassword, 12);
    const updated = await this.userRepository.updateById(userId, {
      password: hash,
      passwordChangedAt: new Date(),
    });
    if (!updated) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    this.createAuditLog({
      userType: "admin",
      log: `Admin changed password for user ${updated.email}`,
      metadata: { userId },
    });

    return { success: true };
  }

  async deleteUser(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    await kycGridfsService.deleteFileIds([
      user.idProofFileId,
      user.addressProofFileId,
    ]);

    await this.userRepository.deleteById(userId);

    this.createAuditLog({
      userType: "admin",
      log: `Admin deleted user account ${user.email}`,
      metadata: { userId },
    });

    return { id: userId, deleted: true };
  }

  async getSystemAnalytics() {
    const [
      totalClients,
      approvedKyc,
      totalMt5Accounts,
      totalDeposits,
      totalWithdrawals,
    ] = await Promise.all([
      User.countDocuments({ role: "client" }),
      User.countDocuments({ role: "client", kycStatus: "approved" }),
      Mt5Account.countDocuments(),
      Transaction.aggregate([
        { $match: { type: "deposit", status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { type: "withdraw", status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    return {
      totalClients,
      approvedKyc,
      totalMt5Accounts,
      totalDeposits: totalDeposits[0]?.total || 0,
      totalWithdrawals: totalWithdrawals[0]?.total || 0,
    };
  }

  async getDashboardCharts() {
    // Registrations over time (last 6 months)
    const registrations = await User.aggregate([
      {
        $match: { role: "client" },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 6 },
    ]);

    // Format for charts: { label: 'MM-YYYY', value: N }
    const chartData = registrations.map((item) => ({
      label: `${item._id.month}-${item._id.year}`,
      value: item.count,
    }));

    // For Last 15 Commissions, we simulate some data for now as commission logic is complex
    const commissions = Array.from({ length: 15 }, (_, i) => ({
      period: `Day ${i + 1}`,
      traders: Math.floor(Math.random() * 10) + 1,
      commission: Math.floor(Math.random() * 500) + 100,
    }));

    return {
      registrations: chartData,
      commissions,
    };
  }

  async listAuditLogs(query) {
    const page = parseInt(query.page || 1, 10);
    const limit = parseInt(query.limit || 10, 10);
    const search = query.search || "";
    const skip = (page - 1) * limit;

    const filter = search
      ? {
          $or: [
            { log: { $regex: search, $options: "i" } },
            { userType: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return { items, total };
  }

  async createAuditLog(payload) {
    return AuditLog.create(payload);
  }

  // Plans Management
  async createPlan(payload) {
    const plan = await Plan.create(payload);
    this.createAuditLog({
      userType: "admin",
      log: `Admin created new plan: ${plan.planName}`,
      metadata: payload,
    });
    return plan;
  }

  async updatePlan(planId, payload) {
    const updated = await Plan.findByIdAndUpdate(planId, payload, {
      new: true,
    });
    if (!updated) throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");
    return updated;
  }

  async deletePlan(planId) {
    const deleted = await Plan.findByIdAndDelete(planId);
    if (!deleted) throw new AppError("Plan not found", 404, "PLAN_NOT_FOUND");
    return { id: planId, deleted: true };
  }

  async listPlans(query) {
    const page = parseInt(query.page || 1, 10);
    const limit = parseInt(query.limit || 10, 10);
    const search = query.search || "";
    const skip = (page - 1) * limit;

    const filter = search
      ? {
          $or: [
            { planName: { $regex: search, $options: "i" } },
            { groupName: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    let [items, total] = await Promise.all([
      Plan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Plan.countDocuments(filter),
    ]);

    // Auto-seed default plans if empty and no search is active
    if (total === 0 && !search && page === 1) {
      const defaultPlans = [
        {
          planName: "Equiti Standard",
          groupName: "Real\\Brand_Standard",
          leverage: "1:100",
          minDeposit: 100,
          active: true,
        },
        {
          planName: "Equiti ECN",
          groupName: "Real\\Brand_ECN",
          leverage: "1:100",
          minDeposit: 500,
          active: true,
        },
        {
          planName: "Equiti Pro",
          groupName: "Real\\Brand_Pro",
          leverage: "1:100",
          minDeposit: 1000,
          active: true,
        },
      ];
      await Plan.insertMany(defaultPlans);
      items = await Plan.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      total = defaultPlans.length;
    }

    return { items, total };
  }

  // SMTP Configuration
  async upsertSmtp(payload) {
    let smtp = await SmtpConfig.findOne();
    if (smtp) {
      Object.assign(smtp, payload);
      await smtp.save();
    } else {
      smtp = await SmtpConfig.create(payload);
    }
    return smtp;
  }

  async getSmtp() {
    return SmtpConfig.findOne();
  }

  // Emailer Configuration
  async createEmailer(payload) {
    return EmailerConfig.create(payload);
  }

  async updateEmailer(emailerId, payload) {
    const updated = await EmailerConfig.findByIdAndUpdate(emailerId, payload, {
      new: true,
    });
    if (!updated)
      throw new AppError("Emailer not found", 404, "EMAILER_NOT_FOUND");
    return updated;
  }

  async deleteEmailer(emailerId) {
    const deleted = await EmailerConfig.findByIdAndDelete(emailerId);
    if (!deleted)
      throw new AppError("Emailer not found", 404, "EMAILER_NOT_FOUND");
    return { id: emailerId, deleted: true };
  }

  async listEmailers(query) {
    const page = parseInt(query.page || 1, 10);
    const limit = parseInt(query.limit || 10, 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      EmailerConfig.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      EmailerConfig.countDocuments(),
    ]);

    return { items, total };
  }

  // Representatives Management
  async createRepresentative(payload) {
    const existing = await this.userRepository.findByEmail(payload.email);
    if (existing) {
      throw new AppError("Email already in use", 409, "EMAIL_CONFLICT");
    }

    const hash = await bcrypt.hash(payload.password, 12);
    const user = await this.userRepository.create({
      name: payload.name,
      email: payload.email,
      password: hash,
      passwordChangedAt: new Date(),
      role: "representative",
      kycStatus: "approved",
      ...payload, // Include status if passed
    });

    this.createAuditLog({
      userType: "admin",
      log: `Admin created new representative: ${user.email}`,
      metadata: { name: user.name, email: user.email },
    });

    return user;
  }

  async listRepresentatives(query) {
    const page = parseInt(query.page || 1, 10);
    const limit = parseInt(query.limit || 10, 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      User.find({ role: { $ne: "client" } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-password"),
      User.countDocuments({ role: { $ne: "client" } }),
    ]);

    return { items, total };
  }

  // Accounts Management
  async listMt5Accounts(query) {
    const page = parseInt(query.page || 1, 10);
    const limit = parseInt(query.limit || 10, 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Mt5Account.find()
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Mt5Account.countDocuments(),
    ]);

    return { items, total };
  }

  async createManualMt5Account(body) {
    const {
      userId,
      login,
      type,
      server,
      leverage,
      group,
      masterPassword,
      investorPassword,
      sendCredentialsEmail = true,
    } = body;

    const user = await User.findById(userId).select("name email role");
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    if (user.role !== "client") {
      throw new AppError(
        "MT5 accounts can only be linked to trader (client) accounts",
        400,
        "INVALID_USER_ROLE",
      );
    }

    const dup = await Mt5Account.findOne({ login });
    if (dup) {
      throw new AppError(
        "This MT5 login is already registered in the CRM",
        409,
        "MT5_LOGIN_EXISTS",
      );
    }

    let emailed = false;
    if (sendCredentialsEmail === true) {
      await this.sendMt5CredentialsEmail(user, {
        login,
        server: server.trim(),
        masterPassword,
        investorPassword: investorPassword?.trim() || "",
      });
      emailed = true;
    }

    const account = await Mt5Account.create({
      userId,
      login,
      type,
      server: server.trim(),
      leverage: Number(leverage),
      group: group.trim(),
      credentials: {
        investorPassword: investorPassword?.trim() || null,
        sentAt: new Date(),
      },
    });

    await this.userRepository.appendMt5Account(userId, {
      accountId: account._id,
      login: account.login,
      type: account.type,
    });

    await this.createAuditLog({
      userType: "admin",
      log: `Admin linked MT5 login ${login} to ${user.email}`,
      metadata: { userId, login, type, group },
    });

    const populated = await Mt5Account.findById(account._id).populate(
      "userId",
      "name email",
    );

    return { account: populated, emailed };
  }

  async updateMt5Account(mt5AccountId, body) {
    const account = await Mt5Account.findById(mt5AccountId);
    if (!account) {
      throw new AppError("MT5 account not found", 404, "MT5_NOT_FOUND");
    }

    const { server, leverage, group, type, balance, equity, creditBalance } =
      body;

    if (creditBalance != null && Number(creditBalance) !== 0) {
      const delta = Number(creditBalance);
      const b = Number(account.balance || 0) + delta;
      const e = Number(account.equity || 0) + delta;
      account.balance = Math.max(0, b);
      account.equity = Math.max(0, e);
    }
    if (balance != null) account.balance = balance;
    if (equity != null) account.equity = equity;
    if (server != null) account.server = server.trim();
    if (leverage != null) account.leverage = leverage;
    if (group != null) account.group = group.trim();
    if (type != null) account.type = type;

    await account.save();

    if (type != null) {
      await User.updateOne(
        { _id: account.userId, "mt5Accounts.accountId": account._id },
        { $set: { "mt5Accounts.$.type": account.type } },
      );
    }

    await this.createAuditLog({
      userType: "admin",
      log: `Admin updated MT5 account login ${account.login}`,
      metadata: { mt5AccountId, ...body },
    });

    return Mt5Account.findById(account._id).populate("userId", "name email");
  }

  async deleteMt5Account(mt5AccountId) {
    const account = await Mt5Account.findById(mt5AccountId);
    if (!account) {
      throw new AppError("MT5 account not found", 404, "MT5_NOT_FOUND");
    }

    await this.userRepository.removeMt5AccountRef(account.userId, account._id);
    await Mt5Account.findByIdAndDelete(mt5AccountId);

    await this.createAuditLog({
      userType: "admin",
      log: `Admin deleted MT5 account login ${account.login}`,
      metadata: { mt5AccountId, login: account.login },
    });

    return { deleted: true };
  }

  async sendMt5CredentialsEmail(
    user,
    { login, server, masterPassword, investorPassword },
  ) {
    const placeholders = {
      NAME: String(user.name || ""),
      EMAIL: String(user.email || ""),
      LOGIN: String(login),
      PASSWORD: String(masterPassword),
      INVESTOR_PASSWORD: String(investorPassword || ""),
      SERVER: String(server || ""),
    };

    const clientOk = await mailService.sendTemplatedEmail(
      "MT5_CREDENTIALS_DELIVERED",
      user.email,
      placeholders,
    );

    if (!clientOk) {
      throw new AppError(
        "Account was saved but email could not be sent. Add an Emailer with type MT5_CREDENTIALS_DELIVERED (placeholders: {NAME}, {EMAIL}, {LOGIN}, {PASSWORD}, {INVESTOR_PASSWORD}, {SERVER}) and configure SMTP.",
        500,
        "EMAIL_SEND_FAILED",
      );
    }
  }

  // Fund Management
  async listTransactions(query) {
    const page = parseInt(query.page || 1, 10);
    const limit = parseInt(query.limit || 10, 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Transaction.find()
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(),
    ]);

    return { items, total };
  }

  async sendTransactionStatusEmail(user, tx) {
    const amt = Number(tx.amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const placeholders = {
      NAME: String(user.name || ""),
      EMAIL: String(user.email || ""),
      AMOUNT: amt,
      TYPE: String(tx.type),
      STATUS: String(tx.status),
    };

    const emailerType =
      tx.type === "deposit" ? "DEPOSIT_UPDATE" : "WITHDRAW_UPDATE";

    const sent = await mailService.sendTemplatedEmail(
      emailerType,
      user.email,
      placeholders,
    );

    if (!sent) {
      logger.warn(
        `Transaction status email not sent for ${tx._id} (${user.email}). Create Emailer type: ${emailerType}. Placeholders: {NAME}, {EMAIL}, {AMOUNT}, {TYPE}, {STATUS}.`,
      );
    }
    return sent;
  }

  roundMoney(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  /**
   * Spreads a completed withdrawal across the client's MT5 CRM records using
   * atomic per-account `findOneAndUpdate` with a `$gte` guard, so two
   * concurrent admin actions can never double-deduct from the same balance.
   * Any partial deductions are rolled back if we fail to allocate the full
   * amount, leaving the data in the same shape we found it.
   */
  async deductWithdrawalFromMt5Accounts(userId, amount) {
    const withdrawAmt = this.roundMoney(amount);
    if (withdrawAmt <= 0) return;

    const accounts = await Mt5Account.find({ userId })
      .sort({ createdAt: 1 })
      .select("_id balance");

    const totalAvailable = accounts.reduce(
      (s, a) => s + this.roundMoney(a.balance || 0),
      0,
    );

    if (totalAvailable + 1e-6 < withdrawAmt) {
      throw new AppError(
        `Client CRM balance ($${totalAvailable.toFixed(2)}) is less than the withdrawal ($${withdrawAmt.toFixed(2)}). Adjust MT5 account balances in admin or reject the request.`,
        400,
        "INSUFFICIENT_CRM_BALANCE",
      );
    }

    /** Track applied deductions so we can roll them back on partial failure. */
    const applied = [];
    let remaining = withdrawAmt;

    try {
      for (const acc of accounts) {
        if (remaining <= 0.001) break;
        const bal = this.roundMoney(acc.balance || 0);
        if (bal <= 0) continue;
        const take = this.roundMoney(Math.min(bal, remaining));
        if (take <= 0) continue;

        // Atomic claim on this account: only deducts when the balance is
        // still at least `take`, preventing double-spend across requests.
        const updated = await Mt5Account.findOneAndUpdate(
          { _id: acc._id, balance: { $gte: take } },
          {
            $inc: { balance: -take, equity: -take },
          },
          { new: true },
        );

        if (!updated) {
          // Another writer beat us; skip this account and let the loop try
          // others. The next iteration will still see `remaining` un-changed.
          continue;
        }

        // Equity floor at 0 to keep historical view consistent.
        if (updated.equity < 0) {
          await Mt5Account.updateOne(
            { _id: updated._id },
            { $set: { equity: 0 } },
          );
        }

        applied.push({ id: acc._id, take });
        remaining = this.roundMoney(remaining - take);
      }

      if (remaining > 0.01) {
        throw new AppError(
          "Could not allocate withdrawal across CRM accounts. Please retry.",
          409,
          "WITHDRAWAL_DEDUCTION_RACE",
        );
      }
    } catch (err) {
      // Roll back any partial deductions so we don't leave a half-applied
      // withdrawal in the database.
      await Promise.all(
        applied.map(({ id, take }) =>
          Mt5Account.updateOne(
            { _id: id },
            { $inc: { balance: take, equity: take } },
          ),
        ),
      );
      throw err;
    }
  }

  async updateTransactionStatus(transactionId, status) {
    // Atomically claim the transaction in one step. If another admin (or a
    // retry from a flaky network) already moved it out of `pending`, the
    // update returns null and we surface a clean conflict error.
    const tx = await Transaction.findOneAndUpdate(
      { _id: transactionId, status: "pending" },
      { $set: { status } },
      { new: true },
    );

    if (!tx) {
      const exists = await Transaction.exists({ _id: transactionId });
      if (!exists) {
        throw new AppError(
          "Transaction not found",
          404,
          "TRANSACTION_NOT_FOUND",
        );
      }
      throw new AppError(
        "Transaction already processed",
        409,
        "TRANSACTION_ALREADY_PROCESSED",
      );
    }

    if (status === "completed" && tx.type === "withdraw") {
      try {
        await this.deductWithdrawalFromMt5Accounts(tx.userId, tx.amount);
      } catch (err) {
        // Roll back the status claim so the admin can retry.
        await Transaction.updateOne(
          { _id: tx._id },
          { $set: { status: "pending" } },
        );
        throw err;
      }
    }

    const user = await User.findById(tx.userId);
    if (user) {
      await this.sendTransactionStatusEmail(user, tx);
    }

    await this.createAuditLog({
      userType: "admin",
      log:
        status === "completed" && tx.type === "withdraw"
          ? `Admin completed withdraw $${Number(tx.amount).toFixed(2)} for ${user?.email || "Unknown User"} (CRM balances updated)`
          : `Admin ${status} ${tx.type} transaction for ${user?.email || "Unknown User"}`,
      metadata: { transactionId, status, amount: tx.amount, type: tx.type },
    });

    return tx;
  }

  async getDepositSettings() {
    return depositSettingsService.getDepositSettingsForApi();
  }

  async patchDepositSettings(payload, adminUser) {
    const data = await depositSettingsService.patchDepositSettings(payload);
    await this.createAuditLog({
      userType: "admin",
      log: `Deposit bank / QR instructions updated by ${adminUser?.email || "admin"}`,
      metadata: {
        updatedKeys: Object.keys(payload).filter(
          (k) => payload[k] !== undefined,
        ),
      },
    });
    return data;
  }

  async replaceDepositQrFromUpload(file, adminUser) {
    const data = await depositSettingsService.replaceQrCodeFile(file.buffer, {
      filename: file.originalname || `deposit-qr-${Date.now()}.png`,
      contentType: file.mimetype,
    });
    await this.createAuditLog({
      userType: "admin",
      log: `Deposit QR image uploaded (GridFS) by ${adminUser?.email || "admin"}`,
      metadata: {},
    });
    return data;
  }

  async clearDepositQr(adminUser) {
    const data = await depositSettingsService.clearQrCodeFile();
    await this.createAuditLog({
      userType: "admin",
      log: `Deposit QR image removed by ${adminUser?.email || "admin"}`,
      metadata: {},
    });
    return data;
  }
}

export { AdminService };
