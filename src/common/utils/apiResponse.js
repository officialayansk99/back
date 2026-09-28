const apiResponse = ({
  success = true,
  message = "OK",
  data = null,
  meta = null,
}) => ({
  success,
  message,
  data,
  meta,
});

export { apiResponse };
