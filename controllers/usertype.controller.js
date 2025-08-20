"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

//  Add a new UserType
var add = async function (req, res) {
    let { name } = req.body;
    if (!name) return ReE(res, "User type name is required", 400);

    try {
        const userType = await model.UserType.create({ name });
        return ReS(res, userType, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};  
module.exports.add = add;

//  Fetch all UserTypes (active and deleted)
var fetchAll = async function (req, res) {
    try {
        const userTypes = await model.UserType.findAll({
            where: { isDeleted: false } 
        });
        // return ReS(res, userTypes, 200);
        return ReS(res, { success: true, data: userTypes }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAll = fetchAll;

// ✅ Fetch a single UserType by ID from query parameter
var fetchSingle = async function (req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return ReE(res, "ID is required", 400);
        }

        const userType = await model.UserType.findByPk(id);
        if (!userType) {
            return ReE(res, "UserType not found", 404);
        }

        return ReS(res, userType, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};


module.exports.fetchSingle = fetchSingle;


//  Update a UserType
var updateUserType = async function (req, res) {
    try {
        const userType = await model.UserType.findByPk(req.params.id);
        if (!userType) return ReE(res, "UserType not found", 404);

        await userType.update({ name: req.body.name || userType.name });
        return ReS(res, userType, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateUserType = updateUserType;

//  Soft delete a UserType
var deleteUserType = async function (req, res) {
    try {
        const userType = await model.UserType.findByPk(req.params.id);
        if (!userType) return ReE(res, "UserType not found", 404);

        await userType.update({ isDeleted: true });  // Soft delete
        return ReS(res, { message: "UserType deleted successfully" }, 200); 

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteUserType = deleteUserType;
