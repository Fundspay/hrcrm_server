"use strict";
const express = require("express");
const router = express.Router();
const myTargetController = require("../controllers/mytarget.controller");


router.post("/add", myTargetController.addTarget);
router.get("/list", myTargetController.fetchAllTargets);
router.get("/list/:id", myTargetController.fetchTargetById);
router.put("/update/:id", myTargetController.updateTarget);
router.delete("/delete/:id", myTargetController.deleteTarget);

module.exports = router;
