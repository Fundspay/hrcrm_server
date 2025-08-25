"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// GET Daily Analysis (planned targets + call response counts)
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
        day: d.toLocaleDateString("en-IN", { weekday: "long" }), // Indian weekday
        plannedJds: 0,
        plannedCalls: 0,
        connected: 0,
        notAnswered: 0,
        busy: 0,
        switchOff: 0,
        invalid: 0
      });
    }

    // Fetch MyTargets for the user in this range
    const targets = await model.MyTarget.findAll({
      where: {
        userId,
        targetDate: { [Op.between]: [sDate, eDate] }
      }
    });

    // Fetch CoSheet records to count call responses
    const records = await model.CoSheet.findAll({
      where: {
        userId,
        dateOfConnect: { [Op.between]: [sDate, eDate] }
      }
    });

    const allowedCallResponses = ["connected", "not answered", "busy", "switch off", "invalid"];

    // Merge targets and call stats into date list
    const merged = dateList.map(d => {
      // Merge targets
      const target = targets.find(t => t.targetDate && new Date(t.targetDate).toISOString().split("T")[0] === d.date);
      if (target) {
        d.plannedJds = target.jds;
        d.plannedCalls = target.calls;
      }

      // Merge actual call responses
      const dayRecords = records.filter(r => r.dateOfConnect && new Date(r.dateOfConnect).toISOString().split("T")[0] === d.date);
      dayRecords.forEach(r => {
        const resp = (r.callResponse || "").toLowerCase();
        if (allowedCallResponses.includes(resp)) {
          if (resp === "connected") d.connected++;
          else if (resp === "not answered") d.notAnswered++;
          else if (resp === "busy") d.busy++;
          else if (resp === "switch off") d.switchOff++;
          else if (resp === "invalid") d.invalid++;
        }
      });

      return d;
    });

    // Totals
    const totals = merged.reduce((sum, d) => {
      sum.plannedJds += d.plannedJds;
      sum.plannedCalls += d.plannedCalls;
      sum.connected += d.connected;
      sum.notAnswered += d.notAnswered;
      sum.busy += d.busy;
      sum.switchOff += d.switchOff;
      sum.invalid += d.invalid;
      return sum;
    }, { plannedJds: 0, plannedCalls: 0, connected: 0, notAnswered: 0, busy: 0, switchOff: 0, invalid: 0 });

    const monthLabel = new Date(sDate).toLocaleString("en-IN", { month: "long", year: "numeric" });

    return ReS(res, {
      success: true,
      month: monthLabel,
      dates: merged,
      totals
    }, 200);

  } catch (error) {
    console.error("Daily Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getDailyAnalysis = getDailyAnalysis;
