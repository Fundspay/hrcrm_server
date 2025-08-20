// routes/analysis.route.js
"use strict";
const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysis.controller");

// GET Daily Connect Analysis
router.get("/daily", analysisController.getDailyAnalysis);

module.exports = router;
