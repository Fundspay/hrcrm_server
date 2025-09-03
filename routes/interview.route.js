
"use strict";

const express = require("express");
const router = express.Router();
const interviewController = require("../controllers/interview.controller");


router.put("/interview/:id", interviewController.updateInterviewScore);
router.get("/list", interviewController.listResumeFields);

module.exports = router;
