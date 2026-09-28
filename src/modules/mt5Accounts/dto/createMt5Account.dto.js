const toMt5AccountDto = (account) => ({
  login: Number(account?.login || 0),
  type: String(account?.type || ""),
  server: String(account?.server || ""),
  leverage: Number(account?.leverage || 0),
  group: String(account?.group || ""),
  createdAt: account?.createdAt || null,
  balance: typeof account?.balance === "number" ? account.balance : undefined,
  equity: typeof account?.equity === "number" ? account.equity : undefined,
  margin: typeof account?.margin === "number" ? account.margin : undefined,
  openTrades: Array.isArray(account?.openTrades)
    ? account.openTrades
    : undefined,
  tradeHistory: Array.isArray(account?.tradeHistory)
    ? account.tradeHistory
    : undefined,
});

const toMt5AccountListDto = (items) =>
  Array.isArray(items) ? items.map(toMt5AccountDto) : [];

const toCreateMt5AccountDto = (payload) => ({
  pending: Boolean(payload?.pending),
  account: payload?.account != null ? toMt5AccountDto(payload.account) : null,
  credentialsDelivery: {
    channel: String(payload?.credentialsDelivery?.channel || "secure-inbox"),
    sentAt: payload?.credentialsDelivery?.sentAt || null,
  },
});

const toResetMt5PasswordDto = (payload) => ({
  login: Number(payload?.login || 0),
  reset: Boolean(payload?.reset),
});

export {
  toMt5AccountDto,
  toMt5AccountListDto,
  toCreateMt5AccountDto,
  toResetMt5PasswordDto,
};
