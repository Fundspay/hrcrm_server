const express = require("express");
const router = express.Router();
const userTypeController = require("../controllers/usertype.controller");

router.post("/add", userTypeController.add);
router.get("/list", userTypeController.fetchAll);
router.get("/list/:id", userTypeController.fetchSingle);
router.put("/update/:id", userTypeController.updateUserType);
router.delete("/delete/:id", userTypeController.deleteUserType);

module.exports = router;
