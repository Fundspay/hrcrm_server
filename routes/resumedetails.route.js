"use strict";

const express = require("express");
const router = express.Router();
const resumedetailsController = require("../controllers/resumedetails.controller");


router.put("/update/:id", resumedetailsController.updateResumeFields);
router.get("/analysis/:userId", resumedetailsController.getResumeAnalysis);
router.get("/total-analysis/:userId", resumedetailsController.gettotalResumeAnalysis);
router.get("/analysis-per-cosheet/:userId", resumedetailsController.getResumeAnalysisPerCoSheet);
router.get("/followup-totals", resumedetailsController.getFollowUpResumeTotals);
router.get("/followup-data/:userId", resumedetailsController.getFollowUpData);

module.exports = router;
