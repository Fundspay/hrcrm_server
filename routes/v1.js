const express = require("express");
const router = express.Router();

// Route Imports
const userRouter = require("./user.route");
const genderRouter = require("./gender.route");
const usertypeRouter = require("./usertype.route");
const cosheetRouter = require("./cosheet.route"); 
const analysisRouter = require("./analysis.route");

// Health Check Route
router.get("/health", (req, res) => {
  res.status(200).send("Healthy Server!");
});

// Register your routes
router.use("/users", userRouter);
router.use("/genders", genderRouter);
router.use("/usertypes", usertypeRouter);
router.use("/cosheet", cosheetRouter);
router.use("/analysis", analysisRouter);

module.exports = router;
