"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");

// GET Daily Analysis (planned targets + call response counts + percentages + JD stats)
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
        invalid: 0,
        achievedCalls: 0,
        achievementPercent: 0,
        jdSent: 0,           // JD sent by this user on that day
        jdAchievementPercent: 0
      });
    }

    // Fetch MyTargets for the user in this range
    const targets = await model.MyTarget.findAll({
      where: {
        userId,
        targetDate: { [Op.between]: [sDate, eDate] }
      }
    });

    // Fetch CoSheet records for calls
    const callRecords = await model.CoSheet.findAll({
      where: {
        userId,
        dateOfConnect: { [Op.between]: [sDate, eDate] }
      }
    });

    // Fetch CoSheet records for JD sent
    const jdRecords = await model.CoSheet.findAll({
      where: {
        userId,
        jdSentAt: { [Op.between]: [sDate, eDate] }
      }
    });

    const allowedCallResponses = ["connected", "not answered", "busy", "switch off", "invalid"];

    // Merge targets, call stats, and JD stats into date list
    const merged = dateList.map(d => {
      // Merge targets
      const target = targets.find(t => t.targetDate && new Date(t.targetDate).toISOString().split("T")[0] === d.date);
      if (target) {
        d.plannedJds = target.jds;
        d.plannedCalls = target.calls;
      }

      // Merge actual call responses
      const dayCallRecords = callRecords.filter(r => r.dateOfConnect && new Date(r.dateOfConnect).toISOString().split("T")[0] === d.date);
      dayCallRecords.forEach(r => {
        const resp = (r.callResponse || "").toLowerCase();
        if (allowedCallResponses.includes(resp)) {
          if (resp === "connected") d.connected++;
          else if (resp === "not answered") d.notAnswered++;
          else if (resp === "busy") d.busy++;
          else if (resp === "switch off") d.switchOff++;
          else if (resp === "invalid") d.invalid++;
        }
      });
      d.achievedCalls = d.connected + d.notAnswered + d.busy + d.switchOff + d.invalid;
      d.achievementPercent = d.plannedCalls > 0 ? ((d.achievedCalls / d.plannedCalls) * 100).toFixed(2) : 0;

      // Merge JD stats
      const dayJDCount = jdRecords.filter(r => r.jdSentAt && new Date(r.jdSentAt).toISOString().split("T")[0] === d.date).length;
      d.jdSent = dayJDCount;
      d.jdAchievementPercent = d.plannedJds > 0 ? ((d.jdSent / d.plannedJds) * 100).toFixed(2) : 0;

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
      sum.achievedCalls += d.achievedCalls;
      sum.jdSent += d.jdSent;
      return sum;
    }, { plannedJds: 0, plannedCalls: 0, connected: 0, notAnswered: 0, busy: 0, switchOff: 0, invalid: 0, achievedCalls: 0, jdSent: 0 });

    totals.achievementPercent = totals.plannedCalls > 0 ? ((totals.achievedCalls / totals.plannedCalls) * 100).toFixed(2) : 0;
    totals.jdAchievementPercent = totals.plannedJds > 0 ? ((totals.jdSent / totals.plannedJds) * 100).toFixed(2) : 0;

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
