const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");

// Example Route Imports
// const exampleRouter = require("./example.route");

// Health Check Route
router.get("/health", (req, res) => {
  res.status(200).send("Healthy Server!");
});


// Add your route imports and `router.use()` registrations below
// router.use("/example", exampleRouter);



module.exports = router;
