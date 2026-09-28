const toAuthRegisterDto = (payload) => {
  if (!payload) {
    return null;
  }

  return {
    message: String(payload.message || ""),
    email: String(payload.email || ""),
  };
};

export { toAuthRegisterDto };
