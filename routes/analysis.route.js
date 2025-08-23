// routes/analysis.route.js
"use strict";
const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysis.controller");

// GET Daily Connect Analysis
router.get("/daily", analysisController.getDailyAnalysis);

// GET /api/daily-analysis/user?userId=123
router.get("/daily-analysis/:userId", analysisController.getDailyAnalysisByUser);


module.exports = router;
