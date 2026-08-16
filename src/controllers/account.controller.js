const accountModel = require("../models/account.model");

const createAccountController = async (req, res) => {
  const user = req.user;
  const account = await accountModel.create({ user: user._id });

  return res.status(201).json({ message: "Account created", account });
};

module.exports = {
  createAccountController,
};
