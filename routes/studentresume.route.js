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


// Example: GET /analysis/college?userId=123
router.get("/college/:userId", studentresumeController.getCollegeAnalysis);

// Daily calendar analysis (needs userId + optional date range)
// Example: GET /analysis/daily-calendar?userId=123&fromDate=2025-08-01&toDate=2025-08-31
router.get("/daily-calendar/:userId", studentresumeController.getDailyCalendarAnalysis);

// User-wise work analysis (filters by date range)
// Example: GET /analysis/user-work?fromDate=2025-08-01&toDate=2025-08-15
router.get("/user-work", studentresumeController.getUserWorkAnalysis);

//  Response & performance analysis (filters by date range)
// Example: GET /analysis/response?fromDate=2025-08-01&toDate=2025-08-31
router.get("/response", studentresumeController.getRAnalysis);



module.exports = router;
