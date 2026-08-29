const mongoose = require("mongoose");

const transactionModel = require("../models/transaction.model");
const accountModel = require("../models/account.model");
const userModel = require("../models/user.model");
const ledgerModel = require("../models/ledger.model");
const emailService = require("../services/email.service");

/**
 * - Create a new transaction
 * The 10-step transfer plan
 * 1. Validate a request
 * 2. Idempotency check
 * 3. Check account status
 * 4. Derive sender balance from ledger
 * 5. Create transaction (PENDING)
 * 6. Create DEBIT ledger entry
 * 7. Create CREDIT ledger entry
 * 8. Move to completed transaction
 * 9. Commit MongoDB session
 * 10. Send email notification
 */

async function createTransaction(req, res) {
  /**
   * 1. Validate a request
   */
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;
  if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const fromUserAccount = await accountModel.findOne({
    _id: fromAccount,
  });

  const toUserAccount = await accountModel.findOne({
    _id: toAccount,
  });
  if (!fromUserAccount || !toUserAccount) {
    return res.status(404).json({ message: "Account not found" });
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
  if (fromUserAccount.status != "ACTIVE" || toUserAccount.status != "ACTIVE") {
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
   */
  const session = await mongoose.startSession();
  session.startTransaction();

  const transaction = await transactionModel.create(
    {
      fromAccount,
      toAccount,
      amount,
      idempotencyKey,
      status: "PENDING",
    },
    { session },
  );

  /**
   * 6. Create a DEBIT ledger entry
   */

  const debitLedgerEntry = await ledgerModel.create(
    {
      account: fromAccount._id,
      amount,
      type: "PENDING",
      transaction: transaction._id,
    },
    { session },
  );

  /**
   * 7. Create a CREDIT ledger entry
   */

  const creditLedgerEntry = await ledgerModel.create(
    {
      account: toAccount._id,
      amount,
      transaction: transaction._id,
      type: "CREDIT",
    },
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
  session.endSession();

  /**
   * 10. Send email notification
   */

  await emailService.sendTransactionEmail({
    userEmail: fromUserAccount.email,
    name: fromUserAccount.name,
    toAccount: toUserAccount.accountNumber,
    amount,
  });

  return res.status(200).json({
    message: "Transaction completed successfully",
    transaction,
  });
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
