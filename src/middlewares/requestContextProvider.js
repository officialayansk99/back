import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const requestContext = new AsyncLocalStorage();

const requestContextProvider = (req, res, next) => {
  let reqId = req.headers["x-request-id"] || req.headers["x-correlation-id"];

  if (!reqId) {
    reqId = randomUUID();
  }

  res.setHeader("X-Request-Id", reqId);
  req.id = reqId;

  const store = new Map();
  store.set("reqId", reqId);

  requestContext.run(store, () => {
    next();
  });
};

export { requestContext, requestContextProvider };
