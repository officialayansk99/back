const toAuthLoginDto = (payload) => {
  if (!payload) {
    return null;
  }

  return {
    token: String(payload.token || ""),
    user: {
      id: String(payload.user?.id || ""),
      name: String(payload.user?.name || ""),
      email: String(payload.user?.email || ""),
      role: String(payload.user?.role || ""),
      kycStatus: String(payload.user?.kycStatus || ""),
    },
  };
};

export { toAuthLoginDto };
