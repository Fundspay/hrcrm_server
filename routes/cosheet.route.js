// routes/coSheet.routes.js
"use strict";
const express = require("express");
const router = express.Router();
const cosheetController = require("../controllers/cosheet.controller");

router.post("/register", cosheetController.createCoSheet);
router.put("/update/:id", cosheetController.updateConnectFields);
router.get("/list", cosheetController.getCoSheets);
router.get("/list/:id", cosheetController.getCoSheetById);

module.exports = router;
