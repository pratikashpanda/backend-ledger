const express = require("express");
const { authMiddleware } = require("../middleware/auth.middleware");

const accountController = require("../controllers/account.controller");

const router = express.Router();

/**
 * `POST /api/account/create-account` — open a ledger account for the caller.
 *
 * Protected by `authMiddleware`, so the JWT must be present as a `token`
 * cookie or `Authorization` header.
 *
 * @see {@link accountController.createAccountController} for body and responses.
 */
router.post(
  "/create-account",
  authMiddleware,
  accountController.createAccountController,
);
router.get(
  "/get-accounts",
  authMiddleware,
  accountController.getUserAccountsController,
);
router.get(
  "/balance/:accountId",
  authMiddleware,
  accountController.getAccountBalanceController,
);

module.exports = router;
