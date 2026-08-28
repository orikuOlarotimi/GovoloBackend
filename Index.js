const express = require("express")
const dotenv = require("dotenv");
const connectDB = require("./config/db");
dotenv.config();
const app = express();
connectDB();
app.use(express.json());
const cookieParser = require("cookie-parser");
const assignVisitorId = require("./midleware/visitorId");
const cors = require("cors");

const userRoutes = require("./routes/userRoutes")
const destinationRoutes = require("./routes/destinationRoutes")
const bookingRoutes = require("./routes/bookingRoutes")
const testimonialRoutes = require("./routes/testimonialRoutes")
const blogRoutes = require("./routes/blogRoutes");

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.use("/api/users", userRoutes)

app.use("/api/destinations", destinationRoutes);
app.use("/api/booking", bookingRoutes)
app.use("/api/testimonial", testimonialRoutes)
app.use(cookieParser());
app.use(assignVisitorId);

app.use("/api/blogs", blogRoutes);


app.get("/", (req, res) => {
  res.send("Travel API is running...");
});

const PORT = process.env.PORT || 5000;


app.listen(PORT, () => {
    console.log(`server runnimg on ${PORT}`)
})