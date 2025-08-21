const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");

// ✅ User CRUD
router.post("/register", userController.addUser);         // Create user
router.get("/list", userController.fetchAllUsers);       // Get all users
router.get("/list/:id", userController.fetchSingleUser); // Get single user
router.put("/update/:id", userController.updateUser);    // Update user
router.delete("/delete/:id", userController.deleteUser); // Soft delete user

// ✅ Auth
router.post("/login", userController.loginWithEmailPassword); // Login with email & password
router.post("/logout", userController.logoutUser); // Logout user

module.exports = router;
