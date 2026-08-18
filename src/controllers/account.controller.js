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

module.exports = {
  createAccountController,
  getUserAccountsController,
};
