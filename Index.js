const express = require("express")
const dotenv = require("dotenv");
const connectDB = require("./config/db");
dotenv.config();
const app = express();
connectDB();
app.use(express.json());


const userRoutes = require("./routes/userRoutes")
const destinationRoutes = require("./routes/destinationRoutes")
const bookingRoutes = require("./routes/bookingRoutes")

app.use("/api/users", userRoutes)

app.use("/api/destinations", destinationRoutes);
app.use("/api/booking", bookingRoutes)


app.get("/", (req, res) => {
  res.send("Travel API is running...");
});

const PORT = process.env.PORT || 5000;


app.listen(PORT, () => {
    console.log(`server runnimg on ${PORT}`)
})