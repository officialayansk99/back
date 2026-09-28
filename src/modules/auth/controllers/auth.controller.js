import { apiResponse } from "../../../common/utils/apiResponse.js";
import { AuthService } from "../services/auth.service.js";
import { toAuthRegisterDto } from "../dto/register.dto.js";
import { toAuthLoginDto } from "../dto/login.dto.js";

const authService = new AuthService();

const authController = {
  register: async (req, res) => {
    const result = await authService.register(req.validated.body);
    return res.status(201).json(
      apiResponse({
        message: result.message,
        data: toAuthRegisterDto(result),
      }),
    );
  },

  login: async (req, res) => {
    const result = await authService.login(req.validated.body);
    return res.status(200).json(
      apiResponse({
        message: "Login successful",
        data: toAuthLoginDto(result),
      }),
    );
  },

  forgotPassword: async (req, res) => {
    const result = await authService.forgotPassword(req.validated.body, {
      ip: req.ip,
    });
    return res.status(200).json(
      apiResponse({
        message: result.message,
      }),
    );
  },

  resetPassword: async (req, res) => {
    const result = await authService.resetPassword(req.validated.body, {
      ip: req.ip,
    });
    return res.status(200).json(
      apiResponse({
        message: result.message,
      }),
    );
  },

  portalWelcome: async (req, res) => {
    const result = await authService.sendPortalWelcomeIfNeeded(req.user);
    return res.status(200).json(
      apiResponse({
        message: "ok",
        data: result,
      }),
    );
  },

  exchangeImpersonationCode: async (req, res) => {
    const result = await authService.exchangeImpersonationCode(
      req.validated.body.code,
      { ip: req.ip },
    );
    return res.status(200).json(
      apiResponse({
        message: "Impersonation session ready",
        data: result,
      }),
    );
  },
};

export { authController };
