import {
  resolveAdminAddressProofPath,
  resolveAdminIdProofPath,
} from "../../users/utils/kycPublicPaths.js";

const toClientDto = (user) => ({
  id: String(user?._id || user?.id || ""),
  name: String(user?.name || ""),
  email: String(user?.email || ""),
  phone: String(user?.phone || ""),
  status: String(user?.status || "pending"),
  kycStatus: String(user?.kycStatus || "pending"),
  idProofUrl: resolveAdminIdProofPath(user),
  addressProofUrl: resolveAdminAddressProofPath(user),
  bankDetails: user?.bankDetails || null,
  createdAt: user?.createdAt || null,
  updatedAt: user?.updatedAt || null,
});

const toClientsListDto = (items) =>
  Array.isArray(items) ? items.map(toClientDto) : [];

const toPlanDto = (plan) => ({
  id: String(plan?._id || plan?.id || ""),
  planName: String(plan?.planName || ""),
  groupName: String(plan?.groupName || ""),
  leverage: String(plan?.leverage || ""),
  minDeposit: Number(plan?.minDeposit || 0),
  active: Boolean(plan?.active),
  createdAt: plan?.createdAt || null,
});

const toPlansListDto = (items) =>
  Array.isArray(items) ? items.map(toPlanDto) : [];

const toEmailerDto = (emailer) => ({
  id: String(emailer?._id || emailer?.id || ""),
  emailerType: String(emailer?.emailerType || ""),
  mailSubject: String(emailer?.mailSubject || ""),
  ccMail: String(emailer?.ccMail || ""),
  mailBody: String(emailer?.mailBody || ""),
  updatedAt: emailer?.updatedAt || null,
});

const toEmailersListDto = (items) =>
  Array.isArray(items) ? items.map(toEmailerDto) : [];

const toRepresentativeDto = (rep) => ({
  id: String(rep?._id || rep?.id || ""),
  name: String(rep?.name || ""),
  email: String(rep?.email || ""),
  createdAt: rep?.createdAt || null,
});

const toRepresentativesListDto = (items) =>
  Array.isArray(items) ? items.map(toRepresentativeDto) : [];

const toMt5AccountDto = (acc) => ({
  id: String(acc?._id || acc?.id || ""),
  login: Number(acc?.login || 0),
  type: String(acc?.type || "demo"),
  server: String(acc?.server || ""),
  leverage: Number(acc?.leverage ?? 0),
  group: String(acc?.group || ""),
  balance: Number(acc?.balance || 0),
  equity: Number(acc?.equity || 0),
  userId: acc?.userId
    ? {
        id: String(acc.userId._id || acc.userId.id || ""),
        name: String(acc.userId.name || ""),
        email: String(acc.userId.email || ""),
      }
    : null,
  createdAt: acc?.createdAt || null,
});

const toMt5AccountsListDto = (items) =>
  Array.isArray(items) ? items.map(toMt5AccountDto) : [];

const toTransactionDto = (tx) => ({
  id: String(tx?._id || tx?.id || ""),
  type: String(tx?.type || "deposit"),
  amount: Number(tx?.amount || 0),
  status: String(tx?.status || "pending"),
  method: String(tx?.method || ""),
  note: String(tx?.note || ""),
  mt5Login: tx?.mt5Login != null ? Number(tx.mt5Login) : null,
  /**
   * When a client uploaded a payment proof, expose the authenticated stream
   * path so the admin UI can fetch and display it. The path is relative;
   * the frontend prepends its API base URL when calling.
   */
  proofUrl: tx?.proofFileId
    ? `transactions/${String(tx?._id || tx?.id || "")}/proof/file`
    : null,
  userId: tx?.userId
    ? {
        id: String(tx.userId._id || tx.userId.id || ""),
        name: String(tx.userId.name || ""),
        email: String(tx.userId.email || ""),
      }
    : null,
  createdAt: tx?.createdAt || null,
});

const toTransactionsListDto = (items) =>
  Array.isArray(items) ? items.map(toTransactionDto) : [];

const toDeleteUserDto = (payload) => ({
  id: String(payload?.id || ""),
  deleted: Boolean(payload?.deleted),
});

const toAdminAnalyticsDto = (payload) => ({
  totalClients: Number(payload?.totalClients || 0),
  approvedKyc: Number(payload?.approvedKyc || 0),
  totalMt5Accounts: Number(payload?.totalMt5Accounts || 0),
  totalDeposits: Number(payload?.totalDeposits || 0),
  totalWithdrawals: Number(payload?.totalWithdrawals || 0),
});

export {
  toClientDto,
  toClientsListDto,
  toPlanDto,
  toPlansListDto,
  toEmailerDto,
  toEmailersListDto,
  toRepresentativeDto,
  toRepresentativesListDto,
  toMt5AccountDto,
  toMt5AccountsListDto,
  toTransactionDto,
  toTransactionsListDto,
  toDeleteUserDto,
  toAdminAnalyticsDto,
};
