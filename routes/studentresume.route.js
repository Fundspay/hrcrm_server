"use strict";
const express = require("express");
const router = express.Router();
const studentresumeController = require("../controllers/studentresume.controller"); 
// adjust path if file name/location differs

// ✅ Resume CRUD
router.post("/create", studentresumeController.createResume);
router.put("/update/:id", studentresumeController.updateResume);
router.get("/list", studentresumeController.listResumes);
router.get("/list/user/:userId", studentresumeController.listResumesByUserId);
router.delete("/delete/:id", studentresumeController.deleteResume);

// ✅ Analysis APIs
router.get("/analysis/college", studentresumeController.getCollegeAnalysis);
router.get("/analysis/daily-calendar", studentresumeController.getDailyCalendarAnalysis);
router.get("/analysis/user-work", studentresumeController.getUserWorkAnalysis);
router.get("/analysis/response", studentresumeController.getRAnalysis);

module.exports = router;
