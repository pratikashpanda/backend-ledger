const { Router } = require("express");
const {
  authSystemUserMiddleware,
  authMiddleware,
} = require("../middleware/auth.middleware");
const transactionController = require("../controllers/transaction.controller");

const transactionRoutes = Router();

/**
 * `POST /api/transaction/transfer` — transfers money from one account to another.
 * Protected by `authMiddleware`, so the JWT must be present as a `token`
 * cookie or `Authorization` header.
 * @see {@link transactionController.transferController} for the request body and
 *      responses.
 */
transactionRoutes.post(
  "/transfer",
  authMiddleware,
  transactionController.createTransaction,
);

transactionRoutes.post(
  "/system/initial-funds",
  authSystemUserMiddleware,
  transactionController.createInitialFundsTransaction,
);

module.exports = transactionRoutes;
