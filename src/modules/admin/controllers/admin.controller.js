import { apiResponse } from "../../../common/utils/apiResponse.js";
import { AppError } from "../../../common/errors/AppError.js";
import { AdminService } from "../services/admin.service.js";
import { AuthService } from "../../auth/services/auth.service.js";
import * as kycGridfsService from "../../users/services/kycGridfs.service.js";
import {
  toClientDto,
  toClientsListDto,
  toPlanDto,
  toPlansListDto,
  toEmailerDto,
  toEmailersListDto,
  toRepresentativesListDto,
  toMt5AccountsListDto,
  toMt5AccountDto,
  toTransactionDto,
  toTransactionsListDto,
  toDeleteUserDto,
} from "../dto/manageUser.dto.js";
import { User } from "../../users/model/user.model.js";
import { Mt5Account } from "../../mt5Accounts/model/mt5Account.model.js";
import { Transaction } from "../../transactions/model/transaction.model.js";

const adminService = new AdminService();
const authService = new AuthService();

const adminController = {
  listClients: async (req, res) => {
    const result = await adminService.listClients(req.validated.query);
    return res.status(200).json(
      apiResponse({
        message: "Clients fetched successfully",
        data: toClientsListDto(result.items),
        meta: {
          total: result.total,
          page: Number(req.validated.query.page),
          limit: Number(req.validated.query.limit),
        },
      }),
    );
  },

  updateUser: async (req, res) => {
    const result = await adminService.updateUser(
      req.validated.params.userId,
      req.validated.body,
    );
    return res.status(200).json(
      apiResponse({
        message: "User updated successfully",
        data: toClientDto(result),
      }),
    );
  },

  changeUserPassword: async (req, res) => {
    await adminService.changeUserPassword(
      req.validated.params.userId,
      req.validated.body.password,
    );
    return res.status(200).json(
      apiResponse({
        message: "User password updated successfully",
      }),
    );
  },

  deleteUser: async (req, res) => {
    const result = await adminService.deleteUser(req.validated.params.userId);
    return res.status(200).json(
      apiResponse({
        message: "User deleted successfully",
        data: toDeleteUserDto(result),
      }),
    );
  },

  streamUserKycIdProof: async (req, res) => {
    const user = await User.findById(req.validated.params.userId).select(
      "idProofFileId role",
    );
    if (!user || user.role !== "client") {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    if (!user.idProofFileId) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
    const ok = await kycGridfsService.pipeFileToResponse(
      user.idProofFileId,
      res,
    );
    if (!ok) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
  },

  streamUserKycAddressProof: async (req, res) => {
    const user = await User.findById(req.validated.params.userId).select(
      "addressProofFileId role",
    );
    if (!user || user.role !== "client") {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    if (!user.addressProofFileId) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
    const ok = await kycGridfsService.pipeFileToResponse(
      user.addressProofFileId,
      res,
    );
    if (!ok) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
  },

  analytics: async (req, res) => {
    const result = await adminService.getSystemAnalytics();
    return res.status(200).json(
      apiResponse({
        message: "Analytics fetched successfully",
        data: result,
      }),
    );
  },

  dashboardCharts: async (req, res) => {
    const result = await adminService.getDashboardCharts();
    return res.status(200).json(
      apiResponse({
        message: "Dashboard charts fetched successfully",
        data: result,
      }),
    );
  },

  listAuditLogs: async (req, res) => {
    const result = await adminService.listAuditLogs(req.query);
    return res.status(200).json(
      apiResponse({
        message: "Audit logs fetched successfully",
        data: result.items,
        meta: {
          total: result.total,
          page: Number(req.query.page || 1),
          limit: Number(req.query.limit || 10),
        },
      }),
    );
  },

  // Plans
  createPlan: async (req, res) => {
    const result = await adminService.createPlan(req.validated.body);
    return res.status(201).json(
      apiResponse({
        message: "Plan created successfully",
        data: toPlanDto(result),
      }),
    );
  },

  updatePlan: async (req, res) => {
    const result = await adminService.updatePlan(
      req.params.planId,
      req.validated.body,
    );
    return res.status(200).json(
      apiResponse({
        message: "Plan updated successfully",
        data: toPlanDto(result),
      }),
    );
  },

  deletePlan: async (req, res) => {
    const result = await adminService.deletePlan(req.params.planId);
    return res.status(200).json(
      apiResponse({
        message: "Plan deleted successfully",
        data: result,
      }),
    );
  },

  listPlans: async (req, res) => {
    const result = await adminService.listPlans(req.validated.query);
    return res.status(200).json(
      apiResponse({
        message: "Plans fetched successfully",
        data: toPlansListDto(result.items),
        meta: {
          total: result.total,
          page: Number(req.validated.query.page || 1),
          limit: Number(req.validated.query.limit || 10),
        },
      }),
    );
  },

  // SMTP
  upsertSmtp: async (req, res) => {
    const result = await adminService.upsertSmtp(req.validated.body);
    return res.status(200).json(
      apiResponse({
        message: "SMTP configuration saved successfully",
        data: result,
      }),
    );
  },

  getSmtp: async (req, res) => {
    const result = await adminService.getSmtp();
    return res.status(200).json(
      apiResponse({
        message: "SMTP configuration fetched successfully",
        data: result,
      }),
    );
  },

  // Emailer
  createEmailer: async (req, res) => {
    const result = await adminService.createEmailer(req.validated.body);
    return res.status(201).json(
      apiResponse({
        message: "Emailer created successfully",
        data: result,
      }),
    );
  },

  updateEmailer: async (req, res) => {
    const result = await adminService.updateEmailer(
      req.params.emailerId,
      req.validated.body,
    );
    return res.status(200).json(
      apiResponse({
        message: "Emailer updated successfully",
        data: toEmailerDto(result),
      }),
    );
  },

  deleteEmailer: async (req, res) => {
    const result = await adminService.deleteEmailer(req.params.emailerId);
    return res.status(200).json(
      apiResponse({
        message: "Emailer deleted successfully",
        data: result,
      }),
    );
  },

  listEmailers: async (req, res) => {
    const result = await adminService.listEmailers(req.validated.query);
    return res.status(200).json(
      apiResponse({
        message: "Emailers fetched successfully",
        data: toEmailersListDto(result.items),
        meta: {
          total: result.total,
          page: Number(req.validated.query.page || 1),
          limit: Number(req.validated.query.limit || 10),
        },
      }),
    );
  },

  // Representatives
  createRepresentative: async (req, res) => {
    const result = await adminService.createRepresentative(req.validated.body);
    return res.status(201).json(
      apiResponse({
        message: "Representative created successfully",
        data: {
          id: result._id,
          name: result.name,
          email: result.email,
          role: result.role,
        },
      }),
    );
  },

  listRepresentatives: async (req, res) => {
    const result = await adminService.listRepresentatives(req.validated.query);
    return res.status(200).json(
      apiResponse({
        message: "Representatives fetched successfully",
        data: toRepresentativesListDto(result.items),
        meta: {
          total: result.total,
          page: Number(req.validated.query.page || 1),
          limit: Number(req.validated.query.limit || 10),
        },
      }),
    );
  },

  // MT5 Accounts
  listMt5Accounts: async (req, res) => {
    const result = await adminService.listMt5Accounts(req.validated.query);
    return res.status(200).json(
      apiResponse({
        message: "MT5 Accounts fetched successfully",
        data: toMt5AccountsListDto(result.items),
        meta: {
          total: result.total,
          page: Number(req.validated.query.page || 1),
          limit: Number(req.validated.query.limit || 10),
        },
      }),
    );
  },

  createManualMt5Account: async (req, res) => {
    const { account, emailed } = await adminService.createManualMt5Account(
      req.validated.body,
    );
    return res.status(201).json(
      apiResponse({
        message: emailed
          ? "MT5 account saved and login details were emailed to the client."
          : "MT5 account linked to the client. Send login details manually if needed.",
        data: toMt5AccountDto(account),
      }),
    );
  },

  updateMt5Account: async (req, res) => {
    const account = await adminService.updateMt5Account(
      req.validated.params.mt5AccountId,
      req.validated.body,
    );
    return res.status(200).json(
      apiResponse({
        message: "MT5 account updated",
        data: toMt5AccountDto(account),
      }),
    );
  },

  deleteMt5Account: async (req, res) => {
    await adminService.deleteMt5Account(req.validated.params.mt5AccountId);
    return res.status(200).json(
      apiResponse({
        message: "MT5 account removed from the client",
        data: { deleted: true },
      }),
    );
  },

  // Transactions
  listTransactions: async (req, res) => {
    const result = await adminService.listTransactions(req.validated.query);
    return res.status(200).json(
      apiResponse({
        message: "Transactions fetched successfully",
        data: toTransactionsListDto(result.items),
        meta: {
          total: result.total,
          page: Number(req.validated.query.page || 1),
          limit: Number(req.validated.query.limit || 10),
        },
      }),
    );
  },

  updateTransactionStatus: async (req, res) => {
    const result = await adminService.updateTransactionStatus(
      req.validated.params.transactionId,
      req.validated.body.status,
    );
    return res.status(200).json(
      apiResponse({
        message: "Transaction status updated successfully",
        data: toTransactionDto(result),
      }),
    );
  },

  getDashboardStats: async (req, res) => {
    const [totalClients, totalMt5Accounts, pendingTransactions, totalDeposits] =
      await Promise.all([
        User.countDocuments({ role: "client" }),
        Mt5Account.countDocuments({}),
        Transaction.countDocuments({ status: "pending" }),
        Transaction.aggregate([
          { $match: { type: "deposit", status: "completed" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);

    return res.status(200).json(
      apiResponse({
        data: {
          totalClients,
          totalMt5Accounts,
          pendingTransactions,
          totalDeposits: totalDeposits[0]?.total || 0,
        },
      }),
    );
  },

  getClientDashboardStats: async (req, res) => {
    const userId = req.user.id;

    const [accounts, transactions] = await Promise.all([
      Mt5Account.find({ userId: userId }),
      Transaction.find({ userId: userId }),
    ]);

    const totalBalance = accounts.reduce(
      (sum, acc) => sum + (acc.balance || 0),
      0,
    );
    const totalEquity = accounts.reduce(
      (sum, acc) => sum + (acc.equity || 0),
      0,
    );
    const pendingWithdrawals = transactions
      .filter((t) => t.type === "withdraw" && t.status === "pending")
      .reduce((sum, t) => sum + t.amount, 0);

    return res.status(200).json(
      apiResponse({
        data: {
          accountCount: accounts.length,
          totalBalance,
          totalEquity,
          pendingWithdrawals,
          recentTransactions: transactions.slice(-5),
        },
      }),
    );
  },

  impersonateUser: async (req, res) => {
    const { userId } = req.params;
    const result = await authService.issueImpersonationCode(userId, req.user, {
      ip: req.ip,
    });
    return res.status(200).json(
      apiResponse({
        message: "Impersonation handoff prepared",
        data: result,
      }),
    );
  },

  getDepositSettings: async (req, res) => {
    const data = await adminService.getDepositSettings();
    return res.status(200).json(apiResponse({ data }));
  },

  patchDepositSettings: async (req, res) => {
    const data = await adminService.patchDepositSettings(
      req.validated.body,
      req.user,
    );
    return res.status(200).json(
      apiResponse({
        message: "Deposit instructions updated",
        data,
      }),
    );
  },

  uploadDepositQr: async (req, res) => {
    if (!req.file) {
      throw new AppError("No file uploaded", 400, "NO_FILE");
    }
    const data = await adminService.replaceDepositQrFromUpload(
      req.file,
      req.user,
    );
    return res.status(200).json(
      apiResponse({
        message: "Deposit QR image saved",
        data,
      }),
    );
  },

  deleteDepositQr: async (req, res) => {
    const data = await adminService.clearDepositQr(req.user);
    return res.status(200).json(
      apiResponse({
        message: "Stored QR image removed",
        data,
      }),
    );
  },
};

export { adminController };
