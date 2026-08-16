const express = require("express");
const authController = require("../controllers/auth.controller");

const router = express.Router();

/**
 * `POST /api/auth/register` — create an account and receive a JWT.
 * @see {@link authController.userRegisterController} for body and responses.
 */
router.post("/register", authController.userRegisterController);

/**
 * `POST /api/auth/login` — exchange credentials for a JWT.
 * @see {@link authController.userLoginController} for body and responses.
 */
router.post("/login", authController.userLoginController);

module.exports = router;
