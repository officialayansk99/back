import { apiResponse } from "../../../common/utils/apiResponse.js";
import { AppError } from "../../../common/errors/AppError.js";
import { TransactionService } from "../services/transaction.service.js";
import * as depositSettingsService from "../../admin/services/depositSettings.service.js";
import * as depositQrGridfs from "../../admin/services/depositQrGridfs.service.js";
import {
  toTransactionDto,
  toTransactionListDto,
} from "../dto/transaction.dto.js";
import { fetchUsdInrRate } from "../services/fxRate.service.js";

const transactionService = new TransactionService();

const transactionController = {
  /** Live USD→INR (ECB reference + commission markup, cached ~1h). For client deposit info only. */
  getUsdInrRate: async (_req, res) => {
    try {
      const { rate, asOfDate } = await fetchUsdInrRate();
      return res.status(200).json(
        apiResponse({
          message: "ok",
          data: {
            rate,
            asOfDate,
          },
        }),
      );
    } catch {
      return res.status(200).json(
        apiResponse({
          message: "ok",
          data: {
            rate: null,
            asOfDate: null,
            unavailable: true,
          },
        }),
      );
    }
  },

  getDepositInstructions: async (req, res) => {
    const data = await depositSettingsService.getDepositSettingsForApi();
    return res.status(200).json(
      apiResponse({
        message: "ok",
        data,
      }),
    );
  },

  streamDepositQrFile: async (req, res) => {
    const id = await depositSettingsService.getQrCodeFileId();
    if (!id) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
    const ok = await depositQrGridfs.pipeFileToResponse(id, res);
    if (!ok) {
      throw new AppError("File not found", 404, "FILE_NOT_FOUND");
    }
  },

  createManual: async (req, res) => {
    const result = await transactionService.createManual(
      req.user,
      req.validated.body,
    );
    return res.status(201).json(
      apiResponse({
        message: "Transaction recorded successfully",
        data: toTransactionDto(result),
      }),
    );
  },

  listMine: async (req, res) => {
    const result = await transactionService.listMine(
      req.user,
      req.validated.query,
    );
    return res.status(200).json(
      apiResponse({
        message: "Transactions fetched successfully",
        data: toTransactionListDto(result.items),
        meta: {
          total: result.total,
          page: Number(req.validated.query.page),
          limit: Number(req.validated.query.limit),
        },
      }),
    );
  },

  getMyAvailableBalance: async (req, res) => {
    const available = await transactionService.getAvailableBalance(req.user.id);
    return res.status(200).json(
      apiResponse({
        message: "ok",
        data: { available },
      }),
    );
  },

  requestDeposit: async (req, res) => {
    const result = await transactionService.requestDeposit(
      req.user,
      req.validated.body,
      req.file,
    );
    return res.status(201).json(
      apiResponse({
        message: "Deposit request submitted successfully",
        data: toTransactionDto(result),
      }),
    );
  },

  requestWithdrawal: async (req, res) => {
    const result = await transactionService.requestWithdrawal(
      req.user,
      req.validated.body,
    );
    return res.status(201).json(
      apiResponse({
        message: "Withdrawal request submitted successfully",
        data: toTransactionDto(result),
      }),
    );
  },

  streamMyProof: async (req, res) => {
    await transactionService.streamMyProof(
      req.user,
      req.params.transactionId,
      res,
    );
  },

  streamProofForAdmin: async (req, res) => {
    await transactionService.streamProofForAdmin(req.params.transactionId, res);
  },
};

export { transactionController };
