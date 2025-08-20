const express = require("express");
const router = express.Router();


// Example Route Imports
// const exampleRouter = require("./example.route");
const userRouter = require("./user.route")
const genderRouter = require("./gender.route")
const usertypeRouter = require("./usertype.route")

// Health Check Route
router.get("/health", (req, res) => {
  res.status(200).send("Healthy Server!");
});


// Add your route imports and `router.use()` registrations below
// router.use("/example", exampleRouter);
router.use("/users", userRouter);
router.use("/genders", genderRouter);
router.use("/usertypes", usertypeRouter);

module.exports = router;
