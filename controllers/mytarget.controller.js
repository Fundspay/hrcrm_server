"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add a new target for a user, fetch CoSheet automatically
var addTarget = async function (req, res) {
    let { userId, jds, calls } = req.body;
    if (!userId) return ReE(res, "userId is required", 400);

    try {
        // Find the latest CoSheet for the user
        const coSheet = await model.CoSheet.findOne({
            where: { userId },
            order: [["createdAt", "DESC"]]
        });

        if (!coSheet) return ReE(res, "No CoSheet found for this user", 404);

        // Create the target
        const target = await model.MyTarget.create({
            userId,
            coSheetId: coSheet.id,
            jds: jds || 0,
            calls: calls || 0
        });

        return ReS(res, target, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};
module.exports.addTarget = addTarget;

// ✅ Fetch all targets
var fetchAllTargets = async function (req, res) {
    try {
        const targets = await model.MyTarget.findAll({
            include: [
                { model: model.User, attributes: ["id", "name", "email"] },
                { model: model.CoSheet, attributes: ["id", "collegeName"] }
            ]
        });
        return ReS(res, { success: true, data: targets }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAllTargets = fetchAllTargets;

// ✅ Fetch single target by ID
var fetchTargetById = async function (req, res) {
    try {
        const { id } = req.params;
        if (!id) return ReE(res, "ID is required", 400);

        const target = await model.MyTarget.findByPk(id, {
            include: [
                { model: model.User, attributes: ["id", "name", "email"] },
                { model: model.CoSheet, attributes: ["id", "collegeName"] }
            ]
        });
        if (!target) return ReE(res, "Target not found", 404);

        return ReS(res, target, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchTargetById = fetchTargetById;

// ✅ Update a target
var updateTarget = async function (req, res) {
    try {
        const target = await model.MyTarget.findByPk(req.params.id);
        if (!target) return ReE(res, "Target not found", 404);

        await target.update({
            jds: req.body.jds !== undefined ? req.body.jds : target.jds,
            calls: req.body.calls !== undefined ? req.body.calls : target.calls
        });

        return ReS(res, target, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updateTarget = updateTarget;

// ✅ Delete a target
var deleteTarget = async function (req, res) {
    try {
        const target = await model.MyTarget.findByPk(req.params.id);
        if (!target) return ReE(res, "Target not found", 404);

        await target.destroy();
        return ReS(res, { message: "Target deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deleteTarget = deleteTarget;

// ✅ Fetch all targets for a specific user
var getTargetsByUser = async function (req, res) {
    try {
        const { userId } = req.query;
        if (!userId) return ReE(res, "userId is required", 400);

        const targets = await model.MyTarget.findAll({
            where: { userId },
            include: [
                { model: model.User, attributes: ["id", "name", "email"] },
                { model: model.CoSheet, attributes: ["id", "collegeName"] }
            ]
        });

        if (!targets.length) return ReS(res, { success: true, message: "No targets found for this user", data: [] }, 200);

        return ReS(res, { success: true, data: targets }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.getTargetsByUser = getTargetsByUser;

// ✅ Upsert target: create new or update existing
var upsertTarget = async function (req, res) {
    let { userId, jds, calls } = req.body;
    if (!userId) return ReE(res, "userId is required", 400);

    try {
        // Find the latest CoSheet for the user
        const coSheet = await model.CoSheet.findOne({
            where: { userId },
            order: [["createdAt", "DESC"]],
        });

        if (!coSheet) return ReE(res, "No CoSheet found for this user", 404);

        // Check if a target already exists for this CoSheet
        let target = await model.MyTarget.findOne({
            where: { userId, coSheetId: coSheet.id },
        });

        if (target) {
            // ✅ Update existing target
            await target.update({
                jds: jds !== undefined ? jds : target.jds,
                calls: calls !== undefined ? calls : target.calls,
            });
            return ReS(res, { message: "Target updated successfully", data: target }, 200);
        } else {
            // ✅ Create new target
            target = await model.MyTarget.create({
                userId,
                coSheetId: coSheet.id,
                jds: jds || 0,
                calls: calls || 0,
            });
            return ReS(res, { message: "Target created successfully", data: target }, 201);
        }
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};

module.exports.upsertTarget = upsertTarget;


