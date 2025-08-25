"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// Single endpoint: handles generate + fetch + totals + upsert
var handleTargets = async function (req, res) {
    try {
        let { userId, startDate, endDate, month, targets } = req.body;
        if (!userId) return ReE(res, "userId is required", 400);

        const today = new Date();

        // If month is provided (YYYY-MM), set start & end
        if (month) {
            const [year, mon] = month.split("-");
            startDate = new Date(year, mon - 1, 1);
            endDate = new Date(year, mon, 0);
        }

        // Default: current month
        if (!startDate || !endDate) {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else {
            startDate = new Date(startDate);
            endDate = new Date(endDate);
        }

        // Generate date list
        const dateList = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            dateList.push({
                date: d.toISOString().split("T")[0],
                day: d.toLocaleDateString("en-US", { weekday: "long" }),
                jds: 0,
                calls: 0
            });
        }

        // If frontend sends targets → upsert
        if (targets && Array.isArray(targets)) {
            const coSheet = await model.CoSheet.findOne({
                where: { userId },
                order: [["createdAt", "DESC"]],
            });
            if (!coSheet) return ReE(res, "No CoSheet found for this user", 404);

            for (let t of targets) {
                const { date, jds, calls } = t;
                let existing = await model.MyTarget.findOne({
                    where: { userId, targetDate: date },
                });

                if (existing) {
                    existing.jds = jds ?? existing.jds;
                    existing.calls = calls ?? existing.calls;
                    await existing.save();
                } else {
                    await model.MyTarget.create({
                        userId,
                        coSheetId: coSheet.id,
                        targetDate: date,
                        jds: jds || 0,
                        calls: calls || 0,
                    });
                }
            }
        }

        // Fetch existing targets in range
        const existingTargets = await model.MyTarget.findAll({
            where: {
                userId,
                targetDate: { [Op.between]: [startDate, endDate] },
            },
        });

        // Merge existing into date list
        const merged = dateList.map(d => {
            const found = existingTargets.find(t => t.targetDate === d.date);
            return {
                ...d,
                jds: found ? found.jds : d.jds,
                calls: found ? found.calls : d.calls
            };
        });

        // Totals
        const totalJds = merged.reduce((sum, t) => sum + t.jds, 0);
        const totalCalls = merged.reduce((sum, t) => sum + t.calls, 0);

        return ReS(res, {
            success: true,
            dates: merged,
            totals: { jds: totalJds, calls: totalCalls }
        }, 200);

    } catch (error) {
        return ReE(res, error.message, 500);
    }
};
module.exports.handleTargets = handleTargets;

