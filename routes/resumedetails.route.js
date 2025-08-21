// routes/resume.routes.js
"use strict";
const express = require("express");
const router = express.Router();
const resumedetailsController = require("../controllers/resume.controller");

// Update resume-related fields
router.put("/update/:id", resumedetailsController.updateResumeFields);
router.get("/analysis/:userId", resumedetailsController.getResumeAnalysis);
router.get("/total-analysis/:userId", resumedetailsController.gettotalResumeAnalysis);
router.get("/per-cosheet/:userId", resumedetailsController.getResumeAnalysisPerCoSheet);

module.exports = router;
