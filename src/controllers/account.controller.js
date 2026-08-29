const accountModel = require("../models/account.model");

const createAccountController = async (req, res) => {
  const user = req.user;
  const account = await accountModel.create({ user: user._id });

  return res.status(201).json({ message: "Account created", account });
};

const getUserAccountsController = async (req, res) => {
  const accounts = await accountModel.find({ user: req.user._id });
  if (accounts.length === 0) {
    return res.status(404).json({ message: "Account not found" });
  }
  return res.status(200).json({ accounts });
};

const getAccountBalanceController = async (req, res) => {
  const { accountId } = req.params;
  const account = await accountModel.findOne({
    _id: accountId,
    user: req.user._id,
  });
  if (!account) {
    return res.status(404).json({ message: "Account not found" });
  }
  const balance = await account.getAccountBalance();
  return res.status(200).json({ accountId: account._id, balance });
};

module.exports = {
  createAccountController,
  getUserAccountsController,
  getAccountBalanceController,
};
