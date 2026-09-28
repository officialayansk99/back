import mongoose from "mongoose";
import { logger } from "./logger.js";

const connectDatabase = async (mongoUri) => {
  mongoose.set("strictQuery", true);
  const connection = await mongoose.connect(mongoUri, {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  });

  logger.info(
    { host: connection.connection.host, database: connection.connection.name },
    "MongoDB connected",
  );

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  mongoose.connection.on("error", (error) => {
    logger.error({ message: error.message }, "MongoDB connection error");
  });
};

export { connectDatabase };
