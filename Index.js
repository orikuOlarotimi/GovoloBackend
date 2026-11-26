const express = require("express")
const dotenv = require("dotenv");
const connectDB = require("./config/db");
dotenv.config();
const app = express();
connectDB();
const { startWorker } = require("./workers");
app.use(express.json());
const cookieParser = require("cookie-parser");
const assignVisitorId = require("./midleware/visitorId");
const mongoose = require("mongoose");

const cors = require("cors");
app.use(cookieParser());
app.use(assignVisitorId);


const userRoutes = require("./routes/userRoutes")
const destinationRoutes = require("./routes/destinationRoutes")
const bookingRoutes = require("./routes/bookingRoutes")
const testimonialRoutes = require("./routes/testimonialRoutes")
const blogRoutes = require("./routes/blogRoutes");
const packageRoutes = require("./routes/packageRoutes")
const contacRoutes = require('./routes/contactRoutes');

const NewsletterRoutes = require('./routes/newsletterRoutes')
const { apiLogger: log } = require("./utils/logger");


app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use("/api/users", userRoutes)

app.use("/api/destinations", destinationRoutes);
app.use("/api/booking", bookingRoutes)
app.use("/api/testimonial", testimonialRoutes)

app.use("/api/packages", packageRoutes)
app.use("/api/blogs", blogRoutes);

app.use("/api/contact", contacRoutes);
app.use("/api/newsletter", NewsletterRoutes)

app.get("/", (req, res) => {
  res.send("Travel API is running...");
});

const PORT = process.env.PORT || 5000;
let emailWorker;

const server = app.listen(PORT, "0.0.0.0", async () => {
  log.info(
    { event: "server.started", port: PORT, nodeVersion: process.version },
    "Server started",
  );
  try {
    emailWorker = await startWorker();
  } catch (err) {
    log.error(
      {
        event: "worker.start_failed",
        err,
        status: err.status || err.response?.status,
        body: err.response?.body || err.response?.text,
      },
      "Worker failed to start",
    );
  }
});

const shutdown = async (signal) => {
  log.info({ event: "server.stopping", signal }, "Shutting down");
  server.close();
  if (emailWorker) await emailWorker.close();
  await mongoose.disconnect();
  setTimeout(() => process.exit(0), 500);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.on("error", (err) => {
  log.fatal(
    { event: "server.start_failed", err, port: PORT },
    "Server failed to start",
  );
  // short delay so the last line has time to reach Axiom before the process ends
  setTimeout(() => process.exit(1), 1000);
});