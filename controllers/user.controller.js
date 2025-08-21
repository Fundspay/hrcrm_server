"use strict";
const model = require("../models/index");
const bcrypt = require("bcrypt");
const { ReE, ReS } = require("../utils/util.service.js");
const { sendMail } = require("../middleware/mailer.middleware");

// ✅ Add User
var addUser = async (req, res) => {
    try {
        const { firstName, lastName, email, phoneNumber, password, gender, type, position } = req.body;

        // Basic validation
        if (!firstName || !lastName || !email || !password || !type || !position) {
            return ReE(res, "Missing required fields", 400);
        }

        // Validate UserType
        const userType = await model.UserType.findByPk(type);
        if (!userType) return ReE(res, "Invalid user type", 400);

        // Validate Position (if provided)
        let userPosition = null;
        if (position) {
            const pos = await model.Position.findByPk(position);
            if (!pos) return ReE(res, "Invalid position ID", 400);
            userPosition = pos.id;
        }

        // Validate Gender (if provided)
        let userGender = null;
        if (gender) {
            const gen = await model.Gender.findByPk(gender);
            if (!gen) return ReE(res, "Invalid gender ID", 400);
            userGender = gen.id;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await model.User.create({
            firstName,
            lastName,
            email,
            phoneNumber,
            password: hashedPassword,
            type: userType.id,
            gender: userGender,
            position: userPosition
        });

        // Send welcome email
        const subject = "Welcome to FundRoom HR CRM!";
        const html = `
            <h3>Hi ${firstName},</h3>
            <p>Welcome to FundRoom HR CRM! 🎉</p>
            <p>Your account has been successfully created. You can now login with your email: <strong>${email}</strong></p>
            <p>Login at https://fundroom.in/login.html</p>
            <br>
            <p>Best Regards,<br>FundRoom Team</p>
        `;
        const mailResponse = await sendMail(email, subject, html);
        if (!mailResponse.success) {
            console.error("Failed to send welcome email:", mailResponse.error);
        }

        return ReS(res, { success: true, user }, 201);

    } catch (error) {
        console.error("Error:", error);

        if (error.name === "SequelizeValidationError") {
            return ReE(res, error.errors.map(e => e.message), 422);
        }

        if (error.name === "SequelizeUniqueConstraintError") {
            return ReE(res, "Duplicate entry detected!", 422);
        }

        return ReE(res, error.message, 422);
    }
};
module.exports.addUser = addUser;


// ✅ Fetch All Users
var fetchAllUsers = async (req, res) => {
    try {
        const users = await model.User.findAll({
            where: { isDeleted: false },
            include: [model.UserType, model.Gender]
        });
        return ReS(res, { success: true, data: users }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllUsers = fetchAllUsers;

// ✅ Fetch Single User
var fetchSingleUser = async (req, res) => {
    try {
        const user = await model.User.findByPk(req.params.id, {
            include: [
                { model: model.UserType, attributes: { exclude: ["createdAt", "updatedAt"] } },
                { model: model.Gender, attributes: { exclude: ["createdAt", "updatedAt"] } },
                { model: model.Position, attributes: { exclude: ["createdAt", "updatedAt"] } }
            ]
        });

        if (!user || user.isDeleted) return ReE(res, "User not found", 404);

        return ReS(res, { success: true, user: user.get({ plain: true }) }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingleUser = fetchSingleUser;

// ✅ Update User
var updateUser = async (req, res) => {
    try {
        const user = await model.User.findByPk(req.params.id);
        if (!user || user.isDeleted) return ReE(res, "User not found", 404);

        const { firstName, lastName,phoneNumber, type, gender, email } = req.body;

        // Validate foreign keys if provided
        if (type && !(await model.UserType.findByPk(type))) {
            return ReE(res, "Invalid user type", 400);
        }
        if (gender && !(await model.Gender.findByPk(gender))) {
            return ReE(res, "Invalid gender", 400);
        }

        let updatedFields = {
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            phoneNumber: phoneNumber || user.phoneNumber,
            type: type || user.type,
            gender: gender || user.gender,
            email: email || user.email
        };

    
        await user.update(updatedFields);

        return ReS(res, { success: true, user }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateUser = updateUser;

// ✅ Soft Delete User
var deleteUser = async (req, res) => {
    try {
        const user = await model.User.findByPk(req.params.id);
        if (!user) return ReE(res, "User not found", 404);

        await user.update({ isDeleted: true });
        return ReS(res, { success: true, message: "User deleted successfully" }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteUser = deleteUser;

const loginWithEmailPassword = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return ReE(res, "Missing email or password", 400);
        }

        const user = await model.User.findOne({
            where: { email, isDeleted: false }
        });

        if (!user) return ReE(res, "Invalid credentials", 401);

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return ReE(res, "Invalid credentials", 401);

        const isFirstLogin = !user.hasLoggedIn;
        if (isFirstLogin) await user.update({ hasLoggedIn: true });

        await user.update({ lastLoginAt: new Date() });

        const payload = {
            user_id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            photoUrl: user.photoUrl || null
        };

        

        return ReS(res, {
            user_id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            photoUrl: user.photoUrl || null,
            isFirstLogin,
          
        }, 200);

    } catch (error) {
        console.error("Login Error:", error);
        return ReE(res, error.message, 500);
    }
};

module.exports.loginWithEmailPassword = loginWithEmailPassword;

// ✅ Logout User
const logoutUser = async (req, res) => {
    try {
        const { userId } = req.body; 

        if (!userId) {
            return ReE(res, "Missing userId", 400);
        }

        const user = await model.User.findByPk(userId);
        if (!user || user.isDeleted) {
            return ReE(res, "User not found", 404);
        }

        // Optional: track logout timestamp
        await user.update({ lastLogoutAt: new Date() });

        return ReS(res, { success: true, message: "Logged out successfully" }, 200);
    } catch (error) {
        console.error("Logout Error:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.logoutUser = logoutUser;
