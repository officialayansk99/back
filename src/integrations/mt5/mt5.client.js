import axios from "axios";
import {
  mt5ServiceBaseUrl,
  mt5ServiceApiKey,
  mt5Login,
  mt5Password,
  mt5Server,
} from "../../config/env.js";
import { AppError } from "../../common/errors/AppError.js";

class Mt5Client {
  constructor() {
    this.http = axios.create({
      baseURL: mt5ServiceBaseUrl,
      timeout: 8000,
      headers: {
        "Content-Type": "application/json",
        ...(mt5ServiceApiKey ? { "x-api-key": mt5ServiceApiKey } : {}),
      },
    });
  }

  normalizeError(error) {
    if (error instanceof AppError) return error;

    const upstreamStatus = error.response?.status;
    let statusCode = upstreamStatus || 503;
    let message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      null;

    if (!upstreamStatus && error.code) {
      const unreachable = [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ENOTFOUND",
        "EAI_AGAIN",
      ];
      if (unreachable.includes(error.code)) {
        message =
          "Cannot reach the MT5 integration service (connection failed). " +
          "If you are not using an MT5 API bridge, set MT5_AUTOMATION_ENABLED=false " +
          "on the server and MT5_SUPPORT_EMAIL for manual account requests.";
      }
    }

    if (!message) {
      message =
        error.message ||
        "MT5 integration request failed. Check MT5_SERVICE_BASE_URL or use manual provisioning.";
    }

    return new AppError(
      message,
      statusCode,
      "MT5_SERVICE_ERROR",
      error.response?.data || null,
    );
  }

  async createAccount(payload) {
    try {
      const { data } = await this.http.post("/mt5/create-account", {
        managerLogin: mt5Login,
        managerPassword: mt5Password,
        managerServer: mt5Server,
        ...payload,
      });
      return data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async resetPassword(payload) {
    try {
      const { data } = await this.http.post("/mt5/reset-password", {
        managerLogin: mt5Login,
        managerPassword: mt5Password,
        managerServer: mt5Server,
        ...payload,
      });
      return data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getAccount(login) {
    try {
      const { data } = await this.http.get(`/mt5/account/${login}`, {
        params: {
          managerLogin: mt5Login,
          managerPassword: mt5Password,
          managerServer: mt5Server,
        },
      });
      return data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
}

export { Mt5Client };
