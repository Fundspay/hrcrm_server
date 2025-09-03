
"use strict";

const express = require("express");
const router = express.Router();
const interviewController = require("../controllers/interview.controller");


router.put("/interview/:id", interviewController.updateInterviewScore);
router.get("/list", interviewController.listInterview);
router.get("/interviewsummary/:userId", interviewController.getInterviewSummary);
router.get("/collegeanalysis/:userId", interviewController.getCollegeInterviewAnalysis);
router.get("/interviews/:userId", interviewController.listInterviewsByUserId);
router.get("/dailyinterviewstats/:userId", interviewController.getDailyInterviewStats);
router.get("/interviews/:userId/conducted", interviewController.listConductedInterviews);
router.get("/interviews/:userId/selected", interviewController.listSelectedInterviews);
router.get("/interviews/:userId/onhold", interviewController.listOnHoldInterviews);
router.get("/interviews/:userId/notanswered", interviewController.listNotAnsweredInterviews);
router.get("/interviews/:userId/notselected", interviewController.listNotSelectedInterviews);
router.get("/interviews/:userId/notinterested", interviewController.listNotInterestedInterviews);


module.exports = router;
