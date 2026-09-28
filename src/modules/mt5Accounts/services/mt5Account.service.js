import { AppError } from "../../../common/errors/AppError.js";
import { Mt5AccountRepository } from "../repositories/mt5Account.repository.js";
import { UserRepository } from "../../users/repositories/user.repository.js";
import { Mt5Client } from "../../../integrations/mt5/mt5.client.js";
import { AuditLog } from "../../admin/models/auditLog.model.js";
import { Plan } from "../../admin/models/plan.model.js";
import { SmtpConfig } from "../../admin/models/smtp.model.js";
import { mailService } from "../../admin/services/mail.service.js";
import { logger } from "../../../common/utils/logger.js";
import { mt5AutomationEnabled, mt5SupportEmail } from "../../../config/env.js";

function manualProvisioningMessage(intro, supportAddr) {
  const hint = supportAddr
    ? `Email ${supportAddr} and our team will handle it.`
    : "Contact support and our team will handle it manually.";
  return `${intro} ${hint}`;
}

class Mt5AccountService {
  constructor() {
    this.mt5AccountRepository = new Mt5AccountRepository();
    this.userRepository = new UserRepository();
    this.mt5Client = new Mt5Client();
  }

  async listPlans() {
    return Plan.find({ active: true }).sort({ minDeposit: 1 });
  }

  /** Prefer MT5_SUPPORT_EMAIL; otherwise the mailbox configured under Admin → SMTP (username). */
  async resolveSupportEmail() {
    if (mt5SupportEmail?.trim()) return mt5SupportEmail.trim();
    const smtp = await SmtpConfig.findOne().select("username").lean();
    const u = smtp?.username?.trim();
    return u || null;
  }

  async getProvisioningInfo() {
    const supportEmail = await this.resolveSupportEmail();
    return {
      automationEnabled: mt5AutomationEnabled,
      supportEmail,
    };
  }

  async notifyManualMt5AccountRequest(user, payload, supportAddr) {
    const placeholders = {
      NAME: String(user.name || "Trader"),
      EMAIL: String(user.email || ""),
      TYPE: String(payload.type || ""),
      LEVERAGE: String(payload.leverage ?? ""),
      GROUP: String(payload.group || ""),
      SUPPORT_EMAIL: String(supportAddr || ""),
    };

    const clientOk = await mailService.sendTemplatedEmail(
      "MT5_ACCOUNT_PENDING",
      user.email,
      placeholders,
    );

    if (!clientOk) {
      throw new AppError(
        "Could not send confirmation email. Add an Emailer with type MT5_ACCOUNT_PENDING (placeholders: {NAME}, {EMAIL}, {TYPE}, {LEVERAGE}, {GROUP}, {SUPPORT_EMAIL}) and configure SMTP.",
        500,
        "EMAIL_SEND_FAILED",
      );
    }

    if (
      supportAddr &&
      supportAddr.toLowerCase() !== String(user.email).toLowerCase()
    ) {
      const staffOk = await mailService.sendTemplatedEmail(
        "MT5_ACCOUNT_REQUEST_STAFF",
        supportAddr,
        placeholders,
      );
      if (!staffOk) {
        logger.warn(
          "MT5_ACCOUNT_REQUEST_STAFF emailer missing or send failed; support was not notified. Create this type under Admin → Emailers.",
        );
      }
    }
  }

  async createByClient(userContext, payload) {
    const user = await this.userRepository.findById(userContext.id);
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    if (!mt5AutomationEnabled) {
      const supportAddr = await this.resolveSupportEmail();
      await this.notifyManualMt5AccountRequest(user, payload, supportAddr);

      await AuditLog.create({
        userType: "client",
        log: `Client submitted MT5 account request (manual provisioning)`,
        metadata: {
          userId: user._id,
          email: user.email,
          type: payload.type,
          leverage: payload.leverage,
          group: payload.group,
        },
      });

      return {
        pending: true,
        account: null,
        credentialsDelivery: {
          channel: "email-confirmation",
          sentAt: new Date(),
        },
      };
    }

    const mt5Result = await this.mt5Client.createAccount({
      userId: String(user._id),
      name: user.name,
      email: user.email,
      ...payload,
    });

    const account = await this.mt5AccountRepository.create({
      userId: user._id,
      login: mt5Result.data.login,
      type: payload.type,
      server: mt5Result.data.server,
      leverage: payload.leverage,
      group: payload.group,
      credentials: {
        investorPassword: mt5Result.data.investorPassword || null,
        sentAt: new Date(),
      },
    });

    await this.userRepository.appendMt5Account(user._id, {
      accountId: account._id,
      login: account.login,
      type: account.type,
    });

    await AuditLog.create({
      userType: "client",
      log: `Client created new MT5 account: ${account.login}`,
      metadata: { userId: user._id, login: account.login, type: account.type },
    });

    return {
      account,
      credentialsDelivery: {
        channel: "secure-inbox",
        sentAt: account.credentials.sentAt,
      },
    };
  }

  async getMine(userContext) {
    const accounts = await this.mt5AccountRepository.findByUserId(
      userContext.id,
    );

    if (!mt5AutomationEnabled) {
      return accounts.map((account) => ({
        login: account.login,
        type: account.type,
        server: account.server,
        leverage: account.leverage,
        group: account.group,
        createdAt: account.createdAt,
        balance: Number(account.balance ?? 0),
        equity: Number(account.equity ?? 0),
        margin: undefined,
        openTrades: undefined,
        tradeHistory: undefined,
      }));
    }

    // When the MT5 bridge is reachable we enrich each CRM record with live
    // balance/equity from MT5. Use Promise.allSettled so a single failing
    // account doesn't blank out the entire list — the client still sees
    // their accounts with the CRM-stored values as a fallback.
    const settled = await Promise.allSettled(
      accounts.map((account) => this.mt5Client.getAccount(account.login)),
    );

    return accounts.map((account, idx) => {
      const result = settled[idx];
      if (result.status === "fulfilled") {
        const remote = result.value?.data || {};
        return {
          login: account.login,
          type: account.type,
          server: account.server,
          leverage: account.leverage,
          group: account.group,
          createdAt: account.createdAt,
          balance: remote.balance,
          equity: remote.equity,
          margin: remote.margin,
          openTrades: remote.openTrades,
          tradeHistory: remote.tradeHistory,
          live: true,
        };
      }

      logger.warn(
        { login: account.login, err: result.reason?.message },
        "MT5 bridge fetch failed; falling back to CRM-stored balance",
      );
      return {
        login: account.login,
        type: account.type,
        server: account.server,
        leverage: account.leverage,
        group: account.group,
        createdAt: account.createdAt,
        balance: Number(account.balance ?? 0),
        equity: Number(account.equity ?? 0),
        margin: undefined,
        openTrades: undefined,
        tradeHistory: undefined,
        live: false,
      };
    });
  }

  async resetPasswordByAdmin(login, newPassword) {
    if (!mt5AutomationEnabled) {
      const supportAddr = await this.resolveSupportEmail();
      throw new AppError(
        manualProvisioningMessage(
          "MetaTrader password resets are processed manually.",
          supportAddr,
        ),
        503,
        "MT5_MANUAL_PROVISIONING",
      );
    }

    const account = await this.mt5AccountRepository.findByLogin(login);
    if (!account) {
      throw new AppError("MT5 account not found", 404, "MT5_ACCOUNT_NOT_FOUND");
    }

    await this.mt5Client.resetPassword({ login, newPassword });
    return { login, reset: true };
  }

  async resetPasswordByClient(userContext, login, newPassword) {
    if (!mt5AutomationEnabled) {
      const supportAddr = await this.resolveSupportEmail();
      throw new AppError(
        manualProvisioningMessage(
          "MetaTrader password resets are processed manually.",
          supportAddr,
        ),
        503,
        "MT5_MANUAL_PROVISIONING",
      );
    }

    const account = await this.mt5AccountRepository.findByLogin(login);
    if (!account || String(account.userId) !== String(userContext.id)) {
      throw new AppError(
        "MT5 account not found or access denied",
        404,
        "MT5_ACCOUNT_NOT_FOUND",
      );
    }

    await this.mt5Client.resetPassword({ login, newPassword });

    await AuditLog.create({
      userType: "client",
      log: `Client reset password for MT5 account: ${login}`,
      metadata: { userId: userContext.id, login },
    });

    return { login, reset: true };
  }
}

export { Mt5AccountService };
