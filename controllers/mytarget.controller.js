"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

var handleTargets = async function (req, res) {
  try {
    let { userId, startDate, endDate, month, targets } = req.body;
    if (!userId) return ReE(res, "userId is required", 400);

    userId = parseInt(userId, 10);
    const today = new Date();

    // Handle month input
    if (month) {
      const [year, mon] = month.split("-");
      startDate = new Date(year, mon - 1, 1);
      endDate = new Date(year, mon, 0);
    }

    // Default to current month
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
        calls: 0,
        followUps: 0,
        resumetarget: 0
      });
    }

    // Upsert targets if provided
    if (targets && Array.isArray(targets)) {
      for (let t of targets) {
        const { date, jds, calls, followUps, resumetarget } = t;
        const targetDate = new Date(date);

        let existing = await model.MyTarget.findOne({
          where: { userId, targetDate },
        });

        if (existing) {
          existing.jds = jds ?? existing.jds;
          existing.calls = calls ?? existing.calls;
          existing.followUps = followUps ?? existing.followUps;
          existing.resumetarget = resumetarget ?? existing.resumetarget;
          await existing.save();
        } else {
          await model.MyTarget.create({
            userId,
            targetDate,
            jds: jds || 0,
            calls: calls || 0,
            followUps: followUps || 0,
            resumetarget: resumetarget || 0
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

    // Merge existing targets into dateList
    const merged = dateList.map(d => {
      const found = existingTargets.find(t => new Date(t.targetDate).toISOString().split("T")[0] === d.date);
      return {
        ...d,
        jds: found ? found.jds : d.jds,
        calls: found ? found.calls : d.calls,
        followUps: found ? found.followUps : d.followUps,
        resumetarget: found ? found.resumetarget : d.resumetarget
      };
    });

    // Compute totals
    const totalJds = merged.reduce((sum, t) => sum + t.jds, 0);
    const totalCalls = merged.reduce((sum, t) => sum + t.calls, 0);
    const totalFollowUps = merged.reduce((sum, t) => sum + t.followUps, 0);
    const totalResumeTarget = merged.reduce((sum, t) => sum + t.resumetarget, 0);

    return ReS(res, {
      success: true,
      dates: merged,
      totals: {
        jds: totalJds,
        calls: totalCalls,
        followUps: totalFollowUps,
        resumetarget: totalResumeTarget
      }
    }, 200);

  } catch (error) {
    return ReE(res, error.message, 500);
  }
};

module.exports.handleTargets = handleTargets;

// GET fetch targets for frontend
var fetchTargets = async function (req, res) {
  try {
    let { userId, startDate, endDate, month } = req.query;
    if (!userId) return ReE(res, "userId is required", 400);

    userId = parseInt(userId, 10); // ✅ ensure bigint

    const today = new Date();
    let sDate, eDate;

    // Month handling
    if (month) {
      const [year, mon] = month.split("-");
      sDate = new Date(year, mon - 1, 1);
      eDate = new Date(year, mon, 0);
    } else if (startDate && endDate) {
      sDate = new Date(startDate);
      eDate = new Date(endDate);
    } else {
      sDate = new Date(today.getFullYear(), today.getMonth(), 1);
      eDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    // Generate date list
    const dateList = [];
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      dateList.push({
        date: d.toISOString().split("T")[0],
        day: d.toLocaleDateString("en-US", { weekday: "long" }),
        jds: 0,
        calls: 0
      });
    }

    // Fetch existing targets
    const existingTargets = await model.MyTarget.findAll({
      where: {
        userId,
        targetDate: { [Op.between]: [sDate, eDate] }
      }
    });

    // Merge existing into date list
    const merged = dateList.map(d => {
      const found = existingTargets.find(t => {
        const tDate = new Date(t.targetDate);
        return tDate.toISOString().split("T")[0] === d.date;
      });
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

module.exports.fetchTargets = fetchTargets;
