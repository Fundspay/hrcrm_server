const express = require("express");
const router = express.Router();

// Route Imports
const userRouter = require("./user.route");
const genderRouter = require("./gender.route");
const usertypeRouter = require("./usertype.route");
const cosheetRouter = require("./cosheet.route"); 
const positionRouter = require("./position.route");
const resumedetailsRouter =require("./resumedetails.route")
const mytargetRouter = require("./mytarget.route");


// Health Check Route
router.get("/health", (req, res) => {
  res.status(200).send("Healthy Server!");
});

// Register your routes
router.use("/user", userRouter);
router.use("/gender", genderRouter);
router.use("/usertype", usertypeRouter);
router.use("/cosheet", cosheetRouter);
router.use("/position", positionRouter);
router.use("/resumedetails", resumedetailsRouter);
router.use("/mytarget", mytargetRouter);

module.exports = router;
