"use strict";
const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op, fn, col } = require("sequelize");

// GET Daily Analysis (planned targets + call response counts + percentages)
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
      sDate.setHours(0, 0, 0, 0); // start of month
      eDate = new Date(year, mon, 0);
      eDate.setHours(23, 59, 59, 999); // end of month
    } else if (startDate && endDate) {
      sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
    } else {
      // Default: today only
      sDate = new Date(today);
      sDate.setHours(0, 0, 0, 0);
      eDate = new Date(today);
      eDate.setHours(23, 59, 59, 999);
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
        jdSent: 0,
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

// GET all connected CoSheet records for a user
const getConnectedCoSheetsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    let { fromDate, toDate } = req.query;

    if (!userId) return ReE(res, "userId is required", 400);

    const now = new Date();

    // Default to current month if dates not provided
    if (!fromDate || !toDate) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const formatLocalDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      fromDate = formatLocalDate(firstDay);
      toDate = formatLocalDate(lastDay);
    }

    // Fetch CoSheet records where callResponse is "connected"
    const records = await model.CoSheet.findAll({
  where: {
    userId,
    callResponse: "connected",
    dateOfConnect: { [Op.between]: [new Date(fromDate), new Date(toDate)] }
  },
  attributes: [
    // College details
    "id",
    "sr",
    "collegeName",
    "coordinatorName",
    "mobileNumber",
    "emailId",
    "city",
    "state",
    "course",

    // Connect details
    "connectedBy",
    "dateOfConnect",
    "callResponse",
    "internshipType",
    "detailedResponse",
    "jdSentAt",

    // Resume details
    "followUpBy",
    "followUpDate",
    "followUpResponse",
    "resumeDate",
    "resumeCount",

    // Foreign key
    "userId",

    // Flags
    "isActive",
    "createdAt",
    "updatedAt"
  ],
  order: [["dateOfConnect", "ASC"]]
});


    return ReS(res, {
      success: true,
      total: records.length,
      data: records
    }, 200);

  } catch (error) {
    console.error("Get Connected CoSheets Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getConnectedCoSheetsByUser = getConnectedCoSheetsByUser;

// controllers/analysis.controller.js
const updateConnectedCoSheet = async (req, res) => {
  try {
    const { id } = req.params; // CoSheet record id
    const updateData = req.body; // updated fields from frontend

    if (!id) return ReE(res, "CoSheet id is required", 400);

    // Update the record
    const [updatedRows] = await model.CoSheet.update(updateData, {
      where: { id }
    });

    if (updatedRows === 0) return ReE(res, "No record found to update", 404);

    return ReS(res, { success: true, message: "Record updated successfully" }, 200);
  } catch (error) {
    console.error("Update Connected CoSheet Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateConnectedCoSheet = updateConnectedCoSheet;

// GET CoSheet records + Call Response Counts per User (TIMESTAMP version)

const getCoSheetsWithCounts = async (req, res) => {
  try {
    const { userId } = req.params;
    let { fromDate, toDate } = req.query;

    if (!userId) return ReE(res, "userId is required", 400);

    const today = new Date();
    const formatLocalDate = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    // Default both if missing
    if (!fromDate && !toDate) {
      fromDate = formatLocalDate(today);
      toDate = formatLocalDate(today);
    }

    // If only one provided, copy it
    if (fromDate && !toDate) toDate = fromDate;
    if (!fromDate && toDate) fromDate = toDate;

    // Normalize to full day range
    const from = new Date(`${fromDate}T00:00:00.000Z`);
    const to = new Date(`${toDate}T23:59:59.999Z`);

    // ✅ Fetch grouped counts directly from DB
    const countsRaw = await model.CoSheet.findAll({
      attributes: [
        "callResponse",
        [fn("COUNT", col("id")), "count"]
      ],
      where: {
        userId,
        dateOfConnect: { [Op.between]: [from, to] }
      },
      group: ["callResponse"]
    });

    // Convert DB response into a structured object
    const counts = {
      connected: 0,
      notAnswered: 0,
      busy: 0,
      switchOff: 0,
      invalid: 0
    };

    countsRaw.forEach(row => {
      const resp = (row.callResponse || "").toLowerCase();
      const count = parseInt(row.get("count"), 10);

      if (resp === "connected") counts.connected = count;
      else if (resp === "not answered") counts.notAnswered = count;
      else if (resp === "busy") counts.busy = count;
      else if (resp === "switch off") counts.switchOff = count;
      else if (resp === "invalid") counts.invalid = count;
    });

    // ✅ Fetch full data records too (if you still want them)
    const data = await model.CoSheet.findAll({
      where: {
        userId,
        dateOfConnect: { [Op.between]: [from, to] }
      },
      order: [["dateOfConnect", "ASC"]]
    });

    // ✅ Fetch users list
    const users = await model.User.findAll({
      attributes: ["id", "firstName", "lastName", "email", "phoneNumber"],
      order: [["firstName", "ASC"]]
    });

    return ReS(res, {
      success: true,
      userId,
      fromDate,
      toDate,
      counts,
      data,
      users
    }, 200);

  } catch (error) {
    console.error("Get CoSheet Records With Counts Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCoSheetsWithCounts = getCoSheetsWithCounts;

