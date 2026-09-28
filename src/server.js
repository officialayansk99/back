import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { mongoUri, port } from "./config/env.js";
import { logger } from "./config/logger.js";

const startServer = async () => {
  await connectDatabase(mongoUri);
  app.listen(port, () => {
    logger.info({ port }, "API server listening");
  });
};

startServer().catch((error) => {
  logger.error({ message: error.message }, "Failed to start server");
  process.exit(1);
});
