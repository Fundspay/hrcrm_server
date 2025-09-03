"use strict";

const model = require("../models/index");
const { ReE, ReS } = require("../utils/util.service.js");
const { Op } = require("sequelize");




const listInterview = async (req, res) => {
  try {
    // ✅ Get all fields from the model
    const fields = Object.keys(model.StudentResume.rawAttributes);

    // ✅ Fetch all resume data with CoSheet relation
    const records = await model.StudentResume.findAll({
      attributes: fields, // only these fields
      include: [
        { model: model.CoSheet, attributes: ["id", "collegeName"] }
      ],
      order: [["createdAt", "DESC"]],
      raw: false
    });

    // ✅ Fetch all users separately
    const users = await model.User.findAll({
      attributes: ["id", "firstName", "lastName", "email"],
      raw: true,
    });

    const userList = users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName?.trim() || ""} ${u.lastName?.trim() || ""}`.trim(),
      email: u.email,
    }));

    return ReS(res, {
      success: true,
      totalFields: fields.length,
      fields,
      totalRecords: records.length,
      data: records,
      users: userList,
    }, 200);
  } catch (error) {
    console.error("List Resume Fields Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listInterview = listInterview;


const updateInterviewScore = async (req, res) => {
  try {
    const record = await model.StudentResume.findByPk(req.params.id);
    if (!record) return ReE(res, "Resume record not found", 404);

    const updates = {};
    const allowedFields = [
      "interviewedBy",
      "knowledgeScore",
      "approachScore",
      "skillsScore",
      "otherScore",
      "comment",
      "finalSelectionStatus",
      "userId"
    ];

    const allowedStatuses = [
      "selected",
      "not selected",
      "on hold",
      "not answered / busy",
      "not interested"
    ];

    for (let f of allowedFields) {
      if (req.body[f] !== undefined) {
        if (f === "finalSelectionStatus") {
          const val = req.body[f]?.toLowerCase();
          if (val && !allowedStatuses.includes(val)) {
            return ReE(
              res,
              `Invalid finalSelectionStatus. Allowed: ${allowedStatuses.join(", ")}`,
              400
            );
          }
          updates[f] = val;
        } else {
          updates[f] = req.body[f];
        }
      }
    }

    // ✅ Ensure userId exists in Users table
    if (updates.userId) {
      const userExists = await model.User.findByPk(updates.userId);
      if (!userExists) {
        return ReE(res, "Invalid userId — user does not exist", 400);
      }
    }

    // ✅ Auto-calculate totalAverageScore
    const scores = [
      updates.knowledgeScore ?? record.knowledgeScore,
      updates.approachScore ?? record.approachScore,
      updates.skillsScore ?? record.skillsScore,
      updates.otherScore ?? record.otherScore,
    ].filter((s) => s !== null && s !== undefined);

    if (scores.length === 4) {
      updates.totalAverageScore = (
        scores.reduce((a, b) => a + Number(b), 0) / 4
      ).toFixed(2);
    }

    if (!Object.keys(updates).length) {
      return ReE(res, "No fields to update", 400);
    }

    await record.update(updates);
    return ReS(res, { success: true, data: record }, 200);

  } catch (error) {
    console.error("Interview Score Update Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.updateInterviewScore = updateInterviewScore;

const getInterviewSummary = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fromDate, toDate } = req.query;

    if (!userId) return ReE(res, "userId is required", 400);

    // ✅ Default = today
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (fromDate && toDate) {
      startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
    }

    // ✅ Fetch interview records
    const records = await model.StudentResume.findAll({
      attributes: ["interviewedBy", "interviewDate", "finalSelectionStatus"],
      where: {
        userId,
        interviewDate: { [Op.between]: [startDate, endDate] },
        interviewedBy: { [Op.ne]: null }
      },
      raw: true,
    });

    // ✅ Fetch interview conducted target (sum for this user in range)
    const targetData = await model.MyTarget.findAll({
      attributes: [
        [model.sequelize.fn("SUM", model.sequelize.col("interviewConductedTarget")), "totalTarget"]
      ],
      where: {
        userId,
        targetDate: { [Op.between]: [startDate, endDate] }
      },
      raw: true,
    });

    const totalTarget = targetData[0]?.totalTarget || 0;

    if (!records.length) {
      // 🔹 Return default row with zeros
      const defaultRow = {
        SR: 1,
        "INTERVIEWER'S NAME": "-",
        "INTERVIEW CONDUCTED TARGET": totalTarget,
        "TOTAL INTERVIEWS CONDUCTED": 0,
        SELECTED: 0,
        "ON HOLD": 0,
        "NOT ANSWERED/BUSY": 0,
        "NOT SELECTED": 0,
        "NOT INTERESTED": 0,
        "DATE OF INTERVIEW": "",
      };

      return ReS(res, {
        success: true,
        data: [defaultRow],
        totals: {
          target: totalTarget,
          conducted: 0,
          achievement: totalTarget > 0 ? "0%" : "N/A"
        }
      }, 200);
    }

    // ✅ Group by interviewer
    const summary = {};
    let srCounter = 1;

    for (const rec of records) {
      const interviewer = rec.interviewedBy.trim().toLowerCase();

      if (!summary[interviewer]) {
        summary[interviewer] = {
          sr: srCounter++,
          interviewerName: rec.interviewedBy,
          conducted: 0,
          selected: 0,
          onHold: 0,
          notAnsweredBusy: 0,
          notSelected: 0,
          notInterested: 0,
          dateWise: {}
        };
      }

      if (rec.finalSelectionStatus) {
        summary[interviewer].conducted++;
        const status = rec.finalSelectionStatus.toLowerCase();

        if (status === "selected") summary[interviewer].selected++;
        else if (status === "on hold") summary[interviewer].onHold++;
        else if (status === "not answered / busy") summary[interviewer].notAnsweredBusy++;
        else if (status === "not selected") summary[interviewer].notSelected++;
        else if (status === "not interested") summary[interviewer].notInterested++;
      }

      if (rec.interviewDate) {
        const d = new Date(rec.interviewDate);
        const formattedDate = d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
        summary[interviewer].dateWise[formattedDate] =
          (summary[interviewer].dateWise[formattedDate] || 0) + 1;
      }
    }

    // ✅ Prepare response
    const data = Object.values(summary).map((s) => ({
      SR: s.sr,
      "INTERVIEWER'S NAME": s.interviewerName,
      "INTERVIEW CONDUCTED TARGET": totalTarget, // same global target for all rows
      "TOTAL INTERVIEWS CONDUCTED": s.conducted,
      SELECTED: s.selected,
      "ON HOLD": s.onHold,
      "NOT ANSWERED/BUSY": s.notAnsweredBusy,
      "NOT SELECTED": s.notSelected,
      "NOT INTERESTED": s.notInterested,
      "DATE OF INTERVIEW": Object.entries(s.dateWise)
        .map(([date, count], idx) => `${idx + 1}. ${date} (${count})`)
        .join("\n")
    }));

    const totalConducted = data.reduce((sum, d) => sum + d["TOTAL INTERVIEWS CONDUCTED"], 0);

    return ReS(res, {
      success: true,
      data,
      totals: {
        target: totalTarget,
        conducted: totalConducted,
        achievement: totalTarget > 0 ? ((totalConducted / totalTarget) * 100).toFixed(2) + "%" : "N/A"
      }
    }, 200);

  } catch (error) {
    console.error("Interview Summary Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getInterviewSummary = getInterviewSummary;


const getCollegeInterviewAnalysis = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fromDate, toDate } = req.query;

    if (!userId) return ReE(res, "userId is required", 400);

    // Default = today
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (fromDate && toDate) {
      startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
    }

    const records = await model.StudentResume.findAll({
      attributes: ["collegeName", "interviewDate", "finalSelectionStatus"],
      where: {
        userId: userId,
        interviewDate: { [Op.between]: [startDate, endDate] },
        collegeName: { [Op.ne]: null }
      },
      raw: true,
    });

    if (!records.length) {
      return ReS(res, { success: true, data: [] }, 200);
    }

    // Group by collegeName
    const summary = {};
    let srCounter = 1;

    for (const rec of records) {
      const college = rec.collegeName.trim().toLowerCase();
      if (!summary[college]) {
        summary[college] = {
          sr: srCounter++,
          collegeName: rec.collegeName,
          totalAllotted: 0,
          totalConducted: 0,
          selected: 0,
          onHold: 0,
          notAnsweredBusy: 0,
          notSelected: 0,
          notInterested: 0,
          dateWise: {}
        };
      }

      // Every row = allotted
      summary[college].totalAllotted++;

      if (rec.finalSelectionStatus) {
        summary[college].totalConducted++;
        const status = rec.finalSelectionStatus.toLowerCase();

        if (status === "selected") summary[college].selected++;
        else if (status === "on hold") summary[college].onHold++;
        else if (status === "not answered / busy") summary[college].notAnsweredBusy++;
        else if (status === "not selected") summary[college].notSelected++;
        else if (status === "not interested") summary[college].notInterested++;
      }

      // Group by date
      if (rec.interviewDate) {
        const d = new Date(rec.interviewDate);
        const formattedDate = d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
        summary[college].dateWise[formattedDate] =
          (summary[college].dateWise[formattedDate] || 0) + 1;
      }
    }

    // Format output
    const data = Object.values(summary).map((s) => {
      const selectionPercent =
        s.totalConducted > 0
          ? ((s.selected / s.totalConducted) * 100).toFixed(2) + "%"
          : "0%";

      return {
        SR: s.sr,
        "COLLEGE NAME": s.collegeName,
        "TOTAL INTERVIEWS ALLOTTED": s.totalAllotted,
        "TOTAL INTERVIEWS CONDUCTED": s.totalConducted,
        SELECTED: s.selected,
        "ON HOLD": s.onHold,
        "NOT ANSWERED/BUSY": s.notAnsweredBusy,
        "NOT SELECTED": s.notSelected,
        "NOT INTERESTED": s.notInterested,
        "SELECTION %": selectionPercent,
        "DATE OF INTERVIEW": Object.entries(s.dateWise)
          .map(([date, count], idx) => `${idx + 1}. ${date} (${count})`)
          .join("\n")
      };
    });

    return ReS(res, { success: true, data }, 200);

  } catch (error) {
    console.error("College Interview Analysis Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getCollegeInterviewAnalysis = getCollegeInterviewAnalysis;

// ✅ List interviews by userId with user info and total count
const listInterviewsByUserId = async (req, res) => {
  try {
    const userId = req.query.userId || req.params.userId;
    if (!userId) return ReE(res, "userId is required", 400);

    // 🔹 Step 1: Get user full name
    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["firstName", "lastName"],
      raw: true,
    });

    if (!user) {
      return ReE(res, "User not found", 404);
    }

    const firstName = user.firstName?.trim() || "";
    const lastName = user.lastName ? user.lastName.trim() : "";
    const fullName = `${firstName} ${lastName}`.trim();

    // 🔹 Step 2: Fetch StudentResume entries where interviewedBy matches fullName or firstName (case-insensitive)
    const interviews = await model.StudentResume.findAll({
      where: {
        userId,
        [Op.or]: [
          { interviewedBy: { [Op.iLike]: fullName } },
          { interviewedBy: { [Op.iLike]: firstName } },
        ],
      },
      order: [["interviewDate", "ASC"]],
      raw: true,
    });

    // 🔹 Step 3: Fetch all users for reference
    const users = await model.User.findAll({
      attributes: ["id", "firstName", "lastName", "email"],
      raw: true,
    });

    const userList = users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName?.trim() || ""} ${u.lastName?.trim() || ""}`.trim(),
      email: u.email,
    }));

    return ReS(res, {
      success: true,
      userId,
      interviewedBy: fullName,
      totalRecords: interviews.length,
      data: interviews,
      users: userList,
    });
  } catch (error) {
    console.error("ListInterviews Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.listInterviewsByUserId = listInterviewsByUserId;

const getDailyInterviewStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fromDate, toDate } = req.query;

    if (!userId) return ReE(res, "userId is required", 400);

    // Default = today
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (fromDate && toDate) {
      startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
    }

    // Fetch interviews for user in date range
    const records = await model.StudentResume.findAll({
      attributes: ["interviewDate", "finalSelectionStatus"],
      where: {
        userId: userId,
        interviewDate: { [Op.between]: [startDate, endDate] },
        interviewedBy: { [Op.ne]: null },
      },
      raw: true,
    });

    if (!records.length) {
      return ReS(res, { success: true, data: [] }, 200);
    }

    // Group per day
    const stats = {};
    for (const rec of records) {
      if (!rec.interviewDate) continue;

      const d = new Date(rec.interviewDate);
      const dayKey = d.toLocaleDateString("en-CA"); // YYYY-MM-DD

      if (!stats[dayKey]) {
        stats[dayKey] = { date: dayKey, totalConducted: 0, totalSelected: 0 };
      }

      // Count conducted
      if (rec.finalSelectionStatus) {
        stats[dayKey].totalConducted++;
      }

      // Count selected
      if (rec.finalSelectionStatus && rec.finalSelectionStatus.toLowerCase() === "selected") {
        stats[dayKey].totalSelected++;
      }
    }

    // Convert to array sorted by date
    const data = Object.values(stats).sort((a, b) => new Date(a.date) - new Date(b.date));

    return ReS(res, { success: true, data }, 200);
  } catch (error) {
    console.error("Daily Interview Stats Error:", error);
    return ReE(res, error.message, 500);
  }
};

module.exports.getDailyInterviewStats = getDailyInterviewStats;

const getInterviewsByStatus = async (req, res, statusFilter) => {
  try {
    const userId = req.query.userId || req.params.userId;
    if (!userId) return ReE(res, "userId is required", 400);

    // ✅ Get user full name
    const user = await model.User.findOne({
      where: { id: userId },
      attributes: ["firstName", "lastName"],
      raw: true,
    });

    if (!user) return ReE(res, "User not found", 404);

    const firstName = user.firstName?.trim() || "";
    const lastName = user.lastName ? user.lastName.trim() : "";
    const fullName = `${firstName} ${lastName}`.trim();

    // ✅ Build where condition
    const whereClause = {
      userId,
      [Op.or]: [
        { interviewedBy: { [Op.iLike]: fullName } },
        { interviewedBy: { [Op.iLike]: firstName } },
      ],
    };

    if (statusFilter === "conducted") {
      // conducted = anything with non-null finalSelectionStatus
      whereClause.finalSelectionStatus = { [Op.ne]: null };
    } else {
      whereClause.finalSelectionStatus = { [Op.iLike]: statusFilter };
    }

    // ✅ Fetch interviews
    const interviews = await model.StudentResume.findAll({
      where: whereClause,
      order: [["interviewDate", "ASC"]],
      raw: true,
    });

    // ✅ Fetch all users
    const users = await model.User.findAll({
      attributes: ["id", "firstName", "lastName", "email"],
      raw: true,
    });

    const userList = users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      fullName: `${u.firstName?.trim() || ""} ${u.lastName?.trim() || ""}`.trim(),
      email: u.email,
    }));

    return ReS(res, {
      success: true,
      userId,
      interviewedBy: fullName,
      totalRecords: interviews.length,
      data: interviews,
      users: userList,
    });

  } catch (error) {
    console.error("getInterviewsByStatus Error:", error);
    return ReE(res, error.message, 500);
  }
};

// ✅ All conducted interviews
const listConductedInterviews = (req, res) => 
  getInterviewsByStatus(req, res, "conducted");
module.exports.listConductedInterviews = listConductedInterviews;

// ✅ Selected interviews
const listSelectedInterviews = (req, res) => 
  getInterviewsByStatus(req, res, "selected");
module.exports.listSelectedInterviews = listSelectedInterviews;

// ✅ On Hold interviews
const listOnHoldInterviews = (req, res) => 
  getInterviewsByStatus(req, res, "on hold");
module.exports.listOnHoldInterviews = listOnHoldInterviews;

// ✅ Not Answered / Busy
const listNotAnsweredInterviews = (req, res) => 
  getInterviewsByStatus(req, res, "not answered / busy");
module.exports.listNotAnsweredInterviews = listNotAnsweredInterviews;

// ✅ Not Selected
const listNotSelectedInterviews = (req, res) => 
  getInterviewsByStatus(req, res, "not selected");
module.exports.listNotSelectedInterviews = listNotSelectedInterviews;

// ✅ Not Interested
const listNotInterestedInterviews = (req, res) => 
  getInterviewsByStatus(req, res, "not interested");
module.exports.listNotInterestedInterviews = listNotInterestedInterviews;









