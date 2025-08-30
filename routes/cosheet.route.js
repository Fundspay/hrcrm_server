// routes/coSheet.routes.js
"use strict";
const express = require("express");
const router = express.Router();
const cosheetController = require("../controllers/cosheet.controller");

router.post("/add", cosheetController.createCoSheet);
router.put("/update/:id", cosheetController.updateConnectFields);
router.get("/list", cosheetController.getCoSheets);
router.get("/list/jdsent", cosheetController.getCoSheetsWithJDSent);
router.get("/list/:id", cosheetController.getCoSheetById);
router.post("/:id/send-jd", cosheetController.sendJDToCollege);
router.get("/stats/all", cosheetController.getCallStatsAllUsers);
router.get("/stats/user/:userId", cosheetController.getCallStatsByUserWithTarget);
router.get("/stats/user/jd/:userId",  cosheetController.getJdStatsWithTarget);
// router.get("/stats/user/:userId?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD", cosheetController.getJdStats);
router.get("/internship-stats/:userId", cosheetController.getInternshipStats);
router.get("/internship-type-colleges/:userId", cosheetController.getInternshipTypeColleges);
// Delete CoSheet
router.delete("/cosheet/:id", cosheetController.deleteCoSheet);



module.exports = router;
