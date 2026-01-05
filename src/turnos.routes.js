// server/src/turnos.routes.js
const express = require("express");
const router = express.Router();
const { createBatch, list, updateOne, removeOne } = require("./turnos.controller");

// Si quieres proteger con login, añade tu middleware de sesión aquí.
// router.use(require('./requireAuth'))

router.post("/batch", createBatch);
router.get("/", list);
router.patch("/:id", updateOne);
router.delete("/:id", removeOne);

module.exports = router;
