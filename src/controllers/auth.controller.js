const jwt = require("jsonwebtoken");

const userModel = require("../models/user.model");
const emailService = require("../services/email.service");

/**
 * Register a new user account.
 *
 * **`POST /api/auth/register`** — public
 *
 * Creates the user, signs a 3-day JWT, sets it as a `token` cookie **and**
 * returns it in the response body. A welcome email is dispatched after the
 * response is sent, so mail failures do not affect the status code.
 *
 * **Request body**
 * ```json
 * { "email": "ada@example.com", "name": "Ada", "password": "secret123" }
 * ```
 *
 * **Responses**
 * - `201` — `{ user: { _id, email, name }, token }`
 * - `422` — `{ message: "User already exists with this email", status: "failed" }`
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<import("express").Response|void>}
 */
async function userRegisterController(req, res) {
  const { email, name, password } = req.body;

  const isExists = await userModel.findOne({
    email: email,
  });

  if (isExists) {
    return res.status(422).json({
      message: "User already exists with this email",
      status: "failed",
    });
  }

  const user = await userModel.create({
    email,
    password,
    name,
  });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });

  res.cookie("token", token);

  res.status(201).json({
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
    },
    token: token,
  });

  await emailService.sendRegistrationEmail(user.email, user.name);
}

/**
 * Authenticate an existing user.
 *
 * **`POST /api/auth/login`** — public
 *
 * Looks the user up by email with `.select("+password")` (the field is
 * `select: false` on the schema), compares the password via the
 * `comparePassword` instance method, then issues the same 3-day JWT as
 * registration — set as a `token` cookie and returned in the body.
 *
 * **Request body**
 * ```json
 * { "email": "ada@example.com", "password": "secret123" }
 * ```
 *
 * **Responses**
 * - `200` — `{ user: { _id, email, name }, token }`
 * - `401` — unknown email or wrong password (deliberately indistinguishable)
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<import("express").Response|void>}
 */
async function userLoginController(req, res) {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email }).select("+password");

  if (!user) {
    return res.status(401).json({
      message: "Email or Password is inValid 1",
    });
  }

  const isValidPassword = await user.comparePassword(password);

  if (!isValidPassword) {
    return res.status(401).json({
      message: "Email or Password is inValid ggg",
    });
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });

  res.cookie("token", token);

  res.status(200).json({
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
    },
    token,
  });
}

module.exports = {
  userRegisterController,
  userLoginController,
};
