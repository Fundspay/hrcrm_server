// routes/analysis.route.js
"use strict";
const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/analysis.controller");

// GET Daily Connect Analysis (planned targets only)
// Example: /api/analysis/daily?userId=123&startDate=2025-08-01&endDate=2025-08-10
router.get("/daily", analysisController.getDailyAnalysis);

// If you still want a per-user analysis with optional date range
// you can keep this, pointing to a different handler if needed
router.get("/connected/:userId", analysisController.getConnectedCoSheetsByUser);

// routes/analysis.route.js
router.put("/connected/:id", analysisController.updateConnectedCoSheet);

module.exports = router;
