
"use strict";

const express = require("express");
const router = express.Router();
const interviewController = require("../controllers/interview.controller");


router.put("/interview/:id", interviewController.updateInterviewScore);
router.get("/list", interviewController.listInterview);
router.get("/interviewsummary/:userId", interviewController.getInterviewSummary);
router.get("/collegeanalysis/:userId", interviewController.getCollegeInterviewAnalysis);
router.get("/interviews/:userId", interviewController.listInterviewsByUserId);

module.exports = router;
