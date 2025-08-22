// routes/interviewdetails.routes.js
"use strict";

const express = require("express");
const router = express.Router();
const interviewController = require("../controllers/interviewdetails.controller");



// Fetch all interviews
router.get("/list", interviewController.getAllInterviews);

// Get interview details by interviewID
router.get("/:interviewID", interviewController.getInterviewDetails);

// Upsert interview details
router.post("/upsert", interviewController.upsertInterviewDetails);




module.exports = router;
