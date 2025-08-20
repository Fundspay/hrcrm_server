"use strict";

const express = require("express");
const router = express.Router();
const positionController = require("../controllers/position.controller.js");

// ✅ Add Position
router.post("/add", positionController.add);
router.get("/fetchAll", positionController.fetchAll);
router.get("/fetchSingle/:id", positionController.fetchSingle);
router.put("/update/:id", positionController.updatePosition);
router.delete("/delete/:id", positionController.deletePosition);

module.exports = router;
