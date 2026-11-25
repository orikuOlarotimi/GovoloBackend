// config/db.js
require("dotenv").config(); // must run before the logger is loaded
const mongoose = require("mongoose");
const { apiLogger } = require("../utils/logger");

const connectDB = async (log = apiLogger) => {
  const startedAt = Date.now();

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // fail after 10s instead of the 30s default
    });

    log.info(
      {
        event: "db.connected",
        host: conn.connection.host,
        database: conn.connection.name,
        durationMs: Date.now() - startedAt,
      },
      "MongoDB connected",
    );

    // Registered only after a successful connect, so these report problems
    // that happen while the app is running
    conn.connection.on("disconnected", () =>
      log.warn({ event: "db.disconnected" }, "MongoDB disconnected"),
    );
    conn.connection.on("reconnected", () =>
      log.info({ event: "db.reconnected" }, "MongoDB reconnected"),
    );
    conn.connection.on("error", (err) =>
      log.error({ event: "db.error", err }, "MongoDB connection error"),
    );
  } catch (err) {
    log.fatal(
      {
        event: "db.connection_failed",
        err,
        durationMs: Date.now() - startedAt,
      },
      "Database connection failed",
    );

    // Wait so the log reaches Axiom. The await also means the caller never
    // carries on (for example, to start the server) while we wait to exit.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    process.exit(1);
  }
};

module.exports = connectDB;
