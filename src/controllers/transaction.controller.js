const mongoose = require("mongoose");

const transactionModel = require("../models/transaction.model");
const accountModel = require("../models/account.model");
const userModel = require("../models/user.model");
const ledgerModel = require("../models/ledger.model");
const emailService = require("../services/email.service");

/**
 * `POST /api/transaction/transfer` — move money between two accounts.
 *
 * Runs the 10-step transfer plan:
 * 1. Validate the request
 * 2. Idempotency check
 * 3. Check account status
 * 4. Derive sender balance from ledger
 * 5. Create transaction (PENDING)
 * 6. Create DEBIT ledger entry
 * 7. Create CREDIT ledger entry
 * 8. Move to COMPLETED
 * 9. Commit MongoDB session
 * 10. Send email notification
 *
 * Steps 5-8 run inside a single Mongoose session so the two ledger legs are
 * written atomically — either both land or neither does.
 *
 * Request body:
 * ```json
 * {
 *   "fromAccount": "6a81b77cb58022b3dd6de600",
 *   "toAccount": "6a92457225d68c32af2a7a85",
 *   "amount": 12345,
 *   "idempotencyKey": "bc71a3d9-923f-4e1a-8b6c-2f4e819cd5b3"
 * }
 * ```
 *
 * `fromAccount` must belong to the authenticated user; the owner is taken from
 * `req.user._id`, never from the body.
 *
 * - `200` transfer completed, or the idempotency key was already seen
 * - `400` missing/invalid fields, same-account transfer, non-ACTIVE account, or
 *         insufficient balance
 * - `403` `fromAccount` is not owned by the authenticated user
 * - `404` either account does not exist
 * - `409` the idempotency key raced with a concurrent request
 * - `500` the transfer was aborted and nothing was written
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function createTransaction(req, res) {
  /**
   * 1. Validate a request
   */
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;
  if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res
      .status(400)
      .json({ message: "Amount must be a positive number" });
  }

  if (String(fromAccount) === String(toAccount)) {
    return res
      .status(400)
      .json({ message: "Cannot transfer to the same account" });
  }

  let session;
  let transaction;
  let fromUserAccount;
  let toUserAccount;

  try {
    fromUserAccount = await accountModel
      .findById(fromAccount)
      .populate("user", "name email");

    toUserAccount = await accountModel.findById(toAccount);

    if (!fromUserAccount || !toUserAccount) {
      return res.status(404).json({ message: "Account not found" });
    }

    const ownerId = fromUserAccount.user?._id ?? fromUserAccount.user;
    if (String(ownerId) !== String(req.user._id)) {
      return res
        .status(403)
        .json({ message: "You can only transfer from your own account" });
    }

    /**
     * 2. Idempotency check
     */
    const existingTransaction = await transactionModel.findOne({
      idempotencyKey,
    });
    if (existingTransaction) {
      if (existingTransaction.status == "COMPLETED") {
        return res.status(200).json({
          message: "Transaction already completed",
          transaction: existingTransaction,
        });
      }
      if (existingTransaction.status == "PENDING") {
        return res.status(200).json({
          message: "Transaction is still processing",
        });
      }
      if (existingTransaction.status == "FAILED") {
        return res.status(500).json({
          message: "Transaction failed, please retry",
        });
      }
      if (existingTransaction.status == "REVERSED") {
        return res.status(500).json({
          message: "Transaction was reversed, please retry",
        });
      }
    }

    /**
     * 3. check account status
     */
    if (
      fromUserAccount.status != "ACTIVE" ||
      toUserAccount.status != "ACTIVE"
    ) {
      return res.status(400).json({
        message: "Both To and From account must be ACTIVE for transaction",
      });
    }

    /**
     * 4. Derive sender balance from ledger
     */
    const senderBalance = await fromUserAccount.getAccountBalance();
    if (senderBalance < amount) {
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    /**
     * Steps 5-8 should follow Atomicity
     * 5. Create a transaction
     *
     * `Model.create` only accepts options when the first argument is an array —
     * `create(doc, { session })` would treat `{ session }` as a second document
     * and silently drop the session.
     */
    session = await mongoose.startSession();
    session.startTransaction();

    [transaction] = await transactionModel.create(
      [
        {
          fromAccount: fromUserAccount._id,
          toAccount: toUserAccount._id,
          amount,
          idempotencyKey,
          status: "PENDING",
        },
      ],
      { session },
    );

    /**
     * 6. Create a DEBIT ledger entry
     */

    await ledgerModel.create(
      [
        {
          account: fromUserAccount._id,
          amount,
          type: "DEBIT",
          transaction: transaction._id,
        },
      ],
      { session },
    );
    
    /**
     * 7. Create a CREDIT ledger entry
     */

    await ledgerModel.create(
      [
        {
          account: toUserAccount._id,
          amount,
          type: "CREDIT",
          transaction: transaction._id,
        },
      ],
      { session },
    );

    /**
     * 8. Move to completed transaction
     */

    transaction.status = "COMPLETED";
    await transaction.save({ session });

    /**
     * 9. Commit MongoDB session
     */

    await session.commitTransaction();
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Transfer failed:", error);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Transaction with this idempotency key is in flight",
      });
    }
    return res
      .status(500)
      .json({ message: "Transaction failed, please retry" });
  } finally {
    if (session) {
      await session.endSession();
    }
  }

  res.status(200).json({
    message: "Transaction completed successfully",
    transaction,
  });

  /**
   * 10. Send email notification
   *
   * Sent after responding, so a mail failure never fails a committed transfer —
   * same trade-off as `userRegisterController`.
   */
  try {
    await emailService.sendTransactionEmail(
      fromUserAccount.user.email,
      fromUserAccount.user.name,
      amount,
      String(toUserAccount._id),
      {
        transactionId: String(transaction._id),
        fromAccount: String(fromUserAccount._id),
        status: transaction.status,
        currency: fromUserAccount.currency,
        createdAt: transaction.createdAt,
      },
    );
  } catch (error) {
    console.error("Transaction email failed:", error);
  }
}

async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;
  if (!toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const toUserAccount = await accountModel.findOne({
    _id: toAccount,
  });

  if (!toUserAccount) {
    return res.status(400).json({
      message: "Invalid account",
    });
  }

  const fromUserAccount = await accountModel.findOne({
    user: req.user._id,
  });

  console.log(req.user);
  console.log(fromUserAccount);

  if (!fromUserAccount) {
    return res.status(400).json({
      message: "Invalid System user account",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  const transaction = new transactionModel({
    fromAccount: fromUserAccount._id,
    toAccount,
    amount,
    idempotencyKey,
    status: "PENDING",
  });

  const debitLedgerEntry = await ledgerModel.create(
    [
      {
        account: fromUserAccount._id,
        type: "DEBIT",
        amount,
        transaction: transaction._id,
      },
    ],
    { session },
  );

  const creditLedgerEntry = await ledgerModel.create(
    [
      {
        account: toUserAccount._id,
        type: "CREDIT",
        amount,
        transaction: transaction._id,
      },
    ],
    { session },
  );

  transaction.status = "COMPLETED";
  await transaction.save({ session });

  await session.commitTransaction();
  session.endSession();

  res.status(200).json({
    message: "Initial Funds crediting Transaction completed successfully",
    transaction,
  });
}

module.exports = {
  createTransaction,
  createInitialFundsTransaction,
};
