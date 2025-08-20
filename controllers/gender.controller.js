"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add Gender
var add = async (req, res) => {
    try {
        const { name, user } = req.body;
        if (!name || !user) return ReE(res, "Missing required fields", 400);

        if (!(await model.User.findByPk(user))) return ReE(res, "Invalid user ID", 400);

        const gender = await model.Gender.create({ name, user });

        return ReS(res, gender, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};
module.exports.add = add;

// ✅ Fetch all Genders
var fetchAll = async (req, res) => {
    try {
        const genders = await model.Gender.findAll({});
        // return ReS(res, genders, 200);
        return ReS(res, { success: true, data: genders }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAll = fetchAll;

// ✅ Fetch a single Gender
var fetchSingle = async (req, res) => {
    try {
        const gender = await model.Gender.findByPk(req.params.id, {
            include: [{ model: model.User, attributes: { exclude: ['password', 'createdAt', 'updatedAt'] } }],
            raw: false,
            nest: true
        });

        if (!gender || gender.isDeleted) {
            return ReE(res, "Gender not found", 404);
        }

        return ReS(res, gender.toJSON(), 200);
    } catch (error) {
        console.error("Fetch Single Gender Error:", error);
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingle = fetchSingle;

// ✅ Update Gender
var updateGender = async (req, res) => {
    try {
        const gender = await model.Gender.findByPk(req.params.id);
        if (!gender || gender.isDeleted) return ReE(res, "Gender not found", 404);

        const { name, user } = req.body;

        if (user && !(await model.User.findByPk(user))) return ReE(res, "Invalid user ID", 400);

        await gender.update({
            name: name || gender.name,
            user: user || gender.user
        });

        return ReS(res, gender, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateGender = updateGender;

// ✅ Soft Delete Gender
var deleteGender = async (req, res) => {
    try {
        const gender = await model.Gender.findByPk(req.params.id);
        if (!gender) return ReE(res, "Gender not found", 404);

        await gender.update({ isDeleted: true });
        return ReS(res, "Gender deleted successfully", 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteGender = deleteGender;

// 📩 POSTMAN REQUEST BODIES
/*

🔹 Add Gender (POST /genders)
{
    "name": "Male",
    "user": 1
}

🔹 Fetch All Genders (GET /genders)
No body required

🔹 Fetch Single Gender (GET /genders/:id)
No body required

🔹 Update Gender (PUT /genders/:id)
{
    "name": "Female",
    "user": 2
}

🔹 Delete Gender (DELETE /genders/:id)
No body required

*/
