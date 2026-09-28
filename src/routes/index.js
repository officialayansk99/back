import express from "express";
import { authRoutes } from "../modules/auth/routes/auth.routes.js";
import { mt5AccountRoutes } from "../modules/mt5Accounts/routes/mt5Account.routes.js";
import { adminRoutes } from "../modules/admin/routes/admin.routes.js";
import { transactionRoutes } from "../modules/transactions/routes/transaction.routes.js";
import { userRoutes } from "../modules/users/routes/user.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/mt5-accounts", mt5AccountRoutes);
router.use("/admin", adminRoutes);
router.use("/transactions", transactionRoutes);

export { router };
