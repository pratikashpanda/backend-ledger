const express = require("express");
const cookieParser = require("cookie-parser");
const authRouter = require("./routes/auth.route");

const app = express();

// To read the data inside the request body
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);

module.exports = app;
