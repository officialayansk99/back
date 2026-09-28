import { apiResponse } from "../../../common/utils/apiResponse.js";
import { Mt5AccountService } from "../services/mt5Account.service.js";
import {
  toMt5AccountListDto,
  toCreateMt5AccountDto,
  toResetMt5PasswordDto,
} from "../dto/createMt5Account.dto.js";
import { toPlansListDto } from "../../admin/dto/manageUser.dto.js";

const mt5AccountService = new Mt5AccountService();

const mt5AccountController = {
  getProvisioningInfo: async (req, res) => {
    const result = await mt5AccountService.getProvisioningInfo();
    return res.status(200).json(
      apiResponse({
        message: "MT5 provisioning options",
        data: result,
      }),
    );
  },

  createMine: async (req, res) => {
    const result = await mt5AccountService.createByClient(
      req.user,
      req.validated.body,
    );
    const pending = Boolean(result.pending);
    const statusCode = pending ? 202 : 201;
    const message = pending
      ? "Request received. Check your email for confirmation — your account will be created shortly."
      : "MT5 account created successfully";
    return res.status(statusCode).json(
      apiResponse({
        message,
        data: toCreateMt5AccountDto(result),
      }),
    );
  },

  getMine: async (req, res) => {
    const result = await mt5AccountService.getMine(req.user);
    return res.status(200).json(
      apiResponse({
        message: "MT5 accounts fetched successfully",
        data: toMt5AccountListDto(result),
      }),
    );
  },

  resetPasswordByAdmin: async (req, res) => {
    const result = await mt5AccountService.resetPasswordByAdmin(
      req.validated.body.login,
      req.validated.body.newPassword,
    );
    return res.status(200).json(
      apiResponse({
        message: "MT5 password reset successful",
        data: toResetMt5PasswordDto(result),
      }),
    );
  },

  resetPasswordByClient: async (req, res) => {
    const result = await mt5AccountService.resetPasswordByClient(
      req.user,
      req.validated.body.login,
      req.validated.body.newPassword,
    );
    return res.status(200).json(
      apiResponse({
        message: "MT5 password reset successful",
        data: toResetMt5PasswordDto(result),
      }),
    );
  },

  listPlans: async (req, res) => {
    const result = await mt5AccountService.listPlans();
    return res.status(200).json(
      apiResponse({
        message: "Plans fetched successfully",
        data: toPlansListDto(result),
      }),
    );
  },
};

export { mt5AccountController };
