const express = require("express");
const { register, login, verifyEmail, resendVerification, me, logout } = require("./auth.controller");
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/verify", verifyEmail);
router.post("/resend", resendVerification);
router.get("/me", me);
router.post("/logout", logout);

module.exports = { authRouter: router };
