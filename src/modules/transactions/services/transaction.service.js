import { AppError } from "../../../common/errors/AppError.js";
import mongoose from "mongoose";
import { UserRepository } from "../../users/repositories/user.repository.js";
import { TransactionRepository } from "../repositories/transaction.repository.js";
import { Transaction } from "../model/transaction.model.js";
import { Mt5Account } from "../../mt5Accounts/model/mt5Account.model.js";
import { AuditLog } from "../../admin/models/auditLog.model.js";
import * as depositProofGridfs from "./depositProofGridfs.service.js";

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

class TransactionService {
  constructor() {
    this.userRepository = new UserRepository();
    this.transactionRepository = new TransactionRepository();
  }

  async createManual(adminUser, payload) {
    const targetUser = await this.userRepository.findById(payload.userId);
    if (!targetUser || targetUser.role !== "client") {
      throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
    }

    return this.transactionRepository.create({
      userId: targetUser._id,
      type: payload.type,
      amount: roundMoney(payload.amount),
      status: "completed",
      note: payload.note || "",
      performedBy: adminUser.id,
    });
  }

  async listMine(user, query) {
    return this.transactionRepository.findByUserIdPaged(user.id, query);
  }

  /**
   * Sum of CRM balances across all of a client's MT5 accounts, minus the
   * value of any pending withdrawals. This is the same number the dashboard
   * shows as "Available Balance" and is what we charge against on a new
   * withdrawal request.
   */
  async getAvailableBalance(userId) {
    const [accounts, pendingAgg] = await Promise.all([
      Mt5Account.find({ userId }).select("balance").lean(),
      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(String(userId)),
            type: "withdraw",
            status: "pending",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const total = accounts.reduce(
      (sum, acc) => sum + roundMoney(acc.balance || 0),
      0,
    );
    const pending = roundMoney(pendingAgg[0]?.total || 0);
    return roundMoney(Math.max(0, total - pending));
  }

  async requestDeposit(userContext, payload, file) {
    if (!file) {
      throw new AppError(
        "Payment proof is required",
        400,
        "DEPOSIT_PROOF_REQUIRED",
      );
    }

    const account = await Mt5Account.findOne({
      userId: userContext.id,
      login: payload.mt5Login,
    });
    if (!account) {
      throw new AppError(
        "Selected MT5 account not found for this user",
        400,
        "MT5_ACCOUNT_NOT_FOUND",
      );
    }

    const amount = roundMoney(payload.amount);

    // Create the transaction first so we have an id to reference from the file
    const tx = await this.transactionRepository.create({
      userId: userContext.id,
      type: "deposit",
      amount,
      status: "pending",
      method: payload.method || "bank_transfer",
      mt5Login: account.login,
      note: payload.note || "",
    });

    // Upload the file with the transaction id stamped in metadata; if the
    // upload fails we delete the orphan transaction so the client can retry.
    let fileId;
    try {
      fileId = await depositProofGridfs.uploadFromBuffer(file.buffer, {
        filename: file.originalname || `deposit-proof-${Date.now()}`,
        contentType: file.mimetype,
        userId: userContext.id,
        transactionId: tx._id,
      });
    } catch (err) {
      await Transaction.deleteOne({ _id: tx._id });
      throw err;
    }

    tx.proofFileId = fileId;
    await tx.save();

    await AuditLog.create({
      userId: userContext.id,
      userEmail: userContext.email,
      userType: "client",
      log: `Client requested a deposit of $${amount.toFixed(2)} for MT5 ${account.login}`,
      metadata: {
        transactionId: tx._id,
        amount,
        mt5Login: account.login,
      },
    });

    return tx;
  }

  async requestWithdrawal(userContext, payload) {
    const user = await this.userRepository.findById(userContext.id);
    if (!user.bankDetails || !user.bankDetails.accountNumber) {
      throw new AppError(
        "Please update your bank details before withdrawing",
        400,
        "BANK_DETAILS_REQUIRED",
      );
    }

    const amount = roundMoney(payload.amount);

    // Server-side balance check. Without this a client could submit any
    // amount and only learn it was rejected when an admin reviews it.
    const available = await this.getAvailableBalance(userContext.id);
    if (amount > available + 1e-6) {
      throw new AppError(
        `Requested $${amount.toFixed(2)} exceeds your available balance of $${available.toFixed(2)}.`,
        400,
        "INSUFFICIENT_BALANCE",
      );
    }

    const tx = await this.transactionRepository.create({
      userId: userContext.id,
      type: "withdraw",
      amount,
      status: "pending",
      method: "bank_transfer",
      note: payload.note || "",
    });

    await AuditLog.create({
      userId: userContext.id,
      userEmail: userContext.email,
      userType: "client",
      log: `Client requested a withdrawal of $${amount.toFixed(2)}`,
      metadata: {
        transactionId: tx._id,
        amount,
        availableAtRequest: available,
      },
    });

    return tx;
  }

  /**
   * Stream the GridFS-backed payment proof for the calling client. We reject
   * the request unless the transaction belongs to the user, so this endpoint
   * doubles as the access-control gate for proofs (no IDOR risk).
   */
  async streamMyProof(userContext, transactionId, res) {
    const tx = await this.transactionRepository.findById(transactionId);
    if (!tx || String(tx.userId) !== String(userContext.id)) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
    if (!tx.proofFileId) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
    const ok = await depositProofGridfs.pipeFileToResponse(tx.proofFileId, res);
    if (!ok) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
  }

  async streamProofForAdmin(transactionId, res) {
    const tx = await this.transactionRepository.findById(transactionId);
    if (!tx || !tx.proofFileId) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
    const ok = await depositProofGridfs.pipeFileToResponse(tx.proofFileId, res);
    if (!ok) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
  }
}

export { TransactionService };
