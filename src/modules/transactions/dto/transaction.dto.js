/**
 * Resolves a public-ish URL for the deposit proof when the transaction has a
 * GridFS-backed file. The frontend prepends its base path so the full URL is
 * `<API>/transactions/mine/:id/proof/file`. When there is no proof we return
 * null so the UI can hide the link.
 */
function buildProofPath(tx) {
  if (!tx?.proofFileId) return null;
  const id = String(tx?._id || tx?.id || "");
  if (!id) return null;
  return `transactions/mine/${id}/proof/file`;
}

const toTransactionDto = (tx) => ({
  id: String(tx?._id || tx?.id || ""),
  userId: String(tx?.userId || ""),
  type: String(tx?.type || ""),
  amount: Number(tx?.amount || 0),
  status: String(tx?.status || ""),
  method: String(tx?.method || ""),
  note: String(tx?.note || ""),
  mt5Login: tx?.mt5Login != null ? Number(tx.mt5Login) : null,
  proofUrl: buildProofPath(tx),
  performedBy: String(tx?.performedBy || ""),
  createdAt: tx?.createdAt || null,
  updatedAt: tx?.updatedAt || null,
});

const toTransactionListDto = (items) =>
  Array.isArray(items) ? items.map(toTransactionDto) : [];

export { toTransactionDto, toTransactionListDto };
