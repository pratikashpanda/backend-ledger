const express = require("express");
const cookieParser = require("cookie-parser");

/**
 * The configured Express application.
 *
 * Exported without calling `listen` — `server.js` owns the port binding, so
 * this stays importable from tests.
 *
 * **Mounted routes**
 * - `/api/auth` — register and login, public
 * - `/api/account` — ledger accounts, JWT-protected
 *
 * @type {import("express").Express}
 */
const app = express();

// Middlewares to read the data inside the request body
app.use(express.json());
app.use(cookieParser());

// Import Routes
const authRouter = require("./routes/auth.route");
const accountRouter = require("./routes/account.route");
const transactionRouter = require("./routes/transaction.route")

// Use Routes
app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api/transaction", transactionRouter);

module.exports = app;
