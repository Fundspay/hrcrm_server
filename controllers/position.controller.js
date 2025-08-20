"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");

// ✅ Add a new Position
var add = async function (req, res) {
    let { name } = req.body;
    if (!name) return ReE(res, "Position name is required", 400);

    try {
        const position = await model.Position.create({ name });
        return ReS(res, position, 201);
    } catch (error) {
        return ReE(res, error.message, 422);
    }
};
module.exports.add = add;

// ✅ Fetch all Positions (active only, excluding soft-deleted)
var fetchAll = async function (req, res) {
    try {
        const positions = await model.Position.findAll({
            where: { isDeleted: false }
        });
        return ReS(res, { success: true, data: positions }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchAll = fetchAll;

// ✅ Fetch a single Position by ID
var fetchSingle = async function (req, res) {
    try {
        const { id } = req.params;
        if (!id) return ReE(res, "ID is required", 400);

        const position = await model.Position.findByPk(id);
        if (!position) return ReE(res, "Position not found", 404);

        return ReS(res, position, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.fetchSingle = fetchSingle;

// ✅ Update a Position
var updatePosition = async function (req, res) {
    try {
        const position = await model.Position.findByPk(req.params.id);
        if (!position) return ReE(res, "Position not found", 404);

        await position.update({ name: req.body.name || position.name });
        return ReS(res, position, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.updatePosition = updatePosition;

// ✅ Soft delete a Position
var deletePosition = async function (req, res) {
    try {
        const position = await model.Position.findByPk(req.params.id);
        if (!position) return ReE(res, "Position not found", 404);

        await position.update({ isDeleted: true });
        return ReS(res, { message: "Position deleted successfully" }, 200);
    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.deletePosition = deletePosition;
