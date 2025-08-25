"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// GET Daily Analysis (planned targets only)
const getDailyAnalysis = async (req, res) => {
  try {
    const { userId, startDate, endDate, month } = req.query;
    if (!userId) return ReE(res, "userId is required", 400);

    const today = new Date();
    let sDate, eDate;

    // Handle month input (YYYY-MM)
    if (month) {
      const [year, mon] = month.split("-");
      sDate = new Date(year, mon - 1, 1);
      eDate = new Date(year, mon, 0);
    } else if (startDate && endDate) {
      sDate = new Date(startDate);
      eDate = new Date(endDate);
    } else {
      // Default: today only
      sDate = new Date(today);
      eDate = new Date(today);
    }

    // Generate date list
    const dateList = [];
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      dateList.push({
        date: d.toISOString().split("T")[0],
        day: d.toLocaleDateString("en-US", { weekday: "long" }),
        plannedJds: 0,
        plannedCalls: 0
      });
    }

    // Fetch MyTargets for the user in this range
    const targets = await model.MyTarget.findAll({
      where: {
        userId,
        targetDate: { [Op.between]: [sDate, eDate] }
      }
    });

    // Merge targets into date list
    const merged = dateList.map(d => {
      const target = targets.find(t => {
        if (!t.targetDate) return false; // safety check
        const tDate = new Date(t.targetDate); // convert to Date
        return tDate.toISOString().split("T")[0] === d.date;
      });

      if (target) {
        d.plannedJds = target.jds;
        d.plannedCalls = target.calls;
      }
      return d;
    });

    // Totals
    const totalPlannedJds = merged.reduce((sum, d) => sum + d.plannedJds, 0);
    const totalPlannedCalls = merged.reduce((sum, d) => sum + d.plannedCalls, 0);

    return ReS(res, {
      success: true,
      dates: merged,
      totals: {
        plannedJds: totalPlannedJds,
        plannedCalls: totalPlannedCalls
      }
    }, 200);

  } catch (error) {
    console.error("Daily Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getDailyAnalysis = getDailyAnalysis;
