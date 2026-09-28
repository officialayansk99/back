/** Paths relative to `/api/v1` (axios baseURL). Used for auth’d KYC downloads (not <img src> alone). */

const ME_ID_PROOF_FILE_PATH = "users/me/kyc/id-proof/file";
const ME_ADDRESS_PROOF_FILE_PATH = "users/me/kyc/address-proof/file";
const ME_AVATAR_FILE_PATH = "users/me/avatar/file";

function adminIdProofFilePath(userId) {
  return `admin/users/${userId}/kyc/id-proof/file`;
}

function adminAddressProofFilePath(userId) {
  return `admin/users/${userId}/kyc/address-proof/file`;
}

function resolveClientIdProofPath(user) {
  if (user?.idProofFileId) return ME_ID_PROOF_FILE_PATH;
  if (user?.idProofUrl != null && String(user.idProofUrl).trim()) {
    return String(user.idProofUrl);
  }
  return null;
}

function resolveClientAddressProofPath(user) {
  if (user?.addressProofFileId) return ME_ADDRESS_PROOF_FILE_PATH;
  if (user?.addressProofUrl != null && String(user.addressProofUrl).trim()) {
    return String(user.addressProofUrl);
  }
  return null;
}

function resolveAdminIdProofPath(user) {
  const id = user?._id ?? user?.id;
  if (!id) return null;
  if (user.idProofFileId) return adminIdProofFilePath(String(id));
  if (user.idProofUrl != null && String(user.idProofUrl).trim()) {
    return String(user.idProofUrl);
  }
  return null;
}

function resolveAdminAddressProofPath(user) {
  const id = user?._id ?? user?.id;
  if (!id) return null;
  if (user.addressProofFileId) return adminAddressProofFilePath(String(id));
  if (user.addressProofUrl != null && String(user.addressProofUrl).trim()) {
    return String(user.addressProofUrl);
  }
  return null;
}

/**
 * Avatar path resolution. When the user uploaded a real file we return the
 * authenticated stream path; otherwise we fall through to the legacy
 * free-text avatarUrl (still used by older accounts that don't have a
 * GridFS-backed avatar).
 */
function resolveClientAvatarPath(user) {
  if (user?.avatarFileId) return ME_AVATAR_FILE_PATH;
  if (user?.avatarUrl != null && String(user.avatarUrl).trim()) {
    return String(user.avatarUrl);
  }
  return null;
}

export {
  ME_ADDRESS_PROOF_FILE_PATH,
  ME_AVATAR_FILE_PATH,
  ME_ID_PROOF_FILE_PATH,
  adminAddressProofFilePath,
  adminIdProofFilePath,
  resolveAdminAddressProofPath,
  resolveAdminIdProofPath,
  resolveClientAddressProofPath,
  resolveClientAvatarPath,
  resolveClientIdProofPath,
};
