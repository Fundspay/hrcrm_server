"use strict";

const express = require("express");
const router = express.Router();
const analysisController = require("../controllers/interviewanalysis.controller");

// Upsert analysis
router.post("/upsert", analysisController.upsertInterviewAnalysis);

// Fetch all analysis
router.get("/list", analysisController.getAllInterviewAnalysis);

module.exports = router;
